// Workout programs: a plan someone writes and shares, so other people
// can follow it and key in what they actually did.

export const MAX_ITEMS = 40;
export const SHARE_SCOPES = ["private", "group", "everyone"];
export const SHARE_LABELS = {
  private: "Only me",
  group: "My group",
  everyone: "Everyone"
};

// Run this once in Supabase (SQL Editor -> New query -> paste -> Run).
export const PROGRAMS_SQL = `create table if not exists public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  name text not null,
  notes text,
  items jsonb not null default '[]'::jsonb,
  share_scope text not null default 'private',
  group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the server (with the secret key) can read or change this table.
alter table public.workout_programs enable row level security;
grant all on public.workout_programs to service_role;`;

export function emptyItem() {
  return { category: "", exercise: "", sets: "", reps: "", weight: "", rest: "", rir: "", notes: "" };
}

const text = (v) => (v === null || v === undefined ? "" : String(v).trim().replace(/\s+/g, " "));

export function cleanItem(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    category: text(r.category),
    exercise: text(r.exercise),
    sets: text(r.sets),
    reps: text(r.reps),
    weight: text(r.weight),
    rest: text(r.rest),
    rir: text(r.rir),
    notes: text(r.notes)
  };
}

// Returns a message if something is wrong, or "" if the program is fine.
export function checkProgram(raw) {
  const name = text(raw && raw.name);
  if (!name) return "Please enter a program name.";
  if (name.length > 60) return "The program name is too long (60 characters at most).";
  if (text(raw && raw.notes).length > 500) return "The program notes are too long (500 characters at most).";

  const scope = text(raw && raw.shareScope) || "private";
  if (!SHARE_SCOPES.includes(scope)) return "Please choose who can see this program.";

  const items = Array.isArray(raw && raw.items) ? raw.items.map(cleanItem) : [];
  const filled = items.filter((i) => i.exercise || i.sets || i.reps || i.weight || i.rest || i.rir || i.notes || i.category);
  if (filled.length === 0) return "Please add at least one exercise.";
  if (filled.length > MAX_ITEMS) return `A program can have ${MAX_ITEMS} exercises at most.`;

  for (let i = 0; i < filled.length; i++) {
    const it = filled[i];
    const where = `Row ${i + 1}`;
    if (!it.exercise) return `${where}: please enter the exercise.`;
    if (it.exercise.length > 60) return `${where}: the exercise name is too long (60 characters at most).`;
    if (it.category.length > 60) return `${where}: the category is too long (60 characters at most).`;
    if (!it.sets) return `${where}: please enter how many sets.`;
    if (!/^\d+$/.test(it.sets) || Number(it.sets) < 1 || Number(it.sets) > 20) {
      return `${where}: sets must be a whole number from 1 to 20.`;
    }
    if (!it.reps) return `${where}: please enter the reps.`;
    if (it.reps.length > 20) return `${where}: the reps are too long (20 characters at most).`;
    if (it.weight.length > 20) return `${where}: the weight is too long (20 characters at most).`;
    if (it.rest.length > 20) return `${where}: the rest is too long (20 characters at most).`;
    if (it.rir.length > 10) return `${where}: the RIR is too long (10 characters at most).`;
    if (it.notes.length > 200) return `${where}: the notes are too long (200 characters at most).`;
  }
  return "";
}

// What gets saved in the database.
export function programRow(raw) {
  const items = (Array.isArray(raw.items) ? raw.items : []).map(cleanItem);
  return {
    name: text(raw.name),
    notes: text(raw.notes) || null,
    share_scope: text(raw.shareScope) || "private",
    group_id: raw.groupId || null,
    items: items
      .filter((i) => i.exercise || i.sets || i.reps || i.weight || i.rest || i.rir || i.notes || i.category)
      .map((i) => ({ ...i, sets: Number(i.sets) }))
  };
}

// "90s" -> 90, "90" -> 90, "30-60s" -> "" (a range, so it is left blank)
export function firstNumber(value) {
  const s = String(value == null ? "" : value).trim();
  const m = /^(\d+)\s*(s|sec|secs|seconds)?$/i.exec(s);
  return m ? m[1] : "";
}

// "Target: 4 sets × 12 reps · 60 kg · rest 90s · RIR 2"
export function targetLine(item) {
  if (!item) return "";
  const bits = [`${item.sets} ${Number(item.sets) === 1 ? "set" : "sets"} × ${item.reps} reps`];
  if (item.weight) bits.push(`${item.weight} kg`);
  if (item.rest) bits.push(`rest ${item.rest}`);
  if (item.rir) bits.push(`RIR ${item.rir}`);
  return bits.join(" · ");
}
