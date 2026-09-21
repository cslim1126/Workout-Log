// Server-only helpers (never import this file from a page).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const NOT_SET_UP =
  "The server is not set up for this yet. Add SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL in Vercel, then redeploy.";

export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const json = (body, status = 200) => NextResponse.json(body, { status });

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function isOwnerEmail(email) {
  const owner = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(owner) && Boolean(email) && email.toLowerCase() === owner;
}

// "owner" (email saved in ADMIN_EMAIL), "admin" (role given by the owner) or "member".
// The role is kept in app_metadata, which a person cannot change for themselves.
export function roleOf(user) {
  if (isOwnerEmail(user.email)) return "owner";
  return user.app_metadata && user.app_metadata.role === "admin" ? "admin" : "member";
}

// Works out who is asking. Returns null if the token is missing or not valid.
export async function getCaller(request, admin) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user || !data.user.email) return null;
  const role = roleOf(data.user);
  return { user: data.user, role, isOwner: role === "owner", canManage: role === "owner" || role === "admin" };
}

// For routes that only the owner and admins may use.
// Returns { admin, caller } or { response } (an error to send back).
export async function requireManager(request, who = "manage users") {
  const admin = getAdminClient();
  if (!admin) return { response: json({ error: NOT_SET_UP }, 500) };
  const caller = await getCaller(request, admin);
  if (!caller || !caller.canManage) {
    return { response: json({ error: `Only the owner and admins can ${who}.` }, 403) };
  }
  return { admin, caller };
}

// True when the two group tables have not been created yet (or are not allowed).
export function isSetupProblem(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    ["PGRST205", "PGRST204", "42P01", "42501"].includes(code) ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("permission denied")
  );
}

export const GROUPS_SETUP_MESSAGE =
  "Groups are not set up yet. Run the group SQL once in Supabase (SQL Editor), then try again.";
