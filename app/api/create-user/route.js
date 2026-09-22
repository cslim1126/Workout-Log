import { checkProfile, profileMetadata } from "../../shared/profileFields";
import { getAdminClient, getCaller, requirePermission, json } from "../../shared/serverAuth";

// This code runs on the server only. The secret key never goes to the browser.
export const dynamic = "force-dynamic";

// Used by the menu to decide what to show: owner = the person in ADMIN_EMAIL,
// permissions = what their role lets them do.
export async function GET(request) {
  try {
    const admin = getAdminClient();
    if (!admin) return json({ isOwner: false, permissions: [], roleName: "" });
    const caller = await getCaller(request, admin);
    if (!caller) return json({ isOwner: false, permissions: [], roleName: "" });
    return json({
      isOwner: caller.isOwner,
      permissions: caller.permissions,
      roleName: caller.role ? caller.role.name : ""
    });
  } catch (e) {
    return json({ isOwner: false, permissions: [], roleName: "" });
  }
}

export async function POST(request) {
  try {
    const { admin, response } = await requirePermission(request, "users.create", "create users");
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid email." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "The password must be at least 6 characters." }, 400);
    }

    // Every profile field is compulsory (checked here again, so it cannot be skipped).
    // The server clock can be a day ahead of yours, so allow one extra day for the date check.
    const latestDob = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const profileProblem = checkProfile(body.profile, latestDob);
    if (profileProblem) {
      return json({ error: profileProblem }, 400);
    }

    // email_confirm: true means the person can sign in right away (no email is sent).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: profileMetadata(body.profile)
    });
    if (error) {
      return json({ error: error.message }, 400);
    }
    return json({ ok: true, email: data.user.email });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
