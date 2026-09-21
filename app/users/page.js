"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

export default function UsersPage() {
  return <AppShell>{({ isOwner }) => <CreateUser isOwner={isOwner} />}</AppShell>;
}

function CreateUser({ isOwner }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOwner) {
    return (
      <div className="card">
        <h2>Create User</h2>
        <div className="empty">Only the owner of this app can create users.</div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session ? data.session.access_token : "";
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not create the user.");
      } else {
        setSuccess(`Account created for ${email.trim()}. They can sign in now with the password you typed.`);
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setError("Could not reach the server. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <h2>Create User</h2>
      <div className="notice" style={{ marginTop: 0, marginBottom: 12 }}>
        Make an account for another person. Send them the email and password yourself.
        Their workout data is private to them.
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="field">
            <label>Password (at least 6 characters)</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              minLength={6}
              required
            />
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">✓ {success}</div>}
        <div className="row-actions">
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}
