"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

export default function CreateExercisePage() {
  return <AppShell>{({ user }) => <CreateExercise user={user} />}</AppShell>;
}

const tidy = (s) => s.trim().replace(/\s+/g, " ");

function CreateExercise({ user }) {
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loadError, setLoadError] = useState("");

  // create category
  const [catName, setCatName] = useState("");
  const [catError, setCatError] = useState("");
  const [catMessage, setCatMessage] = useState("");

  // add exercise
  const [category, setCategory] = useState("");
  const [exName, setExName] = useState("");
  const [exError, setExError] = useState("");
  const [exMessage, setExMessage] = useState("");

  // the list at the bottom (edit / delete)
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rowError, setRowError] = useState({}); // category or exercise id -> message
  const [openMap, setOpenMap] = useState({}); // category id -> true when its exercises are shown

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [cats, exs] = await Promise.all([
      supabase.from("categories").select("*").order("created_at", { ascending: true }),
      supabase.from("exercises").select("*").order("created_at", { ascending: true })
    ]);
    const problem = cats.error || exs.error;
    setLoadError(problem ? problem.message : "");
    setCategories(cats.data || []);
    setExercises(exs.data || []);
  }

  // keep the category drop-down valid
  useEffect(() => {
    if (!categories.length) {
      setCategory("");
      return;
    }
    if (!categories.some((c) => c.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const exercisesOf = (name) => exercises.filter((e) => e.category_name === name);
  const toggle = (id) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  // ---------- create category ----------
  async function addCategory() {
    const clean = tidy(catName);
    setCatMessage("");
    if (!clean) return;
    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      setCatError("That category already exists.");
      return;
    }
    setCatError("");
    const { error: err } = await supabase.from("categories").insert({ name: clean, user_id: user.id });
    if (err) {
      setCatError(err.message);
      return;
    }
    setCatName("");
    setCatMessage(`Added ${clean}.`);
    load();
  }

  // ---------- add exercise ----------
  async function addExercise() {
    const clean = tidy(exName);
    setExMessage("");
    if (!clean || !category) return;
    if (exercisesOf(category).some((e) => e.name.toLowerCase() === clean.toLowerCase())) {
      setExError("That exercise is already in this category.");
      return;
    }
    setExError("");
    const cat = categories.find((c) => c.name === category);
    const { error: err } = await supabase.from("exercises").insert({
      name: clean,
      category_name: category,
      category_id: cat ? cat.id : null,
      user_id: user.id
    });
    if (err) {
      setExError(err.message);
      return;
    }
    setExName("");
    setExMessage(`Added ${clean} to ${category}.`);
    if (cat) setOpenMap((m) => ({ ...m, [cat.id]: true })); // show it where it was added
    load();
  }

  // ---------- edit (rename) a category ----------
  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setMessage("");
    setRowError((e) => ({ ...e, [cat.id]: "" }));
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
  }

  async function saveEdit(cat) {
    const clean = tidy(editName);
    if (!clean) {
      setRowError((e) => ({ ...e, [cat.id]: "Please enter a name." }));
      return;
    }
    if (clean === cat.name) {
      cancelEdit();
      return;
    }
    if (categories.some((c) => c.id !== cat.id && c.name.toLowerCase() === clean.toLowerCase())) {
      setRowError((e) => ({ ...e, [cat.id]: "Another category already has that name." }));
      return;
    }

    const oldName = cat.name;
    setBusyId(cat.id);
    setRowError((e) => ({ ...e, [cat.id]: "" }));
    setMessage("");
    // Exercises and past workouts remember the category by its name, so they are
    // renamed first and the category itself last. If something fails halfway,
    // pressing Save again finishes the job.
    const steps = [
      supabase.from("logs").update({ category_name: clean }).eq("category_name", oldName),
      supabase.from("exercises").update({ category_name: clean }).eq("category_name", oldName),
      supabase.from("categories").update({ name: clean }).eq("id", cat.id)
    ];
    let failure = "";
    for (const step of steps) {
      const { error: err } = await step;
      if (err) {
        failure = err.message;
        break;
      }
    }
    setBusyId("");
    if (failure) {
      setRowError((e) => ({ ...e, [cat.id]: `Could not finish renaming: ${failure}. Please press Save again.` }));
      return;
    }
    cancelEdit();
    setMessage(`Renamed ${oldName} to ${clean}.`);
    load();
  }

  // ---------- delete ----------
  async function deleteCategory(cat) {
    const count = exercisesOf(cat.name).length;
    const ok = window.confirm(
      `Delete "${cat.name}"? ${count === 0 ? "" : `Its ${count} ${count === 1 ? "exercise" : "exercises"} will be deleted too. `}Your past workout entries stay in Workout History.`
    );
    if (!ok) return;
    setBusyId(cat.id);
    setRowError((e) => ({ ...e, [cat.id]: "" }));
    setMessage("");
    const { error: err } = await supabase.from("categories").delete().eq("id", cat.id);
    setBusyId("");
    if (err) setRowError((e) => ({ ...e, [cat.id]: err.message }));
    if (editingId === cat.id) cancelEdit();
    load();
  }

  async function deleteExercise(ex) {
    const ok = window.confirm(`Delete the exercise "${ex.name}"? Your past workout entries stay in Workout History.`);
    if (!ok) return;
    setBusyId(ex.id);
    setRowError((e) => ({ ...e, [ex.id]: "" }));
    setMessage("");
    const { error: err } = await supabase.from("exercises").delete().eq("id", ex.id);
    setBusyId("");
    if (err) setRowError((e) => ({ ...e, [ex.id]: err.message }));
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Create Category</h2>
        <div className="inline-add">
          <input
            type="text"
            placeholder="e.g. Leg Day, Push Day, Pull Day"
            aria-label="New category name"
            value={catName}
            maxLength={60}
            onChange={(e) => { setCatName(e.target.value); setCatMessage(""); }}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button className="primary small" onClick={addCategory}>Add</button>
        </div>
        {catError && <div className="error">{catError}</div>}
        {catMessage && <div className="success" role="status">✓ {catMessage}</div>}
      </div>

      <div className="card">
        <h2>Add Exercise</h2>
        {categories.length === 0 ? (
          <div className="empty">Create a category first, using the box above.</div>
        ) : (
          <>
            <div className="grid">
              <div className="field">
                <label htmlFor="ex-category">Category</label>
                <select id="ex-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ex-name">Exercise name</label>
                <input
                  id="ex-name"
                  type="text"
                  placeholder="e.g. Squat"
                  value={exName}
                  maxLength={60}
                  onChange={(e) => { setExName(e.target.value); setExMessage(""); }}
                  onKeyDown={(e) => e.key === "Enter" && addExercise()}
                />
              </div>
            </div>
            {exError && <div className="error">{exError}</div>}
            {exMessage && <div className="success" role="status">✓ {exMessage}</div>}
            <div className="row-actions">
              <button className="primary small" onClick={addExercise}>Add exercise</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Categories &amp; Exercises</h2>
        {loadError && <div className="error" style={{ marginTop: 0, marginBottom: 10 }}>{loadError}</div>}
        {message && <div className="success" role="status" style={{ marginTop: 0, marginBottom: 10 }}>✓ {message}</div>}
        {categories.length === 0 && !loadError && (
          <div className="empty">No categories yet — add one in the first box (for example Leg Day, Push Day, Pull Day).</div>
        )}
        {categories.length > 0 && (
          <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>Click a category to see its exercises.</div>
        )}
        {categories.map((c) => {
          const editing = editingId === c.id;
          const working = busyId === c.id;
          const list = exercisesOf(c.name);
          const open = Boolean(openMap[c.id]);
          const listId = `ex-list-${c.id}`;
          return (
            <div className="cat-block" key={c.id}>
              <div className="cat-row">
                {editing ? (
                  <>
                    <input
                      className="cat-edit-input"
                      type="text"
                      aria-label={`New name for ${c.name}`}
                      value={editName}
                      maxLength={60}
                      autoFocus
                      disabled={working}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button className="primary small" onClick={() => saveEdit(c)} disabled={working}>
                      {working ? "Saving…" : "Save"}
                    </button>
                    <button className="small" onClick={cancelEdit} disabled={working}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cat-name-toggle"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() => toggle(c.id)}
                    >
                      <svg className={"chev" + (open ? " open" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="cat-row-name">{c.name}</span>
                    </button>
                    <span className="badge">{list.length} {list.length === 1 ? "exercise" : "exercises"}</span>
                    <button className="small" onClick={() => startEdit(c)} disabled={working} aria-label={`Edit ${c.name}`}>Edit</button>
                    <button className="danger small" onClick={() => deleteCategory(c)} disabled={working} aria-label={`Delete ${c.name}`}>Delete</button>
                  </>
                )}
                {rowError[c.id] && <div className="error cat-row-error">{rowError[c.id]}</div>}
              </div>
              {open && (
              <div className="ex-list" id={listId}>
                {list.length === 0 ? (
                  <div className="ex-empty">No exercises yet.</div>
                ) : (
                  list.map((e) => (
                    <div key={e.id}>
                      <div className="ex-row">
                        <span>{e.name}</span>
                        <button className="ghost" onClick={() => deleteExercise(e)} disabled={busyId === e.id} title="Delete" aria-label={`Delete ${e.name}`}>✕</button>
                      </div>
                      {rowError[e.id] && <div className="error">{rowError[e.id]}</div>}
                    </div>
                  ))
                )}
              </div>
              )}
            </div>
          );
        })}
        {editingId && (
          <div className="notice">Renaming also updates this category&apos;s exercises and your past workouts.</div>
        )}
      </div>
    </>
  );
}
