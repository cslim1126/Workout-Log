"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import ProfileFields from "../components/ProfileFields";
import { EMPTY_PROFILE, checkProfile } from "../shared/profileFields";

export default function UsersPage() {
  return <AppShell>{({ canManage }) => <CreateUser canManage={canManage} />}</AppShell>;
}

function CreateUser({ canManage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!canManage) {
    return (
      <div className="card">
        <h2>Create User</h2>
        <div className="empty">Only the owner and admins can create users.</div>
      </div>
    );
  }

  const changeProfile = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setSuccess("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Please enter a valid email.");
    if (password.length < 6) return setError("The password must be at least 6 characters.");
    const problem = checkProfile(profile);
    if (problem) return setError(problem);

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
        body: JSON.stringify({ email: cleanEmail, password, profile })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not create the user.");
      } else {
        setSuccess(`Account created for ${cleanEmail}. They can sign in now with the password you typed.`);
        setEmail("");
        setPassword("");
        setProfile(EMPTY_PROFILE);
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
        Make an account for another person. All fields are required.
        Send them the email and password yourself. Their workout data is private to them.
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid">
          <div className="field">
            <label htmlFor="cu-email">Email</label>
            <input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSuccess(""); }}
              autoComplete="off"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cu-password">Password (at least 6 characters)</label>
            <input
              id="cu-password"
              type="text"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setSuccess(""); }}
              autoComplete="off"
              minLength={6}
              required
            />
          </div>
        </div>
        <h3 style={{ marginTop: 18 }}>Their details</h3>
        <div className="grid">
          <ProfileFields values={profile} onChange={changeProfile} idPrefix="cu" autoFill={false} />
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
