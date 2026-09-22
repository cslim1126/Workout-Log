"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { callApi } from "../shared/api";
import { GROUPS_SQL } from "../shared/access";
import Link from "next/link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AccessPage() {
  return <AppShell>{({ isOwner, can }) => <Access isOwner={isOwner} can={can} />}</AppShell>;
}

function Access({ isOwner, can }) {
  const canManage = can("users.create") || can("users.remove") || can("roles.manage") || can("groups.manage");
  const canRoles = can("roles.manage");
  const canGroups = can("groups.manage");
  const canRemove = can("users.remove");
  const [data, setData] = useState(null); // { me, users, groups, groupsReady, groupsMessage }
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(""); // id of the person or group being changed
  const [rowError, setRowError] = useState({}); // person id -> message
  const [groupError, setGroupError] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all"); // all | none | <group id>
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await callApi("/api/users");
    if (!res.ok) {
      setLoadError(res.json.error || "Could not load the users.");
      return;
    }
    setLoadError("");
    setData(res.json);
  }

  useEffect(() => {
    if (canManage) load();
  }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupName = useMemo(() => {
    const map = {};
    if (data) for (const g of data.groups) map[g.id] = g.name;
    return map;
  }, [data]);

  const visibleUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (groupFilter === "none" && u.groupId) return false;
      if (groupFilter !== "all" && groupFilter !== "none" && u.groupId !== groupFilter) return false;
      if (q && !(u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, groupFilter]);

  if (!canManage) {
    return (
      <div className="card">
        <h2>User Access Management</h2>
        <div className="empty">You do not have permission to manage users.</div>
      </div>
    );
  }

  // ---------- people ----------
  async function changeUser(id, change) {
    setBusy(id);
    setRowError((e) => ({ ...e, [id]: "" }));
    const res = await callApi("/api/users", "PATCH", { id, ...change });
    if (!res.ok) setRowError((e) => ({ ...e, [id]: res.json.error || "Could not save." }));
    await load(); // always reload, so the boxes show what is really saved
    setBusy("");
  }

  async function removeUser(u) {
    const label = u.name || u.email;
    const ok = window.confirm(
      `Remove ${label}?\n\nThis permanently deletes their account and ALL their workout data. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(u.id);
    setRowError((e) => ({ ...e, [u.id]: "" }));
    const res = await callApi("/api/users", "DELETE", { id: u.id });
    if (!res.ok) setRowError((e) => ({ ...e, [u.id]: res.json.error || "Could not remove the user." }));
    await load();
    setBusy("");
  }

  // ---------- groups ----------
  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    setGroupError("");
    setBusy("new-group");
    const res = await callApi("/api/groups", "POST", { name });
    if (!res.ok) setGroupError(res.json.error || "Could not create the group.");
    else setNewGroup("");
    await load();
    setBusy("");
  }

  async function renameGroup(g) {
    const name = window.prompt("New name for this group:", g.name);
    if (name === null || name.trim() === "" || name.trim() === g.name) return;
    setGroupError("");
    setBusy(g.id);
    const res = await callApi("/api/groups", "PATCH", { id: g.id, name });
    if (!res.ok) setGroupError(res.json.error || "Could not rename the group.");
    await load();
    setBusy("");
  }

  async function deleteGroup(g) {
    const ok = window.confirm(
      `Delete the group "${g.name}"?\n\n${g.members} ${g.members === 1 ? "person is" : "people are"} in it. They will not be deleted, they will just have no group.`
    );
    if (!ok) return;
    setGroupError("");
    setBusy(g.id);
    const res = await callApi("/api/groups", "DELETE", { id: g.id });
    if (!res.ok) setGroupError(res.json.error || "Could not delete the group.");
    else if (groupFilter === g.id) setGroupFilter("all");
    await load();
    setBusy("");
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(GROUPS_SQL);
      setCopied(true);
    } catch (e) {
      setCopied(false);
    }
  }

  if (loadError && !data) {
    return (
      <div className="card">
        <h2>User Access Management</h2>
        <div className="error" style={{ marginTop: 0 }}>{loadError}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="card">
        <h2>User Access Management</h2>
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const meId = data.me.id;

  return (
    <>
      {canGroups && (
      <div className="card">
        <h2>Groups</h2>
        {!data.groupsReady ? (
          <div>
            <div className="notice" style={{ marginTop: 0 }}>
              Groups are not set up yet. In Supabase, open <b>SQL Editor</b> → <b>New query</b>, paste this, click <b>Run</b>, then refresh this page.
            </div>
            <pre className="sql-box">{GROUPS_SQL}</pre>
            <button className="small" onClick={copySql}>{copied ? "Copied ✓" : "Copy SQL"}</button>
            {data.groupsMessage && <div className="notice">Details: {data.groupsMessage}</div>}
          </div>
        ) : (
          <>
            <div className="chip-row">
              {data.groups.length === 0 && (
                <div className="notice">No groups yet — add one below (for example Team A, Beginners).</div>
              )}
              {data.groups.map((g) => (
                <div className="chip" key={g.id}>
                  {g.name}
                  <span className="badge">{g.members}</span>
                  <button onClick={() => renameGroup(g)} disabled={busy === g.id} title="Rename" aria-label={`Rename ${g.name}`}>✎</button>
                  <button onClick={() => deleteGroup(g)} disabled={busy === g.id} title="Delete" aria-label={`Delete ${g.name}`}>✕</button>
                </div>
              ))}
            </div>
            <div className="inline-add">
              <input
                type="text"
                placeholder="New group name"
                aria-label="New group name"
                value={newGroup}
                maxLength={40}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGroup()}
              />
              <button className="primary small" onClick={addGroup} disabled={busy === "new-group"}>Add group</button>
            </div>
            {groupError && <div className="error">{groupError}</div>}
          </>
        )}
      </div>
      )}

      <div className="card">
        <h2>Users ({data.users.length})</h2>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="Show group">
            <option value="all">All groups</option>
            <option value="none">No group</option>
            {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {!canRoles && (
          <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>
            You do not have permission to change roles.
          </div>
        )}
        {canRoles && data.rolesReady === false && (
          <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>
            Roles are not set up yet. Open <Link href="/roles">Roles &amp; Permissions</Link> once to finish the setup.
          </div>
        )}
        {canRoles && data.rolesReady && data.roles.length > 0 && (
          <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>
            Roles are made on the <Link href="/roles">Roles &amp; Permissions</Link> page.
          </div>
        )}
        {loadError && <div className="error" style={{ marginTop: 0, marginBottom: 10 }}>{loadError}</div>}
        {visibleUsers.length === 0 && <div className="empty">No users match.</div>}

        {visibleUsers.map((u) => {
          const isMe = u.id === meId;
          const mayRemove = canRemove && !isMe && !u.isOwner;
          const working = busy === u.id;
          return (
            <div className="user-row" key={u.id}>
              <div className="user-name">
                {u.name || u.email}
                <span className="badge">{u.isOwner ? "Owner" : u.roleName || "No role"}</span>
                {isMe && <span className="badge">You</span>}
              </div>
              <div className="user-meta">
                {u.name ? `${u.email} · ` : ""}Joined {fmtDate(u.createdAt) || "—"} · Last sign-in {fmtDate(u.lastSignInAt) || "never"}
              </div>
              <div className="user-controls">
                <div className="field">
                  <label htmlFor={`role-${u.id}`}>Role</label>
                  {u.isOwner ? (
                    <div className="static-value" id={`role-${u.id}`}>Owner</div>
                  ) : (
                    <select
                      id={`role-${u.id}`}
                      value={u.roleId || ""}
                      disabled={!canRoles || !data.rolesReady || working}
                      onChange={(e) => changeUser(u.id, { roleId: e.target.value || null })}
                    >
                      <option value="">No role</option>
                      {data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={`group-${u.id}`}>Group</label>
                  <select
                    id={`group-${u.id}`}
                    value={u.groupId || ""}
                    disabled={!data.groupsReady || !canGroups || working}
                    onChange={(e) => changeUser(u.id, { groupId: e.target.value || null })}
                  >
                    <option value="">No group</option>
                    {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                {mayRemove && (
                  <button className="danger small" onClick={() => removeUser(u)} disabled={working}>Remove</button>
                )}
              </div>
              {rowError[u.id] && <div className="error">{rowError[u.id]}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
