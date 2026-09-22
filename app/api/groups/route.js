import { requirePermission, json, ID_PATTERN, isSetupProblem, GROUPS_SETUP_MESSAGE } from "../../shared/serverAuth";

// This code runs on the server only.
export const dynamic = "force-dynamic";

function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function nameProblem(name) {
  if (!name) return "Please enter a group name.";
  if (name.length > 40) return "The group name is too long (40 characters at most).";
  return "";
}
function saveError(error) {
  if (error.code === "23505") return json({ error: "A group with that name already exists." }, 409);
  if (isSetupProblem(error)) return json({ error: GROUPS_SETUP_MESSAGE, setupNeeded: true }, 503);
  return json({ error: "Could not save the group." }, 500);
}

// Create a group
export async function POST(request) {
  try {
    const { admin, response } = await requirePermission(request, "groups.manage", "manage groups");
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const name = cleanName(body.name);
    const problem = nameProblem(name);
    if (problem) return json({ error: problem }, 400);

    const { data, error } = await admin.from("user_groups").insert({ name }).select("id, name").single();
    if (error) return saveError(error);
    return json({ ok: true, group: data });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Rename a group
export async function PATCH(request) {
  try {
    const { admin, response } = await requirePermission(request, "groups.manage", "manage groups");
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown group." }, 400);
    const name = cleanName(body.name);
    const problem = nameProblem(name);
    if (problem) return json({ error: problem }, 400);

    const { data, error } = await admin.from("user_groups").update({ name }).eq("id", id).select("id, name");
    if (error) return saveError(error);
    if (!data || data.length === 0) return json({ error: "That group was not found." }, 404);
    return json({ ok: true, group: data[0] });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Delete a group (the people in it just have no group any more)
export async function DELETE(request) {
  try {
    const { admin, response } = await requirePermission(request, "groups.manage", "manage groups");
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown group." }, 400);

    const { error } = await admin.from("user_groups").delete().eq("id", id);
    if (error) return saveError(error);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
