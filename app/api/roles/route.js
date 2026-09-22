import {
  PERMISSION_KEYS, ROLES_SQL, STARTER_ROLES, cleanPermissions, cleanRoleName, checkRoleName
} from "../../shared/permissions";
import {
  getAdminClient, getCaller, loadRoles, json, ID_PATTERN, isSetupProblem
} from "../../shared/serverAuth";

// This code runs on the server only.
export const dynamic = "force-dynamic";

const ROLES_SETUP_MESSAGE = "Roles are not set up yet. Run the role SQL once in Supabase (SQL Editor), then try again.";
const setupProblem = () => json({ error: ROLES_SETUP_MESSAGE, setupNeeded: true, sql: ROLES_SQL }, 503);

async function start(request, needManage) {
  const admin = getAdminClient();
  if (!admin) {
    return { response: json({ error: "The server is not set up for this yet. Add SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL in Vercel, then redeploy." }, 500) };
  }
  const caller = await getCaller(request, admin);
  if (!caller) return { response: json({ error: "Please sign in again." }, 401) };
  if (needManage && !caller.can("roles.manage")) {
    return { response: json({ error: "You do not have permission to manage roles." }, 403) };
  }
  return { admin, caller };
}

// The roles, and what every permission means.
export async function GET(request) {
  try {
    const { admin, caller, response } = await start(request, true);
    if (response) return response;

    let { roles, ready } = await loadRoles(admin);
    if (!ready) return setupProblem();

    // First time: write the starter roles, and move anyone who was an "admin"
    // before roles existed onto the Admin role, so nobody loses access.
    if (roles.length === 0) {
      const { error } = await admin.from("user_roles").insert(STARTER_ROLES);
      if (error) return isSetupProblem(error) ? setupProblem() : json({ error: "Could not create the starter roles." }, 500);
      roles = (await loadRoles(admin)).roles;
      const adminRole = roles.find((r) => r.name === "Admin");
      if (adminRole) {
        for (let page = 1; page <= 50; page++) {
          const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const batch = (list.data && list.data.users) || [];
          for (const u of batch) {
            const meta = u.app_metadata || {};
            if (meta.role === "admin" && !meta.role_id) {
              await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...meta, role_id: adminRole.id } });
            }
          }
          if (batch.length < 200) break;
        }
      }
    }

    // how many people have each role
    const counts = {};
    for (let page = 1; page <= 50; page++) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const batch = (list.data && list.data.users) || [];
      for (const u of batch) {
        const id = (u.app_metadata || {}).role_id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
      if (batch.length < 200) break;
    }

    return json({
      roles: roles.map((r) => ({ ...r, members: counts[r.id] || 0 })),
      permissions: PERMISSION_KEYS,
      me: { isOwner: caller.isOwner, permissions: caller.permissions }
    });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

function saveError(error) {
  if (error.code === "23505") return json({ error: "A role with that name already exists." }, 409);
  if (isSetupProblem(error)) return setupProblem();
  return json({ error: "Could not save the role." }, 500);
}

// Create a role
export async function POST(request) {
  try {
    const { admin, response } = await start(request, true);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const name = cleanRoleName(body.name);
    const problem = checkRoleName(name);
    if (problem) return json({ error: problem }, 400);

    const { data, error } = await admin
      .from("user_roles")
      .insert({ name, permissions: cleanPermissions(body.permissions) })
      .select("id, name, permissions")
      .single();
    if (error) return saveError(error);
    return json({ ok: true, role: data });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Rename a role or change its ticks
export async function PATCH(request) {
  try {
    const { admin, response } = await start(request, true);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown role." }, 400);
    const name = cleanRoleName(body.name);
    const problem = checkRoleName(name);
    if (problem) return json({ error: problem }, 400);

    const { data, error } = await admin
      .from("user_roles")
      .update({ name, permissions: cleanPermissions(body.permissions) })
      .eq("id", id)
      .select("id, name, permissions");
    if (error) return saveError(error);
    if (!data || data.length === 0) return json({ error: "That role was not found." }, 404);
    return json({ ok: true, role: data[0] });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Delete a role (the people who had it go back to having no role)
export async function DELETE(request) {
  try {
    const { admin, response } = await start(request, true);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown role." }, 400);

    // take the role off everybody first
    for (let page = 1; page <= 50; page++) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const batch = (list.data && list.data.users) || [];
      for (const u of batch) {
        const meta = u.app_metadata || {};
        if (meta.role_id === id) {
          const next = { ...meta };
          delete next.role_id;
          delete next.role;
          await admin.auth.admin.updateUserById(u.id, { app_metadata: next });
        }
      }
      if (batch.length < 200) break;
    }

    const { error } = await admin.from("user_roles").delete().eq("id", id);
    if (error) return saveError(error);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
