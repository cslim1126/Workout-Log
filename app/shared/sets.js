// Per-set workout details. Shared by Log a Set, Workout History and the Dashboard.

export const MAX_SETS = 20;

// Run this once in Supabase (SQL Editor -> New query -> paste -> Run).
export const SET_DETAILS_SQL = "alter table public.logs add column if not exists set_details jsonb;";

export function emptySet() {
  return { reps: "", weight: "", rest: "", remark: "" };
}

// Keep what was typed, add empty sets or drop the extra ones.
export function resizeSets(rows, n) {
  const out = rows.slice(0, n);
  while (out.length < n) out.push(emptySet());
  return out;
}

const isWhole = (s) => /^\d+$/.test(s);
const isNumber = (s) => /^(\d+\.?\d*|\.\d+)$/.test(s);

// Checks what the person typed for every set.
// Returns { error } or { details } (clean numbers, ready to save).
export function checkSets(rows) {
  const details = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const label = `Set ${i + 1}`;
    const reps = String(r.reps == null ? "" : r.reps).trim();
    const weight = String(r.weight == null ? "" : r.weight).trim();
    const rest = String(r.rest == null ? "" : r.rest).trim();
    const remark = String(r.remark == null ? "" : r.remark).trim();

    if (!reps) return { error: `${label}: please enter the reps.` };
    if (!isWhole(reps) || Number(reps) < 1 || Number(reps) > 999) {
      return { error: `${label}: reps must be a whole number from 1 to 999.` };
    }
    if (weight && (!isNumber(weight) || Number(weight) > 1000)) {
      return { error: `${label}: weight must be a number from 0 to 1000 kg.` };
    }
    if (rest && (!isWhole(rest) || Number(rest) > 3600)) {
      return { error: `${label}: rest must be a whole number of seconds, from 0 to 3600.` };
    }
    if (remark.length > 200) {
      return { error: `${label}: the remark is too long (200 letters at most).` };
    }
    details.push({
      reps: Number(reps),
      weight: weight ? Number(weight) : null,
      rest: rest ? Number(rest) : null,
      remark: remark || null
    });
  }
  return { details };
}

// The row that is saved in the "logs" table. The old columns copy the first set,
// so older screens still show something sensible. set_details has every set.
export function logRowFromDetails(details) {
  const first = details[0];
  return {
    sets: details.length,
    reps: first.reps,
    weight: first.weight,
    rest: first.rest,
    remark: first.remark,
    set_details: details
  };
}

// True for entries saved with a line for every set.
export function hasSetDetails(log) {
  return Array.isArray(log.set_details) && log.set_details.length > 0;
}

// Every set of an entry. Older entries ("3 sets x 10 reps") count as
// the same numbers repeated for each set.
export function expandSets(log) {
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  if (hasSetDetails(log)) {
    return log.set_details.map((s) => ({
      reps: Number(s.reps) || 0,
      weight: num(s.weight),
      rest: num(s.rest),
      remark: s.remark || ""
    }));
  }
  const n = Number(log.sets) || 0;
  return Array.from({ length: n }, () => ({
    reps: Number(log.reps) || 0,
    weight: num(log.weight),
    rest: num(log.rest),
    remark: ""
  }));
}

// weight x reps, added up over all sets
export function logVolume(log) {
  return expandSets(log).reduce((sum, s) => sum + (s.weight || 0) * s.reps, 0);
}

export function totalReps(log) {
  return expandSets(log).reduce((sum, s) => sum + s.reps, 0);
}
