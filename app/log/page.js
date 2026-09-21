"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import EntryBody from "../components/EntryBody";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Dates use your own time zone (not UTC), so "today" is correct early in the morning.
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function fmtDate(d) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d === localDateStr()) return "Today";
  if (d === localDateStr(yesterday)) return "Yesterday";
  return fmtDay(d);
}

export default function LogPage() {
  return <AppShell>{() => <WorkoutHistory />}</AppShell>;
}

function WorkoutHistory() {
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openMap, setOpenMap] = useState({}); // category name -> true/false, only what the person clicked
  const requestId = useRef(0);

  // Search by date:
  //   From only  -> that one day
  //   From + To  -> from date to date
  //   To only    -> everything up to that day
  //   nothing    -> all dates
  const problem = from && to && from > to ? "The start date must be before the end date." : "";
  const start = from || "";
  const end = to || from || "";
  const filterActive = Boolean(from || to);

  // Quick buttons
  const today = localDateStr();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateStr(yesterdayDate);
  const isDay = (day) => from === day && (!to || to === day);
  function pickDay(day) {
    setFrom(day);
    setTo("");
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
      setCategories(data || []);
    })();
  }, []);

  async function loadEntries() {
    if (problem) {
      setEntries([]);
      setLoaded(true);
      return;
    }
    const myRequest = ++requestId.current;
    setLoading(true);
    let query = supabase.from("logs").select("*");
    if (start) query = query.gte("log_date", start);
    if (end) query = query.lte("log_date", end);
    const { data, error: err } = await query
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (myRequest !== requestId.current) return; // an older search, ignore it
    setError(err ? err.message : "");
    setEntries(data || []);
    setLoaded(true);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
  }, [start, end, problem]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new search starts fresh: what you opened or closed before is forgotten
  useEffect(() => {
    setOpenMap({});
  }, [start, end]);

  async function deleteEntry(e) {
    const ok = window.confirm(`Delete this ${e.exercise_name} entry (${fmtDay(e.log_date)})? This cannot be undone.`);
    if (!ok) return;
    setError("");
    const { error: err } = await supabase.from("logs").delete().eq("id", e.id);
    if (err) setError(err.message);
    loadEntries();
  }

  // One section for each category, with its entries grouped by day
  const sections = useMemo(() => {
    const byCategory = {};
    for (const e of entries) {
      const name = e.category_name || "No category";
      (byCategory[name] = byCategory[name] || []).push(e);
    }
    const order = categories.map((c) => c.name); // same order as Create Category
    const names = Object.keys(byCategory).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      if (a === "No category") return 1; // entries without a category go last
      if (b === "No category") return -1;
      return a.localeCompare(b);
    });
    return names.map((name) => {
      const items = byCategory[name];
      const days = {};
      for (const e of items) (days[e.log_date] = days[e.log_date] || []).push(e);
      return {
        name,
        count: items.length,
        days: Object.keys(days).sort().reverse().map((date) => ({ date, items: days[date] }))
      };
    });
  }, [entries, categories]);

  // A category opens when you click it. While you are searching by date,
  // the categories that have results open by themselves.
  const isOpen = (name) => (name in openMap ? openMap[name] : filterActive);
  const toggle = (name) => setOpenMap((m) => ({ ...m, [name]: !isOpen(name) }));

  const summary = !filterActive
    ? "Showing all dates"
    : !from
      ? `Showing everything up to ${fmtDay(to)}`
      : !to || to === from
        ? `Showing ${from === today ? "today, " : from === yesterday ? "yesterday, " : ""}${fmtDay(from)}`
        : `Showing ${fmtDay(from)} – ${fmtDay(to)}`;

  function clearDates() {
    setFrom("");
    setTo("");
  }

  return (
    <>
      <div className="card">
        <h2>Search by date</h2>
        <div className="quick-row" role="group" aria-label="Quick search">
          <button type="button" aria-pressed={isDay(today)} onClick={() => pickDay(today)}>Today</button>
          <button type="button" aria-pressed={isDay(yesterday)} onClick={() => pickDay(yesterday)}>Yesterday</button>
        </div>
        <div className="date-search">
          <div className="field">
            <label htmlFor="hs-from">Date (from)</label>
            <input id="hs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="hs-to">To (optional)</label>
            <input id="hs-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="clear" onClick={clearDates} disabled={!filterActive}>Clear</button>
        </div>
        {problem && <div className="error">{problem}</div>}
        <div className="notice" style={{ marginTop: 10 }} aria-live="polite">
          {problem ? "" : `${summary}${loaded && !loading ? ` · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}` : ""}`}
          {!problem && !filterActive ? ". Choose one date, or a From and To date, to search." : ""}
        </div>
      </div>

      <div className="card">
        <h2>Workout History</h2>
        {error && <div className="error" style={{ marginTop: 0, marginBottom: 10 }}>{error}</div>}
        {loaded && !loading && !problem && sections.length === 0 && (
          <div className="empty">
            {filterActive ? "No workouts found for these dates." : <>No entries yet. <Link href="/log-set">Log a Set</Link></>}
          </div>
        )}
        {sections.length > 0 && !filterActive && (
          <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>Click a category to see its workouts.</div>
        )}
        {sections.map((section, index) => {
          const open = isOpen(section.name);
          const bodyId = `cat-body-${index}`;
          return (
            <div className="cat-section" key={section.name}>
              <button
                type="button"
                className="cat-toggle"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => toggle(section.name)}
              >
                <svg className={"chev" + (open ? " open" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span className="cat-name">{section.name}</span>
                <span className="badge">{section.count} {section.count === 1 ? "entry" : "entries"}</span>
              </button>
              {open && (
                <div className="cat-body" id={bodyId}>
                  {section.days.map((group) => (
                    <div className="day-group" key={group.date}>
                      <div className="day-header">{fmtDate(group.date)}</div>
                      {group.items.map((e) => (
                        <div className="entry" key={e.id}>
                          <div>
                            <EntryBody e={e} />
                          </div>
                          <button className="ghost" onClick={() => deleteEntry(e)} title="Delete" aria-label={`Delete ${e.exercise_name}`}>✕</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {entries.length >= 1000 && <div className="notice">Only the newest 1000 entries are shown. Use the date search to see older ones.</div>}
      </div>
    </>
  );
}
