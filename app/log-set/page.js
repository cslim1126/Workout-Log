"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import { MAX_SETS, SET_DETAILS_SQL, emptySet, resizeSets, checkSets, logRowFromDetails } from "../shared/sets";

// Dates use your own time zone (not UTC), so "today" is correct early in the morning.
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LogSetPage() {
  return <AppShell>{({ user }) => <LogSet user={user} />}</AppShell>;
}

function LogSet({ user }) {
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [logCategory, setLogCategory] = useState("");
  const [logExercise, setLogExercise] = useState("");
  const [logDate, setLogDate] = useState(todayStr());
  const [setsInput, setSetsInput] = useState("");
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const [cats, exs] = await Promise.all([
        supabase.from("categories").select("*").order("created_at", { ascending: true }),
        supabase.from("exercises").select("*").order("created_at", { ascending: true })
      ]);
      const firstError = cats.error || exs.error;
      if (firstError) setError(firstError.message);
      setCategories(cats.data || []);
      setExercises(exs.data || []);

      // Is the database ready to save one line per set?
      const probe = await supabase.from("logs").select("set_details").limit(1);
      if (probe.error && /set_details/i.test(probe.error.message || "")) setNeedsSetup(true);
    })();
  }, []);

  // keep the category box valid once categories load
  useEffect(() => {
    if (!categories.length) {
      setLogCategory("");
      return;
    }
    if (!categories.some((c) => c.name === logCategory)) setLogCategory(categories[0].name);
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const exercisesInCategory = useMemo(
    () => exercises.filter((e) => e.category_name === logCategory),
    [exercises, logCategory]
  );

  useEffect(() => {
    if (!exercisesInCategory.length) {
      setLogExercise("");
      return;
    }
    if (!exercisesInCategory.some((e) => e.name === logExercise)) setLogExercise(exercisesInCategory[0].name);
  }, [exercisesInCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // How many sets? (a box appears for every set)
  const typed = setsInput.trim();
  const count = /^\d+$/.test(typed) ? parseInt(typed, 10) : 0;
  const showN = count >= 1 && count <= MAX_SETS ? count : 0;

  function changeSetsCount(value) {
    setSetsInput(value);
    setSuccess("");
    const t = value.trim();
    const n = /^\d+$/.test(t) ? parseInt(t, 10) : 0;
    if (n >= 1 && n <= MAX_SETS) setRows((r) => resizeSets(r, n));
  }

  function changeRow(index, key, value) {
    setSuccess("");
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function copyFirstToAll() {
    setRows((r) =>
      r.map((row, i) => (i === 0 ? row : { ...row, reps: r[0].reps, weight: r[0].weight, rest: r[0].rest }))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!logCategory || !logExercise) return setError("Please choose a category and an exercise.");
    if (!logDate) return setError("Please choose a date.");
    if (!showN) return setError(`Please enter how many sets (1 to ${MAX_SETS}).`);
    const checked = checkSets(rows.slice(0, showN));
    if (checked.error) return setError(checked.error);

    setSubmitting(true);
    const { error: err } = await supabase.from("logs").insert({
      user_id: user.id,
      category_name: logCategory,
      exercise_name: logExercise,
      log_date: logDate,
      ...logRowFromDetails(checked.details)
    });
    setSubmitting(false);
    if (err) {
      if (/set_details/i.test(err.message || "")) setNeedsSetup(true);
      else setError(err.message);
      return;
    }
    setRows(resizeSets([], showN)); // empty boxes, same number of sets
    setSuccess(`Saved ${showN} ${showN === 1 ? "set" : "sets"} of ${logExercise}.`);
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SET_DETAILS_SQL);
      setCopied(true);
    } catch (e) {
      setCopied(false);
    }
  }

  const noExercises = !categories.length || !exercisesInCategory.length;

  return (
    <div className="card">
      <h2>Log a Set</h2>

      {needsSetup && (
        <div className="setup-box">
          <div className="notice" style={{ marginTop: 0 }}>
            One-time setup needed. In Supabase, open <b>SQL Editor</b> → <b>New query</b>, paste this line, click <b>Run</b>, then refresh this page (F5).
          </div>
          <pre className="sql-box">{SET_DETAILS_SQL}</pre>
          <button type="button" className="small" onClick={copySql}>{copied ? "Copied ✓" : "Copy SQL"}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid">
          <div className="field">
            <label htmlFor="ls-category">Category</label>
            <select id="ls-category" value={logCategory} onChange={(e) => setLogCategory(e.target.value)} disabled={!categories.length}>
              {categories.length === 0
                ? <option value="">No categories yet</option>
                : categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ls-exercise">Exercise</label>
            <select id="ls-exercise" value={logExercise} onChange={(e) => setLogExercise(e.target.value)} disabled={!exercisesInCategory.length}>
              {exercisesInCategory.length === 0
                ? <option value="">No exercises in this category yet</option>
                : exercisesInCategory.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ls-date">Date</label>
            <input id="ls-date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ls-sets">How many sets?</label>
            <input
              id="ls-sets"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_SETS}
              step="1"
              placeholder="e.g. 3"
              value={setsInput}
              onChange={(e) => changeSetsCount(e.target.value)}
            />
          </div>
        </div>

        {noExercises && (
          <div className="notice">
            Create a category and an exercise first. Go to{" "}
            <Link href="/exercises">Create Exercise</Link> in the menu.
          </div>
        )}

        {!showN && (
          <div className="notice">
            Type how many sets you did (1 to {MAX_SETS}). A box will appear for each set, so you can enter its reps, rest, weight and remark.
          </div>
        )}

        {rows.slice(0, showN).map((row, i) => (
          <div className="set-form-row" key={i}>
            <div className="set-form-title">Set {i + 1}</div>
            <div className="set-fields">
              <div className="field">
                <label htmlFor={`set-${i}-reps`}>Reps</label>
                <input id={`set-${i}-reps`} type="number" inputMode="numeric" min="1" step="1" value={row.reps} onChange={(e) => changeRow(i, "reps", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`set-${i}-rest`}>Rest (seconds)</label>
                <input id={`set-${i}-rest`} type="number" inputMode="numeric" min="0" step="5" placeholder="60" value={row.rest} onChange={(e) => changeRow(i, "rest", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`set-${i}-weight`}>Weight (kg)</label>
                <input id={`set-${i}-weight`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="—" value={row.weight} onChange={(e) => changeRow(i, "weight", e.target.value)} />
              </div>
              <div className="field wide">
                <label htmlFor={`set-${i}-remark`}>Remark</label>
                <input id={`set-${i}-remark`} type="text" maxLength={200} placeholder="Optional notes" value={row.remark} onChange={(e) => changeRow(i, "remark", e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        {showN >= 2 && (
          <button type="button" className="small" onClick={copyFirstToAll}>Copy Set 1 to all sets</button>
        )}

        {error && <div className="error">{error}</div>}
        {success && (
          <div className="success">✓ {success} <Link href="/log">See Workout History</Link></div>
        )}
        <div className="row-actions">
          <button type="submit" className="primary" disabled={submitting || needsSetup || noExercises}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
