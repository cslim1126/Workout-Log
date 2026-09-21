"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

export default function CategoriesPage() {
  return <AppShell>{({ user }) => <Categories user={user} />}</AppShell>;
}

const tidy = (s) => s.trim().replace(/\s+/g, " ");

function Categories({ user }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState(""); // problems with creating
  const [message, setMessage] = useState(""); // good news
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rowError, setRowError] = useState({}); // category id -> message

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error: err } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setCategories(data || []);
  }

  // ---------- create ----------
  async function addCategory() {
    const clean = tidy(name);
    setMessage("");
    if (!clean) return;
    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setError("");
    const { error: err } = await supabase
      .from("categories")
      .insert({ name: clean, user_id: user.id });
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setMessage(`Added ${clean}.`);
    load();
  }

  // ---------- edit (rename) ----------
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
    const ok = window.confirm(
      `Delete "${cat.name}"? Its exercises will be deleted too. Your past workout entries stay in Workout History.`
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

  return (
    <>
      <div className="card">
        <h2>Create Category</h2>
        <div className="inline-add">
          <input
            type="text"
            placeholder="e.g. Leg Day, Push Day, Pull Day"
            aria-label="New category name"
            value={name}
            maxLength={60}
            onChange={(e) => { setName(e.target.value); setMessage(""); }}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button className="primary small" onClick={addCategory}>Add</button>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success" role="status">✓ {message}</div>}
      </div>

      <div className="card">
        <h2>Categories ({categories.length})</h2>
        {categories.length === 0 && (
          <div className="empty">No categories yet — add one above (for example Leg Day, Push Day, Pull Day).</div>
        )}
        {categories.map((c) => {
          const editing = editingId === c.id;
          const working = busyId === c.id;
          return (
            <div className="cat-row" key={c.id}>
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
                  <span className="cat-row-name">{c.name}</span>
                  <button className="small" onClick={() => startEdit(c)} disabled={working} aria-label={`Edit ${c.name}`}>Edit</button>
                  <button className="danger small" onClick={() => deleteCategory(c)} disabled={working} aria-label={`Delete ${c.name}`}>Delete</button>
                </>
              )}
              {rowError[c.id] && <div className="error cat-row-error">{rowError[c.id]}</div>}
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
