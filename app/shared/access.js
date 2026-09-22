// Groups: the two small tables that let you put people into groups.

// Run this once in Supabase (SQL Editor -> New query -> paste -> Run).
export const GROUPS_SQL = `create table if not exists public.user_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_groups_name_key on public.user_groups (lower(name));

create table if not exists public.user_group_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid not null references public.user_groups(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Only the server (with the secret key) can read or change these two tables.
alter table public.user_groups enable row level security;
alter table public.user_group_members enable row level security;
grant all on public.user_groups to service_role;
grant all on public.user_group_members to service_role;`;
