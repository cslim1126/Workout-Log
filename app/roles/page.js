"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { callApi } from "../shared/api";
import { PERMISSIONS, ROLES_SQL, cleanRoleName } from "../shared/permissions";

export default function RolesPage() {
  return <AppShell>{({ can }) => <Roles allowed={can("roles.manage")} />}</AppShell>;
}

const blankDraft = () => ({ id: "", name: "", permissions: [] });

function Roles({ allowed }) {
  const [data, setData] = useState(null); // { roles, me }
  const [loadError, setLoadError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function load() {
    const res = await callApi("/api/roles");
    if (!res.ok) {
      setSetupNeeded(Boolean(res.json.setupNeeded));
      setLoadError(res.json.error || "Could not load the roles.");
      return;
    }
    setSetupNeeded(false);
    setLoadError("");
    setData(res.json);
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copySql() {
    try {
      await navigator.clipboard.writeText(ROLES_SQL);
      setCopied(true);
    } catch (e) {
      setCopied(false);
    }
  }

  function startNew() {
    setDraft(blankDraft());
    setFormError("");
    setMessage("");
  }
  function startEdit(role) {
    setDraft({ id: role.id, name: role.name, permissions: (role.permissions || []).slice() });
    setFormError("");
    setMessage("");
  }
  const toggle = (key) =>
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(key) ? d.permissions.filter((k) => k !== key) : [...d.permissions, key]
    }));

  async function saveDraft(e) {
    e.preventDefault();
    const name = cleanRoleName(draft.name);
    if (!name) return setFormError("Please enter a role name.");
    setFormError("");
    setSaving(true);
    const body = { id: draft.id, name, permissions: draft.permissions };
    const res = draft.id ? await callApi("/api/roles", "PATCH", body) : await callApi("/api/roles", "POST", body);
    setSaving(false);
    if (!res.ok) return setFormError(res.json.error || "Could not save the role.");
    setDraft(null);
    setMessage(draft.id ? `Saved ${name}.` : `Created ${name}.`);
    load();
  }

  async function deleteRole(role) {
    const ok = window.confirm(
      `Delete the role "${role.name}"? ${role.members === 0 ? "" : `${role.members} ${role.members === 1 ? "person has" : "people have"} it, and they will be left with no role (they can only log their own workouts). `}Nobody is deleted.`
    );
    if (!ok) return;
    setBusyId(role.id);
    setMessage("");
    const res = await callApi("/api/roles", "DELETE", { id: role.id });
    setBusyId("");
    if (!res.ok) return setLoadError(res.json.error || "Could not delete the role.");
    setLoadError("");
    setMessage(`Deleted ${role.name}.`);
    load();
  }

  if (!allowed) {
    return (
      <div className="card">
        <h2>Roles &amp; Permissions</h2>
        <div className="empty">You do not have permission to manage roles.</div>
      </div>
    );
  }
  if (setupNeeded) {
    return (
      <div className="card">
        <h2>Roles &amp; Permissions</h2>
        <div className="notice" style={{ marginTop: 0 }}>
          One-time setup needed. In Supabase, open <b>SQL Editor</b> &rarr; <b>New query</b>, paste this, click <b>Run</b>, then refresh this page (F5).
        </div>
        <pre className="sql-box">{ROLES_SQL}</pre>
        <button type="button" className="small" onClick={copySql}>{copied ? "Copied \u2713" : "Copy SQL"}</button>
      </div>
    );
  }
  if (loadError && !data) {
    return (
      <div className="card">
        <h2>Roles &amp; Permissions</h2>
        <div className="error" style={{ marginTop: 0 }}>{loadError}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="card">
        <h2>Roles &amp; Permissions</h2>
        <div className="empty">Loading…</div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="card">
        <h2>{draft.id ? "Edit role" : "New role"}</h2>
        <form onSubmit={saveDraft} noValidate>
          <div className="grid">
            <div className="field full">
              <label htmlFor="role-name">Role name</label>
              <input id="role-name" type="text" maxLength={40} placeholder="e.g. Coach, Gym Manager" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
          </div>
          <h3 style={{ marginTop: 18 }}>What this role can do</h3>
          <div className="perm-list">
            {PERMISSIONS.map((p) => (
              <label className="perm" key={p.key}>
                <input type="checkbox" checked={draft.permissions.includes(p.key)} onChange={() => toggle(p.key)} />
                <span>
                  <b>{p.label}</b>
                  <span className="perm-help">{p.help}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="notice">Anything not ticked is hidden from that person. Everyone can always log their own workouts and see their own history.</div>
          {formError && <div className="error">{formError}</div>}
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => { setDraft(null); setFormError(""); }} disabled={saving}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create role"}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Roles &amp; Permissions</h2>
        <div className="notice" style={{ marginTop: 0 }}>
          A role is a name plus a list of ticks. Give a role to a person on the <b>User Access Management</b> page.
        </div>
        {message && <div className="success" role="status">&#10003; {message}</div>}
        {loadError && <div className="error">{loadError}</div>}
        <div className="row-actions">
          <button className="primary" onClick={startNew}>New role</button>
        </div>
      </div>

      <div className="card">
        <h2>Roles ({data.roles.length})</h2>
        <div className="role-row owner-row">
          <div className="role-head">
            <span className="cat-row-name">Owner</span>
            <span className="badge">1 person</span>
          </div>
          <div className="perm-tags">Everything. This is the account in ADMIN_EMAIL, and it cannot be changed here.</div>
        </div>
        {data.roles.length === 0 && <div className="empty">No roles yet.</div>}
        {data.roles.map((r) => (
          <div className="role-row" key={r.id}>
            <div className="role-head">
              <span className="cat-row-name">{r.name}</span>
              <span className="badge">{r.members} {r.members === 1 ? "person" : "people"}</span>
              <button className="small" onClick={() => startEdit(r)} disabled={busyId === r.id} aria-label={`Edit ${r.name}`}>Edit</button>
              <button className="danger small" onClick={() => deleteRole(r)} disabled={busyId === r.id} aria-label={`Delete ${r.name}`}>Delete</button>
            </div>
            <div className="perm-tags">
              {(r.permissions || []).length === 0
                ? <span className="perm-none">Can only log their own workouts</span>
                : PERMISSIONS.filter((p) => r.permissions.includes(p.key)).map((p) => <span className="tag" key={p.key}>{p.label}</span>)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
