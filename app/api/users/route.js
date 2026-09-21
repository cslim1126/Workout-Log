import { ROLES } from "../../shared/access";
import { requireManager, roleOf, json, ID_PATTERN, isSetupProblem, GROUPS_SETUP_MESSAGE } from "../../shared/serverAuth";

// This code runs on the server only.
export const dynamic = "force-dynamic";

const RANK = { owner: 0, admin: 1, member: 2 };

// The list of everyone, with roles and groups.
export async function GET(request) {
  try {
    const { admin, caller, response } = await requireManager(request);
    if (response) return response;

    // all accounts, page by page
    const accounts = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: error.message }, 500);
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

    // only what this page needs (no phone number, birth date, weight, height)
    const users = accounts
      .map((u) => ({
        id: u.id,
        email: u.email || "",
        name: (u.user_metadata && u.user_metadata.full_name) || "",
        role: roleOf(u),
        groupId: groupOf[u.id] || null,
        createdAt: u.created_at || null,
        lastSignInAt: u.last_sign_in_at || null
      }))
      .sort((a, b) => RANK[a.role] - RANK[b.role] || (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()));

    return json({
      me: { id: caller.user.id, isOwner: caller.isOwner },
      users,
      groups: groups.map((x) => ({ id: x.id, name: x.name, members: memberCount[x.id] || 0 })),
      groupsReady,
      groupsMessage
    });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Change ONE thing about a person: their role (owner only) or their group.
export async function PATCH(request) {
  try {
    const { admin, caller, response } = await requireManager(request);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown user." }, 400);
    const hasRole = Object.prototype.hasOwnProperty.call(body, "role");
    const hasGroup = Object.prototype.hasOwnProperty.call(body, "groupId");
    if (hasRole === hasGroup) return json({ error: "Nothing to change." }, 400);

    const { data: found, error: findError } = await admin.auth.admin.getUserById(id);
    if (findError || !found || !found.user) return json({ error: "That user was not found." }, 404);
    const target = found.user;

    if (hasRole) {
      if (!caller.isOwner) return json({ error: "Only the owner can change roles." }, 403);
      if (roleOf(target) === "owner") return json({ error: "The owner's role cannot be changed." }, 400);
      if (!ROLES.includes(body.role)) return json({ error: "Role must be Admin or Member." }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { ...(target.app_metadata || {}), role: body.role }
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // group
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
    const { admin, caller, response } = await requireManager(request);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown user." }, 400);

    const { data: found, error: findError } = await admin.auth.admin.getUserById(id);
    if (findError || !found || !found.user) return json({ error: "That user was not found." }, 404);
    const target = found.user;
    const targetRole = roleOf(target);

    if (target.id === caller.user.id) return json({ error: "You cannot remove your own account here." }, 400);
    if (targetRole === "owner") return json({ error: "The owner cannot be removed." }, 400);
    if (targetRole === "admin" && !caller.isOwner) return json({ error: "Only the owner can remove an admin." }, 403);

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
