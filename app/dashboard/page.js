"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import EntryBody from "../components/EntryBody";
import { logVolume } from "../shared/sets";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------- date helpers (all dates are "YYYY-MM-DD" in your own time zone) ----------
const pad = (n) => String(n).padStart(2, "0");
function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}
function addMonths(s, n) {
  const d = fromStr(s);
  return toStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
function startOfWeek(s) {
  // weeks start on Monday
  const d = fromStr(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toStr(d);
}
function startOfMonth(s) {
  const d = fromStr(s);
  return toStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(s) {
  const d = fromStr(s);
  return toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function diffDays(a, b) {
  return Math.round((fromStr(b) - fromStr(a)) / 86400000);
}
function todayStr() {
  return toStr(new Date());
}

function fmtDay(s, withYear) {
  const d = fromStr(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? " " + d.getFullYear() : ""}`;
}
function fmtRange(start, end) {
  const a = fromStr(start);
  const b = fromStr(end);
  if (a.getFullYear() !== b.getFullYear()) return `${fmtDay(start, true)} – ${fmtDay(end, true)}`;
  const suffix = b.getFullYear() !== new Date().getFullYear() ? ` ${b.getFullYear()}` : "";
  if (a.getMonth() === b.getMonth()) {
    if (a.getDate() === b.getDate()) return `${fmtDay(start)}${suffix}`;
    return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}${suffix}`;
  }
  return `${fmtDay(start)} – ${fmtDay(end)}${suffix}`;
}
function fmtDayHeader(s) {
  const today = todayStr();
  const d = fromStr(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`;
  if (s === today) return `Today, ${base}`;
  if (s === addDays(today, -1)) return `Yesterday, ${base}`;
  return `${WEEKDAYS[d.getDay()]}, ${base}`;
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

// ---------- the view: which dates, and how the bars are grouped ----------
function getRange(mode, anchor, from, to) {
  if (mode === "days") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6), unit: "day" };
  }
  if (mode === "weeks") {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor), unit: "week" };
  }
  if (mode === "months") {
    const y = fromStr(anchor).getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31`, unit: "month" };
  }
  // custom: from date to date
  const n = diffDays(from, to) + 1;
  return { start: from, end: to, unit: n <= 31 ? "day" : n <= 180 ? "week" : "month" };
}

function makeBuckets(start, end, unit) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    let bEnd;
    if (unit === "day") bEnd = cur;
    else if (unit === "week") bEnd = addDays(startOfWeek(cur), 6);
    else bEnd = endOfMonth(cur);
    if (bEnd > end) bEnd = end;
    out.push({ start: cur, end: bEnd });
    cur = addDays(bEnd, 1);
  }
  return out;
}

export default function DashboardPage() {
  return <AppShell>{() => <Dashboard />}</AppShell>;
}

function Dashboard() {
  const today = todayStr();
  const [mode, setMode] = useState("days"); // days | weeks | months | custom
  const [anchor, setAnchor] = useState(today);
  const [from, setFrom] = useState(startOfWeek(today));
  const [to, setTo] = useState(addDays(startOfWeek(today), 6));
  const [category, setCategory] = useState("");
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  // Check the custom dates
  let customProblem = "";
  if (mode === "custom") {
    if (!from || !to) customProblem = "Choose both dates.";
    else if (from > to) customProblem = "The start date must be before the end date.";
    else if (diffDays(from, to) > 3660) customProblem = "Please choose 10 years or less.";
  }
  const validRange = !customProblem;
  const range = useMemo(
    () => (validRange ? getRange(mode, anchor, from, to) : null),
    [validRange, mode, anchor, from, to]
  );

  // Load the workouts inside the chosen dates
  useEffect(() => {
    if (!range) {
      setLogs([]);
      return;
    }
    const myRequest = ++requestId.current;
    setLoading(true);
    setError("");
    (async () => {
      const { data, error: err } = await supabase
        .from("logs")
        .select("*")
        .gte("log_date", range.start)
        .lte("log_date", range.end)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (myRequest !== requestId.current) return; // an older request, ignore it
      if (err) setError(err.message);
      setLogs(data || []);
      setLoading(false);
    })();
  }, [range]);

  // Category names for the filter
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
      setCategories(data || []);
    })();
  }, []);

  const categoryOptions = useMemo(() => {
    const names = categories.map((c) => c.name);
    for (const l of logs) {
      if (l.category_name && !names.includes(l.category_name)) names.push(l.category_name);
    }
    return names;
  }, [categories, logs]);

  const filtered = useMemo(
    () => (category ? logs.filter((l) => l.category_name === category) : logs),
    [logs, category]
  );

  // Totals for the big number
  const summary = useMemo(() => {
    let sets = 0;
    let volume = 0;
    const days = new Set();
    for (const e of filtered) {
      const s = Number(e.sets) || 0;
      sets += s;
      volume += logVolume(e);
      days.add(e.log_date);
    }
    return { sets, volume, entries: filtered.length, days: days.size };
  }, [filtered]);

  // Bars: total sets in each day / week / month
  const bars = useMemo(() => {
    if (!range) return [];
    const list = makeBuckets(range.start, range.end, range.unit).map((b) => ({ ...b, value: 0 }));
    for (const e of filtered) {
      const b = list.find((x) => e.log_date >= x.start && e.log_date <= x.end);
      if (b) b.value += Number(e.sets) || 0;
    }
    return list;
  }, [range, filtered]);
  const maxValue = bars.reduce((m, b) => Math.max(m, b.value), 0);

  // History list at the bottom, grouped by day
  const groups = useMemo(() => {
    const map = {};
    for (const e of filtered) (map[e.log_date] = map[e.log_date] || []).push(e);
    return Object.keys(map)
      .sort()
      .reverse()
      .map((date) => {
        const items = map[date];
        let sets = 0;
        let volume = 0;
        for (const e of items) {
          const s = Number(e.sets) || 0;
          sets += s;
          volume += logVolume(e);
        }
        return { date, items, sets, volume };
      });
  }, [filtered]);

  // ---------- actions ----------
  function chooseTab(next) {
    setMode(next);
    if (mode === "custom" && range) setAnchor(range.start);
  }
  function openCustom() {
    if (mode === "custom") return;
    if (range) {
      setFrom(range.start);
      setTo(range.end);
    }
    setMode("custom");
  }
  function move(direction) {
    if (mode === "days") setAnchor(addDays(startOfWeek(anchor), 7 * direction));
    else if (mode === "weeks") setAnchor(addMonths(startOfMonth(anchor), direction));
    else if (mode === "months") setAnchor(addMonths(startOfMonth(anchor), 12 * direction));
  }

  const periodLabel =
    mode === "days" && range ? fmtRange(range.start, range.end)
    : mode === "weeks" ? `${MONTHS_LONG[fromStr(anchor).getMonth()]} ${fromStr(anchor).getFullYear()}`
    : mode === "months" ? String(fromStr(anchor).getFullYear())
    : "";
  const containsToday = range ? today >= range.start && today <= range.end : true;
  const unitWord = range ? (range.unit === "day" ? "day" : range.unit === "week" ? "week" : "month") : "day";

  // Bar labels: skip some when there are many bars
  const maxLabels = range && range.unit === "month" ? 12 : 8;
  const labelEvery = Math.max(1, Math.ceil(bars.length / maxLabels));
  const spansYears = bars.length > 0 && bars[0].start.slice(0, 4) !== bars[bars.length - 1].start.slice(0, 4);

  function barLabel(b, index) {
    if (index % labelEvery !== 0) return { main: "", sub: "" };
    const d = fromStr(b.start);
    if (range.unit === "day") return { main: String(d.getDate()), sub: bars.length <= 8 ? WEEKDAYS[d.getDay()] : "" };
    if (range.unit === "week") return { main: String(d.getDate()), sub: MONTHS[d.getMonth()] };
    return { main: MONTHS[d.getMonth()], sub: spansYears && (d.getMonth() === 0 || index === 0) ? String(d.getFullYear()) : "" };
  }

  return (
    <>
      <div className="card">
        <div className="dash-tabs">
          <div className="seg" role="group" aria-label="Show by">
            {[["days", "Days"], ["weeks", "Weeks"], ["months", "Months"]].map(([key, label]) => (
              <button key={key} aria-pressed={mode === key} onClick={() => chooseTab(key)}>{label}</button>
            ))}
          </div>
          <button
            className="icon-btn"
            aria-pressed={mode === "custom"}
            aria-label="Choose dates (from – to)"
            title="Choose dates (from – to)"
            onClick={openCustom}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </button>
        </div>

        {mode === "custom" ? (
          <div className="grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="dash-from">From</label>
              <input id="dash-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dash-to">To</label>
              <input id="dash-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="period-row">
            <button className="icon-btn small-btn" onClick={() => move(-1)} aria-label="Previous" title="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <div className="period-label" aria-live="polite">{periodLabel}</div>
            <button
              className="icon-btn small-btn"
              onClick={() => move(1)}
              disabled={containsToday}
              aria-label="Next"
              title="Next"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            {!containsToday && (
              <button className="ghost" onClick={() => setAnchor(today)}>Today</button>
            )}
          </div>
        )}

        {customProblem && <div className="error" style={{ marginTop: 0, marginBottom: 10 }}>{customProblem}</div>}

        <div className="dash-filter">
          <label htmlFor="dash-category">Category</label>
          <select id="dash-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {categoryOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="big-number" aria-live="polite">
          {summary.sets}
          <small>{summary.sets === 1 ? "set" : "sets"}</small>
        </div>
        <div className="stat-line">
          <span>Volume <b>{fmtNumber(summary.volume)} kg</b></span>{" "}
          <span>Entries <b>{summary.entries}</b></span>{" "}
          <span>Days <b>{summary.days}</b></span>
        </div>

        {range && (
          <div className="chart" role="img" aria-label={`Bar chart: sets per ${unitWord}`}>
            <div className="chart-plot">
              {maxValue > 0 && (
                <>
                  <div className="gridline top"><span>{maxValue}</span></div>
                  {maxValue >= 2 && <div className="gridline mid"><span>{Math.round(maxValue / 2)}</span></div>}
                </>
              )}
              <div className="bars" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
                {bars.map((b) => (
                  <div className="bar-col" key={b.start}>
                    {b.value > 0 && (
                      <div
                        className="bar"
                        style={{ height: `${(b.value / maxValue) * 100}%` }}
                        title={`${fmtRange(b.start, b.end)}: ${b.value} sets`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bar-labels" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
              {bars.map((b, i) => {
                const l = barLabel(b, i);
                const now = today >= b.start && today <= b.end;
                return (
                  <div className={"bar-label" + (b.value > 0 ? " has" : "") + (now ? " now" : "")} key={b.start}>
                    <b>{l.main}</b>
                    <span>{l.sub}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="notice" style={{ marginTop: 6 }}>
          {loading ? "Loading…" : `Bars show total sets per ${unitWord}.`}
          {filtered.length >= 1000 ? " Only the newest 1000 entries are shown." : ""}
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h2>Workout History</h2>
        {groups.length === 0 && !loading && <div className="empty">No workouts in this period.</div>}
        {groups.map((g) => (
          <div className="day-group" key={g.date}>
            <div className="day-header split">
              <span>{fmtDayHeader(g.date)}</span>
              <span className="day-total">{g.sets} {g.sets === 1 ? "set" : "sets"}{g.volume > 0 ? ` · ${fmtNumber(g.volume)} kg` : ""}</span>
            </div>
            {g.items.map((e) => (
              <div className="entry" key={e.id}>
                <div>
                  <EntryBody e={e} />
                </div>
                <div className="entry-time">{fmtTime(e.created_at)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
