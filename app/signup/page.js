"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace("/log");
    } else {
      setNotice("Check your email to confirm your account, then sign in.");
    }
  }

  return (
    <div className="center-wrap">
      <h1>🏋️ Workout Log</h1>
      <div className="sub">Create your account</div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}
          <div className="row-actions">
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
      <div className="sub">
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
