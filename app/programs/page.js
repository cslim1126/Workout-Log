"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";
import { callApi } from "../shared/api";
import {
  MAX_ITEMS, PROGRAMS_SQL, SHARE_LABELS, emptyItem, checkProgram, targetLine
} from "../shared/programs";

export default function ProgramsPage() {
  return <AppShell>{() => <Programs />}</AppShell>;
}

const blankDraft = () => ({ id: "", name: "", notes: "", shareScope: "private", groupId: "", items: [emptyItem(), emptyItem(), emptyItem()] });

function Programs() {
  const [data, setData] = useState(null); // { programs, groups, myGroupId, groupsReady }
  const [loadError, setLoadError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState(null); // the program being written or changed
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function load() {
    const res = await callApi("/api/programs");
    if (!res.ok) {
      setSetupNeeded(Boolean(res.json.setupNeeded));
      setLoadError(res.json.error || "Could not load the programs.");
      return;
    }
    setSetupNeeded(false);
    setLoadError("");
    setData(res.json);
  }

  useEffect(() => {
    load();
  }, []);

  const groupName = useMemo(() => {
    const map = {};
    if (data) for (const g of data.groups) map[g.id] = g.name;
    return map;
  }, [data]);

  function shareText(p) {
    if (p.shareScope === "everyone") return "Shared with everyone";
    if (p.shareScope === "group") return `Shared with ${groupName[p.groupId] || "a group"}`;
    return "Only me";
  }

  // ---------- writing a program ----------
  function startNew() {
    setDraft(blankDraft());
    setFormError("");
    setMessage("");
  }

  function startEdit(p) {
    setDraft({
      id: p.id,
      name: p.name,
      notes: p.notes,
      shareScope: p.shareScope,
      groupId: p.groupId || "",
      items: p.items.length ? p.items.map((i) => ({ ...emptyItem(), ...i, sets: String(i.sets == null ? "" : i.sets) })) : [emptyItem()]
    });
    setFormError("");
    setMessage("");
  }

  const changeField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const changeItem = (index, key, value) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)) }));
  const addRow = () => setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }));
  const removeRow = (index) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }));

  async function saveDraft(e) {
    e.preventDefault();
    setFormError("");
    const problem = checkProgram(draft);
    if (problem) return setFormError(problem);
    if (draft.shareScope === "group" && !draft.groupId) {
      return setFormError("Please choose which group to share with.");
    }

    setSaving(true);
    const body = { ...draft, groupId: draft.groupId || null };
    const res = draft.id
      ? await callApi("/api/programs", "PATCH", body)
      : await callApi("/api/programs", "POST", body);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.json.error || "Could not save the program.");
      return;
    }
    const saved = res.json.program;
    setDraft(null);
    setMessage(draft.id ? `Saved ${saved.name}.` : `Created ${saved.name}.`);
    if (saved && saved.id) setOpenId(saved.id);
    load();
  }

  async function deleteProgram(p) {
    const ok = window.confirm(`Delete the program "${p.name}"? This cannot be undone. Workouts already logged from it stay in Workout History.`);
    if (!ok) return;
    setBusyId(p.id);
    setMessage("");
    const res = await callApi("/api/programs", "DELETE", { id: p.id });
    setBusyId("");
    if (!res.ok) {
      setLoadError(res.json.error || "Could not delete the program.");
      return;
    }
    setLoadError("");
    setMessage(`Deleted ${p.name}.`);
    load();
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(PROGRAMS_SQL);
      setCopied(true);
    } catch (e) {
      setCopied(false);
    }
  }

  // ---------- screens ----------
  if (setupNeeded) {
    return (
      <div className="card">
        <h2>Workout Programs</h2>
        <div className="notice" style={{ marginTop: 0 }}>
          One-time setup needed. In Supabase, open <b>SQL Editor</b> → <b>New query</b>, paste this, click <b>Run</b>, then refresh this page (F5).
        </div>
        <pre className="sql-box">{PROGRAMS_SQL}</pre>
        <button type="button" className="small" onClick={copySql}>{copied ? "Copied ✓" : "Copy SQL"}</button>
      </div>
    );
  }
  if (loadError && !data) {
    return (
      <div className="card">
        <h2>Workout Programs</h2>
        <div className="error" style={{ marginTop: 0 }}>{loadError}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="card">
        <h2>Workout Programs</h2>
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const mine = data.programs.filter((p) => p.mine);
  const sharedWithMe = data.programs.filter((p) => !p.mine);

  // ---------- the writing form ----------
  if (draft) {
    return (
      <div className="card">
        <h2>{draft.id ? "Edit program" : "Write a program"}</h2>
        <form onSubmit={saveDraft} noValidate>
          <div className="grid">
            <div className="field full">
              <label htmlFor="pg-name">Program name</label>
              <input id="pg-name" type="text" maxLength={60} placeholder="e.g. Leg Day A" value={draft.name} onChange={(e) => changeField("name", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pg-notes">Notes (optional)</label>
              <input id="pg-notes" type="text" maxLength={500} placeholder="e.g. Week 1-4, add 2.5kg each week" value={draft.notes} onChange={(e) => changeField("notes", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pg-share">Who can see it</label>
              <select id="pg-share" value={draft.shareScope} onChange={(e) => changeField("shareScope", e.target.value)}>
                <option value="private">Only me</option>
                <option value="group">My group</option>
                <option value="everyone">Everyone</option>
              </select>
            </div>
            {draft.shareScope === "group" && (
              <div className="field">
                <label htmlFor="pg-group">Which group</label>
                <select id="pg-group" value={draft.groupId} onChange={(e) => changeField("groupId", e.target.value)}>
                  <option value="">Choose a group…</option>
                  {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <h3 style={{ marginTop: 18 }}>Exercises</h3>
          <div className="prog-table" role="table">
            <div className="prog-head" role="row">
              <span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span><span>RIR</span><span>Notes</span><span />
            </div>
            {draft.items.map((it, i) => (
              <div className="prog-row" role="row" key={i}>
                <label className="prog-cell exercise">
                  <span className="mini-label">Exercise</span>
                  <input aria-label={`Row ${i + 1} exercise`} type="text" maxLength={60} placeholder="Barbell Squat" value={it.exercise} onChange={(e) => changeItem(i, "exercise", e.target.value)} />
                </label>
                <label className="prog-cell">
                  <span className="mini-label">Sets</span>
                  <input aria-label={`Row ${i + 1} sets`} type="number" inputMode="numeric" min="1" max="20" step="1" placeholder="4" value={it.sets} onChange={(e) => changeItem(i, "sets", e.target.value)} />
                </label>
                <label className="prog-cell">
                  <span className="mini-label">Reps</span>
                  <input aria-label={`Row ${i + 1} reps`} type="text" maxLength={20} placeholder="12" value={it.reps} onChange={(e) => changeItem(i, "reps", e.target.value)} />
                </label>
                <label className="prog-cell">
                  <span className="mini-label">Rest</span>
                  <input aria-label={`Row ${i + 1} rest`} type="text" maxLength={20} placeholder="90s" value={it.rest} onChange={(e) => changeItem(i, "rest", e.target.value)} />
                </label>
                <label className="prog-cell">
                  <span className="mini-label">RIR</span>
                  <input aria-label={`Row ${i + 1} RIR`} type="text" maxLength={10} placeholder="2" value={it.rir} onChange={(e) => changeItem(i, "rir", e.target.value)} />
                </label>
                <label className="prog-cell notes">
                  <span className="mini-label">Notes</span>
                  <input aria-label={`Row ${i + 1} notes`} type="text" maxLength={200} placeholder="Optional" value={it.notes} onChange={(e) => changeItem(i, "notes", e.target.value)} />
                </label>
                <button type="button" className="ghost remove-row" aria-label={`Remove row ${i + 1}`} onClick={() => removeRow(i)} disabled={draft.items.length === 1}>✕</button>
              </div>
            ))}
          </div>
          <div className="notice">RIR means reps in reserve — how many reps are left in the tank. Leave it blank if you do not use it.</div>
          <button type="button" className="small" onClick={addRow} disabled={draft.items.length >= MAX_ITEMS}>+ Add row</button>

          {formError && <div className="error">{formError}</div>}
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => { setDraft(null); setFormError(""); }} disabled={saving}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create program"}</button>
          </div>
        </form>
      </div>
    );
  }

  // ---------- the list ----------
  const card = (p) => {
    const open = openId === p.id;
    return (
      <div className="prog-card" key={p.id}>
        <button
          type="button"
          className="cat-name-toggle"
          aria-expanded={open}
          onClick={() => setOpenId(open ? "" : p.id)}
        >
          <svg className={"chev" + (open ? " open" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="cat-row-name">{p.name}</span>
          <span className="badge">{p.items.length} {p.items.length === 1 ? "exercise" : "exercises"}</span>
        </button>
        <div className="prog-meta">
          {p.mine ? shareText(p) : `From ${p.ownerName || "another user"}`}
          {p.notes ? ` · ${p.notes}` : ""}
        </div>
        {open && (
          <div className="prog-body">
            <div className="prog-table read">
              <div className="prog-head" role="row">
                <span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span><span>RIR</span><span>Notes</span>
              </div>
              {p.items.map((it, i) => (
                <div className="prog-row read" role="row" key={i}>
                  <span data-label="Exercise">{it.exercise}</span>
                  <span data-label="Sets">{it.sets}</span>
                  <span data-label="Reps">{it.reps}</span>
                  <span data-label="Rest">{it.rest || "—"}</span>
                  <span data-label="RIR">{it.rir || "—"}</span>
                  <span data-label="Notes">{it.notes || "—"}</span>
                </div>
              ))}
            </div>
            <div className="row-actions" style={{ justifyContent: "flex-start", gap: 8 }}>
              <Link className="btn-link" href={`/log-set?program=${p.id}`}>Use this program</Link>
              {p.mine && <button className="small" onClick={() => startEdit(p)}>Edit</button>}
              {p.mine && <button className="danger small" onClick={() => deleteProgram(p)} disabled={busyId === p.id}>Delete</button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="card">
        <h2>Workout Programs</h2>
        <div className="notice" style={{ marginTop: 0 }}>
          Write a plan (exercise, sets, reps, rest, RIR) and share it. People who follow it key in what they actually did.
        </div>
        {message && <div className="success" role="status">✓ {message}</div>}
        {loadError && <div className="error">{loadError}</div>}
        <div className="row-actions">
          <button className="primary" onClick={startNew}>Write a program</button>
        </div>
      </div>

      <div className="card">
        <h2>My programs ({mine.length})</h2>
        {mine.length === 0 && <div className="empty">You have not written a program yet.</div>}
        {mine.map(card)}
      </div>

      <div className="card">
        <h2>Shared with me ({sharedWithMe.length})</h2>
        {sharedWithMe.length === 0 && <div className="empty">Nobody has shared a program with you yet.</div>}
        {sharedWithMe.map(card)}
      </div>
    </>
  );
}
