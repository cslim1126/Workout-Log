// Custom roles: a role is a name plus a set of ticked permissions.
// The owner of the app (the email in ADMIN_EMAIL) always has every permission.

export const PERMISSIONS = [
  { key: "users.create", label: "Create users", help: "Open the Create User page and make accounts for other people." },
  { key: "users.remove", label: "Remove users", help: "Delete an account and all of that person's workout data." },
  { key: "roles.manage", label: "Manage roles", help: "Create roles, tick permissions, and give a role to a person. This is powerful: it lets them give themselves anything." },
  { key: "groups.manage", label: "Manage groups", help: "Add, rename and delete groups, and put people into them." },
  { key: "programs.write", label: "Write programs", help: "Write, edit and delete their own workout programs." },
  { key: "programs.share", label: "Share programs", help: "Share a program with a group or with everyone." },
  { key: "history.view", label: "See other users' workout history", help: "Open anyone's Workout History, read only." }
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export const PERMISSION_LABELS = PERMISSIONS.reduce((m, p) => ({ ...m, [p.key]: p.label }), {});

// Anything on this page needs one of these.
export const MANAGE_KEYS = ["users.create", "users.remove", "roles.manage", "groups.manage"];

// Run this once in Supabase (SQL Editor -> New query -> paste -> Run).
export const ROLES_SQL = `create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists user_roles_name_key on public.user_roles (lower(name));

-- Only the server (with the secret key) can read or change this table.
alter table public.user_roles enable row level security;
grant all on public.user_roles to service_role;`;

// The roles that are made for you the first time the page is opened.
export const STARTER_ROLES = [
  { name: "Super Admin", permissions: ["users.create", "users.remove", "roles.manage", "groups.manage", "programs.write", "programs.share", "history.view"] },
  { name: "Admin", permissions: ["users.create", "groups.manage", "programs.write", "programs.share", "history.view"] },
  { name: "Coach", permissions: ["programs.write", "programs.share", "history.view"] },
  { name: "Member", permissions: [] }
];

export function cleanPermissions(list) {
  const arr = Array.isArray(list) ? list : [];
  return PERMISSION_KEYS.filter((k) => arr.includes(k));
}

export function cleanRoleName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function checkRoleName(name) {
  if (!name) return "Please enter a role name.";
  if (name.length > 40) return "The role name is too long (40 characters at most).";
  return "";
}

// What one person is allowed to do.
export function permissionsFor(user, rolesById, isOwner) {
  if (isOwner) return PERMISSION_KEYS.slice();
  const meta = (user && user.app_metadata) || {};
  const role = meta.role_id ? rolesById[meta.role_id] : null;
  if (role) return cleanPermissions(role.permissions);
  // Accounts made before roles existed: the old "admin" flag still works.
  if (meta.role === "admin") return ["users.create", "groups.manage", "programs.write", "programs.share", "history.view"];
  return [];
}

export const can = (permissions, key) => Array.isArray(permissions) && permissions.includes(key);
export const canAny = (permissions, keys) => keys.some((k) => can(permissions, k));
