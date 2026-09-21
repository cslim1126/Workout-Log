"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

// Dates use your own time zone (not UTC), so "today" is correct
// even early in the morning.
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDate(d) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d === localDateStr()) return "Today";
  if (d === localDateStr(yesterday)) return "Yesterday";
  return d;
}

export default function LogPage() {
  return <AppShell>{({ user }) => <WorkoutHistory user={user} />}</AppShell>;
}

function WorkoutHistory({ user }) {
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  const [logCategory, setLogCategory] = useState("");
  const [logExercise, setLogExercise] = useState("");
  const [logDate, setLogDate] = useState(localDateStr());
  const [logWeight, setLogWeight] = useState("");
  const [logSets, setLogSets] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logRest, setLogRest] = useState("");
  const [logRemark, setLogRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [cats, exs, logs] = await Promise.all([
      supabase.from("categories").select("*").order("created_at", { ascending: true }),
      supabase.from("exercises").select("*").order("created_at", { ascending: true }),
      supabase
        .from("logs")
        .select("*")
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500)
    ]);
    const firstError = cats.error || exs.error || logs.error;
    if (firstError) setError(firstError.message);
    setCategories(cats.data || []);
    setExercises(exs.data || []);
    setEntries(logs.data || []);
  }

  // keep the category drop-down valid once categories load
  useEffect(() => {
    if (!categories.length) {
      setLogCategory("");
      return;
    }
    if (!categories.some((c) => c.name === logCategory)) {
      setLogCategory(categories[0].name);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const exercisesInLogCategory = useMemo(
    () => exercises.filter((e) => e.category_name === logCategory),
    [exercises, logCategory]
  );

  useEffect(() => {
    if (!exercisesInLogCategory.length) {
      setLogExercise("");
      return;
    }
    if (!exercisesInLogCategory.some((e) => e.name === logExercise)) {
      setLogExercise(exercisesInLogCategory[0].name);
    }
  }, [exercisesInLogCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!logCategory || !logExercise || !logSets || !logReps) return;
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.from("logs").insert({
      user_id: user.id,
      category_name: logCategory,
      exercise_name: logExercise,
      log_date: logDate,
      weight: logWeight ? Number(logWeight) : null,
      sets: Number(logSets),
      reps: Number(logReps),
      rest: logRest ? Number(logRest) : null,
      remark: logRemark.trim() || null
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setLogWeight("");
    setLogSets("");
    setLogReps("");
    setLogRest("");
    setLogRemark("");
    loadAll();
  }

  async function deleteEntry(id) {
    setError("");
    const { error: err } = await supabase.from("logs").delete().eq("id", id);
    if (err) setError(err.message);
    loadAll();
  }

  const groupedEntries = useMemo(() => {
    const groups = {};
    for (const e of entries) {
      (groups[e.log_date] = groups[e.log_date] || []).push(e);
    }
    return Object.keys(groups).sort().reverse().map((date) => ({ date, items: groups[date] }));
  }, [entries]);

  return (
    <>
      <div className="card">
        <h2>Log a set</h2>
        <form onSubmit={handleAddEntry}>
          <div className="grid">
            <div className="field">
              <label>Category</label>
              <select value={logCategory} onChange={(e) => setLogCategory(e.target.value)} disabled={!categories.length}>
                {categories.length === 0
                  ? <option value="">No categories yet</option>
                  : categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Exercise</label>
              <select value={logExercise} onChange={(e) => setLogExercise(e.target.value)} disabled={!exercisesInLogCategory.length}>
                {exercisesInLogCategory.length === 0
                  ? <option value="">No exercises in this category yet</option>
                  : exercisesInLogCategory.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Weight (kg, optional)</label>
              <input type="number" step="0.5" min="0" placeholder="—" value={logWeight} onChange={(e) => setLogWeight(e.target.value)} />
            </div>
            <div className="field">
              <label>Sets</label>
              <input type="number" min="1" step="1" placeholder="3" value={logSets} onChange={(e) => setLogSets(e.target.value)} required />
            </div>
            <div className="field">
              <label>Reps per set</label>
              <input type="number" min="1" step="1" placeholder="10" value={logReps} onChange={(e) => setLogReps(e.target.value)} required />
            </div>
            <div className="field full">
              <label>Rest between sets (seconds)</label>
              <input type="number" min="0" step="5" placeholder="60" value={logRest} onChange={(e) => setLogRest(e.target.value)} />
            </div>
            <div className="field full">
              <label>Remark</label>
              <textarea placeholder="Optional notes" value={logRemark} onChange={(e) => setLogRemark(e.target.value)} />
            </div>
          </div>
          {(!categories.length || !exercisesInLogCategory.length) && (
            <div className="notice">
              Create a category and an exercise before logging. Use{" "}
              <Link href="/categories">Create Category</Link> and{" "}
              <Link href="/exercises">Add Exercise</Link> in the menu.
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div className="row-actions">
            <button type="submit" className="primary" disabled={submitting || !categories.length || !exercisesInLogCategory.length}>
              {submitting ? "Adding…" : "Add entry"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Workout History</h2>
        {groupedEntries.length === 0 && <div className="empty">No entries yet.</div>}
        {groupedEntries.map((group) => (
          <div className="day-group" key={group.date}>
            <div className="day-header">{fmtDate(group.date)}</div>
            {group.items.map((e) => (
              <div className="entry" key={e.id}>
                <div>
                  <div className="name">
                    {e.exercise_name}
                    {e.category_name && <span className="badge">{e.category_name}</span>}
                  </div>
                  <div className="meta">
                    {e.weight ? `${e.weight}kg × ` : ""}{e.sets} sets × {e.reps} reps
                    {e.rest ? ` · rest ${e.rest}s` : ""}
                  </div>
                  {e.remark && <div className="remark">{e.remark}</div>}
                </div>
                <button className="ghost" onClick={() => deleteEntry(e.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
