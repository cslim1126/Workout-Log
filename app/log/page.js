"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  const today = todayStr();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d === today) return "Today";
  if (d === y) return "Yesterday";
  return d;
}

export default function LogPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [entries, setEntries] = useState([]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");

  const [logCategory, setLogCategory] = useState("");
  const [logExercise, setLogExercise] = useState("");
  const [logDate, setLogDate] = useState(todayStr());
  const [logWeight, setLogWeight] = useState("");
  const [logSets, setLogSets] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logRest, setLogRest] = useState("");
  const [logRemark, setLogRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---- auth guard + initial load ----
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUser(data.session.user);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  async function loadAll() {
    const [{ data: cats }, { data: exs }, { data: logs }] = await Promise.all([
      supabase.from("categories").select("*").order("created_at", { ascending: true }),
      supabase.from("exercises").select("*").order("created_at", { ascending: true }),
      supabase.from("logs").select("*").order("log_date", { ascending: false }).order("created_at", { ascending: false }).limit(500)
    ]);
    setCategories(cats || []);
    setExercises(exs || []);
    setEntries(logs || []);
  }

  // keep the log-category select valid once categories load
  useEffect(() => {
    if (!categories.length) { setLogCategory(""); return; }
    if (!categories.some((c) => c.name === logCategory)) {
      setLogCategory(categories[0].name);
    }
    if (!newExerciseCategory || !categories.some((c) => c.name === newExerciseCategory)) {
      setNewExerciseCategory(categories[0].name);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const exercisesInLogCategory = useMemo(
    () => exercises.filter((e) => e.category_name === logCategory),
    [exercises, logCategory]
  );

  useEffect(() => {
    if (!exercisesInLogCategory.length) { setLogExercise(""); return; }
    if (!exercisesInLogCategory.some((e) => e.name === logExercise)) {
      setLogExercise(exercisesInLogCategory[0].name);
    }
  }, [exercisesInLogCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ---- categories ----
  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name || categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const { error } = await supabase.from("categories").insert({ name, user_id: user.id });
    if (!error) { setNewCategoryName(""); loadAll(); }
  }
  async function deleteCategory(id) {
    await supabase.from("categories").delete().eq("id", id);
    loadAll();
  }

  // ---- exercises ----
  async function addExercise() {
    const name = newExerciseName.trim();
    if (!name || !newExerciseCategory) return;
    if (exercises.some((e) => e.category_name === newExerciseCategory && e.name.toLowerCase() === name.toLowerCase())) return;
    const category = categories.find((c) => c.name === newExerciseCategory);
    const { error } = await supabase.from("exercises").insert({
      name,
      category_name: newExerciseCategory,
      category_id: category ? category.id : null,
      user_id: user.id
    });
    if (!error) { setNewExerciseName(""); loadAll(); }
  }
  async function deleteExercise(id) {
    await supabase.from("exercises").delete().eq("id", id);
    loadAll();
  }

  // ---- log entries ----
  async function handleAddEntry(e) {
    e.preventDefault();
    if (!logCategory || !logExercise || !logSets || !logReps) return;
    setSubmitting(true);
    const { error } = await supabase.from("logs").insert({
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
    if (!error) {
      setLogWeight(""); setLogSets(""); setLogReps(""); setLogRest(""); setLogRemark("");
      loadAll();
    }
  }
  async function deleteEntry(id) {
    await supabase.from("logs").delete().eq("id", id);
    loadAll();
  }

  const groupedEntries = useMemo(() => {
    const groups = {};
    for (const e of entries) {
      (groups[e.log_date] = groups[e.log_date] || []).push(e);
    }
    return Object.keys(groups).sort().reverse().map((date) => ({ date, items: groups[date] }));
  }, [entries]);

  if (loadingAuth) {
    return <div className="wrap"><p className="sub">Loading…</p></div>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>🏋️ Workout Log</h1>
          <div className="sub">{user?.email}</div>
        </div>
        <button className="ghost" onClick={handleSignOut}>Sign out</button>
      </div>

      <div className="card">
        <h2>Categories</h2>
        <div className="chip-row">
          {categories.length === 0 && (
            <div className="notice">No categories yet — add one below (e.g. Leg Day, Push Day, Pull Day).</div>
          )}
          {categories.map((c) => (
            <div className="chip" key={c.id}>
              {c.name}
              <button onClick={() => deleteCategory(c.id)} title="Delete">✕</button>
            </div>
          ))}
        </div>
        <div className="inline-add">
          <input
            type="text"
            placeholder="e.g. Leg Day, Push Day, Pull Day"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button className="primary small" onClick={addCategory}>Add</button>
        </div>
      </div>

      <div className="card">
        <h2>Exercises</h2>
        {categories.length === 0 ? (
          <div className="empty">Add a category first.</div>
        ) : exercises.length === 0 ? (
          <div className="empty">No exercises yet — add one below.</div>
        ) : (
          categories.map((cat) => {
            const list = exercises.filter((e) => e.category_name === cat.name);
            if (!list.length) return null;
            return (
              <div className="cat-group" key={cat.id}>
                <div className="cat-group-title">{cat.name}</div>
                {list.map((e) => (
                  <div className="ex-row" key={e.id}>
                    <span>{e.name}</span>
                    <button className="ghost" onClick={() => deleteExercise(e.id)} title="Delete">✕</button>
                  </div>
                ))}
              </div>
            );
          })
        )}
        <h3>Add exercise</h3>
        <div className="grid">
          <div className="field">
            <label>Category</label>
            <select
              value={newExerciseCategory}
              onChange={(e) => setNewExerciseCategory(e.target.value)}
              disabled={!categories.length}
            >
              {categories.length === 0
                ? <option value="">No categories yet</option>
                : categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Exercise name</label>
            <input
              type="text"
              placeholder="e.g. Squat"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExercise()}
              disabled={!categories.length}
            />
          </div>
        </div>
        <div className="row-actions">
          <button className="primary small" onClick={addExercise} disabled={!categories.length}>Add exercise</button>
        </div>
      </div>

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
            <div className="notice">Add a category and an exercise above before logging.</div>
          )}
          <div className="row-actions">
            <button type="submit" className="primary" disabled={submitting || !categories.length || !exercisesInLogCategory.length}>
              {submitting ? "Adding…" : "Add entry"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>History</h2>
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
    </div>
  );
}
