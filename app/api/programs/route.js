import { checkProgram, programRow } from "../../shared/programs";
import { getAdminClient, getCaller, json, ID_PATTERN, isSetupProblem } from "../../shared/serverAuth";

// This code runs on the server only.
export const dynamic = "force-dynamic";

export const PROGRAMS_SETUP_MESSAGE =
  "Programs are not set up yet. Run the program SQL once in Supabase (SQL Editor), then try again.";

const setupProblem = () => json({ error: PROGRAMS_SETUP_MESSAGE, setupNeeded: true }, 503);

// Who is asking, and which group are they in?
async function whoIsAsking(request) {
  const admin = getAdminClient();
  if (!admin) {
    return {
      response: json(
        { error: "The server is not set up for this yet. Add SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL in Vercel, then redeploy." },
        500
      )
    };
  }
  const caller = await getCaller(request, admin);
  if (!caller) return { response: json({ error: "Please sign in again." }, 401) };
  let groupId = null;
  const m = await admin.from("user_group_members").select("group_id").eq("user_id", caller.user.id).maybeSingle();
  if (!m.error && m.data) groupId = m.data.group_id;
  return { admin, caller, groupId };
}

function visible(program, callerId, groupId, isOwnerOfApp) {
  if (program.owner_id === callerId) return true;
  if (isOwnerOfApp) return true;
  if (program.share_scope === "everyone") return true;
  if (program.share_scope === "group" && groupId && program.group_id === groupId) return true;
  return false;
}

const forList = (p, callerId) => ({
  id: p.id,
  name: p.name,
  notes: p.notes || "",
  items: Array.isArray(p.items) ? p.items : [],
  shareScope: p.share_scope,
  groupId: p.group_id || null,
  ownerName: p.owner_name || "",
  mine: p.owner_id === callerId,
  updatedAt: p.updated_at || p.created_at || null
});

// The programs this person may see: their own, plus the ones shared with them.
export async function GET(request) {
  try {
    const { admin, caller, groupId, response } = await whoIsAsking(request);
    if (response) return response;

    const { data, error } = await admin
      .from("workout_programs")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return isSetupProblem(error) ? setupProblem() : json({ error: "Could not load the programs." }, 500);

    const programs = (data || [])
      .filter((p) => visible(p, caller.user.id, groupId, caller.isOwner))
      .map((p) => forList(p, caller.user.id));

    // group names, so the page can say "shared with Team A"
    let groups = [];
    const g = await admin.from("user_groups").select("id, name").order("name", { ascending: true });
    if (!g.error) groups = g.data || [];

    return json({
      programs,
      groups,
      myGroupId: groupId,
      groupsReady: !g.error,
      canWrite: caller.can("programs.write"),
      canShare: caller.can("programs.share")
    });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Create a program
export async function POST(request) {
  try {
    const { admin, caller, response } = await whoIsAsking(request);
    if (response) return response;
    if (!caller.can("programs.write")) {
      return json({ error: "You do not have permission to write programs." }, 403);
    }
    const body = await request.json().catch(() => ({}));
    const problem = checkProgram(body);
    if (problem) return json({ error: problem }, 400);

    const row = programRow(body);
    if (row.share_scope !== "private" && !caller.can("programs.share")) {
      return json({ error: "You do not have permission to share programs." }, 403);
    }
    if (row.share_scope === "group" && !ID_PATTERN.test(String(row.group_id || ""))) {
      return json({ error: "Please choose which group to share with." }, 400);
    }
    if (row.share_scope !== "group") row.group_id = null;

    const { data, error } = await admin
      .from("workout_programs")
      .insert({
        ...row,
        owner_id: caller.user.id,
        owner_name: (caller.user.user_metadata && caller.user.user_metadata.full_name) || caller.user.email || ""
      })
      .select("*")
      .single();
    if (error) return isSetupProblem(error) ? setupProblem() : json({ error: "Could not save the program." }, 500);
    return json({ ok: true, program: forList(data, caller.user.id) });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Change a program (only the person who wrote it)
export async function PATCH(request) {
  try {
    const { admin, caller, response } = await whoIsAsking(request);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown program." }, 400);

    const found = await admin.from("workout_programs").select("*").eq("id", id).maybeSingle();
    if (found.error) return isSetupProblem(found.error) ? setupProblem() : json({ error: "Could not load the program." }, 500);
    if (!found.data) return json({ error: "That program was not found." }, 404);
    if (found.data.owner_id !== caller.user.id) {
      return json({ error: "Only the person who wrote this program can change it." }, 403);
    }

    const problem = checkProgram(body);
    if (problem) return json({ error: problem }, 400);
    const row = programRow(body);
    if (row.share_scope !== "private" && !caller.can("programs.share")) {
      return json({ error: "You do not have permission to share programs." }, 403);
    }
    if (row.share_scope === "group" && !ID_PATTERN.test(String(row.group_id || ""))) {
      return json({ error: "Please choose which group to share with." }, 400);
    }
    if (row.share_scope !== "group") row.group_id = null;

    const { data, error } = await admin
      .from("workout_programs")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return json({ error: "Could not save the program." }, 500);
    return json({ ok: true, program: forList(data, caller.user.id) });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

// Delete a program (the person who wrote it, or the owner of the app)
export async function DELETE(request) {
  try {
    const { admin, caller, response } = await whoIsAsking(request);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!ID_PATTERN.test(id)) return json({ error: "Unknown program." }, 400);

    const found = await admin.from("workout_programs").select("*").eq("id", id).maybeSingle();
    if (found.error) return isSetupProblem(found.error) ? setupProblem() : json({ error: "Could not load the program." }, 500);
    if (!found.data) return json({ error: "That program was not found." }, 404);
    if (found.data.owner_id !== caller.user.id && !caller.isOwner) {
      return json({ error: "Only the person who wrote this program can delete it." }, 403);
    }

    const { error } = await admin.from("workout_programs").delete().eq("id", id);
    if (error) return json({ error: "Could not delete the program." }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
