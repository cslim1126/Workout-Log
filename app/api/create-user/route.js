import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkProfile, profileMetadata } from "../../shared/profileFields";

// This code runs on the server only. The secret key never goes to the browser.
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// True only if the person who sent the request is signed in
// with the email saved in ADMIN_EMAIL.
async function isOwner(request, admin) {
  const ownerEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!ownerEmail || !token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user || !data.user.email) return false;
  return data.user.email.toLowerCase() === ownerEmail;
}

// Used by the menu bar to decide if "Create User" should be shown.
export async function GET(request) {
  try {
    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ isOwner: false });
    return NextResponse.json({ isOwner: await isOwner(request, admin) });
  } catch (e) {
    return NextResponse.json({ isOwner: false });
  }
}

export async function POST(request) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "The server is not set up for this yet. Add SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL in Vercel, then redeploy."
        },
        { status: 500 }
      );
    }
    if (!(await isOwner(request, admin))) {
      return NextResponse.json({ error: "Only the owner can create users." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "The password must be at least 6 characters." }, { status: 400 });
    }

    // Every profile field is compulsory (checked here again, so it cannot be skipped).
    // The server clock can be a day ahead of yours, so allow one extra day for the date check.
    const latestDob = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const profileProblem = checkProfile(body.profile, latestDob);
    if (profileProblem) {
      return NextResponse.json({ error: profileProblem }, { status: 400 });
    }

    // email_confirm: true means the person can sign in right away (no email is sent).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: profileMetadata(body.profile)
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, email: data.user.email });
  } catch (e) {
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
