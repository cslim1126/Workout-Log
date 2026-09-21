"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

export default function CategoriesPage() {
  return <AppShell>{({ user }) => <Categories user={user} />}</AppShell>;
}

function Categories({ user }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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

  async function addCategory() {
    const clean = name.trim();
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
    load();
  }

  async function deleteCategory(cat) {
    const ok = window.confirm(
      `Delete "${cat.name}"? Its exercises will be deleted too. Your past workout entries stay in Workout History.`
    );
    if (!ok) return;
    setError("");
    const { error: err } = await supabase.from("categories").delete().eq("id", cat.id);
    if (err) setError(err.message);
    load();
  }

  return (
    <div className="card">
      <h2>Create Category</h2>
      <div className="chip-row">
        {categories.length === 0 && (
          <div className="notice">No categories yet — add one below (e.g. Leg Day, Push Day, Pull Day).</div>
        )}
        {categories.map((c) => (
          <div className="chip" key={c.id}>
            {c.name}
            <button onClick={() => deleteCategory(c)} title="Delete">✕</button>
          </div>
        ))}
      </div>
      <div className="inline-add">
        <input
          type="text"
          placeholder="e.g. Leg Day, Push Day, Pull Day"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
        />
        <button className="primary small" onClick={addCategory}>Add</button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
