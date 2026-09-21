"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

export default function ExercisesPage() {
  return <AppShell>{({ user }) => <Exercises user={user} />}</AppShell>;
}

function Exercises({ user }) {
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [cats, exs] = await Promise.all([
      supabase.from("categories").select("*").order("created_at", { ascending: true }),
      supabase.from("exercises").select("*").order("created_at", { ascending: true })
    ]);
    if (cats.error) setError(cats.error.message);
    else if (exs.error) setError(exs.error.message);
    setCategories(cats.data || []);
    setExercises(exs.data || []);
  }

  // keep the category drop-down valid once categories load
  useEffect(() => {
    if (!categories.length) {
      setCategory("");
      return;
    }
    if (!categories.some((c) => c.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addExercise() {
    const clean = name.trim();
    if (!clean || !category) return;
    if (exercises.some((e) => e.category_name === category && e.name.toLowerCase() === clean.toLowerCase())) {
      setError("That exercise is already in this category.");
      return;
    }
    setError("");
    const cat = categories.find((c) => c.name === category);
    const { error: err } = await supabase.from("exercises").insert({
      name: clean,
      category_name: category,
      category_id: cat ? cat.id : null,
      user_id: user.id
    });
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    load();
  }

  async function deleteExercise(id) {
    setError("");
    const { error: err } = await supabase.from("exercises").delete().eq("id", id);
    if (err) setError(err.message);
    load();
  }

  return (
    <div className="card">
      <h2>Add Exercise</h2>
      {categories.length === 0 ? (
        <div className="empty">
          Create a category first. <Link href="/categories">Go to Create Category</Link>
        </div>
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

      <h3>New exercise</h3>
      <div className="grid">
        <div className="field">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExercise()}
            disabled={!categories.length}
          />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row-actions">
        <button className="primary small" onClick={addExercise} disabled={!categories.length}>
          Add exercise
        </button>
      </div>
    </div>
  );
}
