import { MANAGE_KEYS } from "../../shared/permissions";
import {
  requireAnyPermission, json, ID_PATTERN, isSetupProblem, GROUPS_SETUP_MESSAGE
} from "../../shared/serverAuth";

// This code runs on the server only.
export const dynamic = "force-dynamic";

// The list of everyone, with their role and group.
export async function GET(request) {
  try {
    const { admin, caller, response } = await requireAnyPermission(request, MANAGE_KEYS);
    if (response) return response;

    // all accounts, page by page
    const accounts = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: "Could not load the users." }, 500);
      const batch = (data && data.users) || [];
      accounts.push(...batch);
      if (batch.length < 200) break;
    }

    // groups (the two tables may not be created yet)
    let groups = [];
    let memberships = [];
    let groupsReady = true;
    let groupsMessage = "";
    const g = await admin.from("user_groups").select("id, name, created_at").order("name", { ascending: true });
    const m = await admin.from("user_group_members").select("user_id, group_id");
    if (g.error || m.error) {
      groupsReady = false;
      groupsMessage = (g.error || m.error).message || "";
    } else {
      groups = g.data || [];
      memberships = m.data || [];
    }
    const groupOf = {};
    const memberCount = {};
    for (const row of memberships) {
      groupOf[row.user_id] = row.group_id;
      memberCount[row.group_id] = (memberCount[row.group_id] || 0) + 1;
    }

    const roleName = (u) => {
      if (caller.rolesById && u.app_metadata && u.app_metadata.role_id) {
        const r = caller.rolesById[u.app_metadata.role_id];
        if (r) return r.name;
      }
      return "";
    };

    // only what this page needs (no phone number, birth date, weight, height)
    const users = accounts
      .map((u) => ({
        id: u.id,
        email: u.email || "",
        name: (u.user_metadata && u.user_metadata.full_name) || "",
        isOwner: u.email ? u.email.toLowerCase() === (process.env.ADMIN_EMAIL || "").trim().toLowerCase() : false,
        roleId: (u.app_metadata && u.app_metadata.role_id) || "",
        roleName: roleName(u),
        groupId: groupOf[u.id] || null,
        createdAt: u.created_at || null,
        lastSignInAt: u.last_sign_in_at || null
      }))
      .sort((a, b) =>
        Number(b.isOwner) - Number(a.isOwner) ||
        (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase())
      );

    return json({
      me: { id: caller.user.id, isOwner: caller.isOwner, permissions: caller.permissions },
      users,
      roles: caller.roles,
      rolesReady: caller.rolesReady,
      groups: groups.map((x) => ({ id: x.id, name: x.name, members: memberCount[x.id] || 0 })),
      groupsReady,
      groupsMessage
    });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Change ONE thing about a person: their role, or their group.
export async function PATCH(request) {
  try {
    const { admin, caller, response } = await requireAnyPermission(request, MANAGE_KEYS);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown user." }, 400);
    const hasRole = Object.prototype.hasOwnProperty.call(body, "roleId");
    const hasGroup = Object.prototype.hasOwnProperty.call(body, "groupId");
    if (hasRole === hasGroup) return json({ error: "Nothing to change." }, 400);

    const { data: found, error: findError } = await admin.auth.admin.getUserById(id);
    if (findError || !found || !found.user) return json({ error: "That user was not found." }, 404);
    const target = found.user;
    const targetIsOwner = target.email && target.email.toLowerCase() === (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

    if (hasRole) {
      if (!caller.can("roles.manage")) return json({ error: "You do not have permission to change roles." }, 403);
      if (targetIsOwner) return json({ error: "The owner's role cannot be changed." }, 400);
      const meta = { ...(target.app_metadata || {}) };
      delete meta.role; // the old flag is replaced by the role
      if (body.roleId === null || body.roleId === "") {
        delete meta.role_id;
      } else {
        if (typeof body.roleId !== "string" || !ID_PATTERN.test(body.roleId)) return json({ error: "Unknown role." }, 400);
        if (!caller.rolesById[body.roleId]) return json({ error: "That role was not found." }, 404);
        meta.role_id = body.roleId;
      }
      const { error } = await admin.auth.admin.updateUserById(id, { app_metadata: meta });
      if (error) return json({ error: "Could not change the role." }, 400);
      return json({ ok: true });
    }

    // group
    if (!caller.can("groups.manage")) return json({ error: "You do not have permission to manage groups." }, 403);
    const groupProblem = (error) =>
      isSetupProblem(error)
        ? json({ error: GROUPS_SETUP_MESSAGE, setupNeeded: true }, 503)
        : json({ error: "Could not save the group." }, 500);
    if (body.groupId === null) {
      const { error } = await admin.from("user_group_members").delete().eq("user_id", id);
      if (error) return groupProblem(error);
      return json({ ok: true });
    }
    if (typeof body.groupId !== "string" || !ID_PATTERN.test(body.groupId)) {
      return json({ error: "Unknown group." }, 400);
    }
    const { data: group, error: groupError } = await admin
      .from("user_groups")
      .select("id")
      .eq("id", body.groupId)
      .maybeSingle();
    if (groupError) return groupProblem(groupError);
    if (!group) return json({ error: "That group was not found." }, 404);
    const { error } = await admin
      .from("user_group_members")
      .upsert({ user_id: id, group_id: body.groupId }, { onConflict: "user_id" });
    if (error) return groupProblem(error);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Remove a person (their account and all their workout data).
export async function DELETE(request) {
  try {
    const { admin, caller, response } = await requireAnyPermission(request, MANAGE_KEYS);
    if (response) return response;
    if (!caller.can("users.remove")) return json({ error: "You do not have permission to remove users." }, 403);

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown user." }, 400);

    const { data: found, error: findError } = await admin.auth.admin.getUserById(id);
    if (findError || !found || !found.user) return json({ error: "That user was not found." }, 404);
    const target = found.user;
    const targetIsOwner = target.email && target.email.toLowerCase() === (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

    if (target.id === caller.user.id) return json({ error: "You cannot remove your own account here." }, 400);
    if (targetIsOwner) return json({ error: "The owner cannot be removed." }, 400);

    // Someone may only remove people whose role is not stronger than their own.
    const targetRoleId = (target.app_metadata || {}).role_id;
    const targetRole = targetRoleId ? caller.rolesById[targetRoleId] : null;
    if (!caller.isOwner && targetRole) {
      const mine = caller.permissions;
      const stronger = (targetRole.permissions || []).some((k) => !mine.includes(k));
      if (stronger) {
        return json({ error: `You cannot remove someone whose role (${targetRole.name}) can do more than yours.` }, 403);
      }
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: "Could not remove the user." }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
