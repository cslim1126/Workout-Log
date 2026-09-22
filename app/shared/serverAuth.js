// Server-only helpers (never import this file from a page).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { permissionsFor } from "./permissions";

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

// The roles the owner has written, as { id: role }. Missing table = no roles yet.
export async function loadRoles(admin) {
  const { data, error } = await admin.from("user_roles").select("id, name, permissions").order("name", { ascending: true });
  if (error) return { roles: [], byId: {}, ready: false, message: error.message || "" };
  const roles = (data || []).map((r) => ({ id: r.id, name: r.name, permissions: Array.isArray(r.permissions) ? r.permissions : [] }));
  const byId = {};
  for (const r of roles) byId[r.id] = r;
  return { roles, byId, ready: true, message: "" };
}

// Works out who is asking and what they may do.
// Returns null if the token is missing or not valid.
export async function getCaller(request, admin) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user || !data.user.email) return null;
  const user = data.user;
  const isOwner = isOwnerEmail(user.email);
  const { roles, byId, ready } = await loadRoles(admin);
  const permissions = permissionsFor(user, byId, isOwner);
  const meta = user.app_metadata || {};
  const role = isOwner ? { id: "", name: "Owner" } : byId[meta.role_id] || null;
  return {
    user,
    isOwner,
    permissions,
    role,
    roles,
    rolesById: byId,
    rolesReady: ready,
    can: (key) => isOwner || permissions.includes(key)
  };
}

// For routes that need one particular permission.
// Returns { admin, caller } or { response } (an error to send back).
export async function requirePermission(request, key, who = "do this") {
  const admin = getAdminClient();
  if (!admin) return { response: json({ error: NOT_SET_UP }, 500) };
  const caller = await getCaller(request, admin);
  if (!caller) return { response: json({ error: "Please sign in again." }, 401) };
  if (!caller.can(key)) {
    return { response: json({ error: `You do not have permission to ${who}.` }, 403) };
  }
  return { admin, caller };
}

// For the User Access page: any one of several permissions is enough.
export async function requireAnyPermission(request, keys, who = "manage users") {
  const admin = getAdminClient();
  if (!admin) return { response: json({ error: NOT_SET_UP }, 500) };
  const caller = await getCaller(request, admin);
  if (!caller) return { response: json({ error: "Please sign in again." }, 401) };
  if (!keys.some((k) => caller.can(k))) {
    return { response: json({ error: `You do not have permission to ${who}.` }, 403) };
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
