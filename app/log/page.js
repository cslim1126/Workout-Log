"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import EntryBody from "../components/EntryBody";

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
  return <AppShell>{() => <WorkoutHistory />}</AppShell>;
}

function WorkoutHistory() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const { data, error: err } = await supabase
      .from("logs")
      .select("*")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) setError(err.message);
    setEntries(data || []);
    setLoaded(true);
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
    <div className="card">
      <h2>Workout History</h2>
      {error && <div className="error" style={{ marginTop: 0, marginBottom: 10 }}>{error}</div>}
      {loaded && groupedEntries.length === 0 && (
        <div className="empty">
          No entries yet. <Link href="/log-set">Log a Set</Link>
        </div>
      )}
      {groupedEntries.map((group) => (
        <div className="day-group" key={group.date}>
          <div className="day-header">{fmtDate(group.date)}</div>
          {group.items.map((e) => (
            <div className="entry" key={e.id}>
              <div>
                <EntryBody e={e} />
              </div>
              <button className="ghost" onClick={() => deleteEntry(e.id)} title="Delete" aria-label={`Delete ${e.exercise_name}`}>✕</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
