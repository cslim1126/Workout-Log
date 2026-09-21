-- Run this once in Supabase: Project -> SQL Editor -> New Query -> paste -> Run

create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  category_name text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_name text,
  exercise_name text not null,
  log_date date not null,
  weight numeric,
  sets integer not null,
  reps integer not null,
  rest integer,
  remark text,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table exercises enable row level security;
alter table logs enable row level security;

-- Each user can only see and edit their own rows.
create policy "own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own exercises" on exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own logs" on logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists exercises_category_idx on exercises(category_id);
create index if not exists logs_date_idx on logs(user_id, log_date desc);
