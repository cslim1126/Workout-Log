"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import ProfileFields from "../components/ProfileFields";
import { EMPTY_PROFILE, checkProfile, profileMetadata } from "../shared/profileFields";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = email + password, 2 = your details
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const changeProfile = (key, value) => setProfile((p) => ({ ...p, [key]: value }));

  // When step 2 opens, put the cursor in the first new field
  useEffect(() => {
    if (step === 2) {
      const el = document.getElementById("su-name");
      if (el) el.focus();
    }
  }, [step]);

  function checkLogin() {
    if (!EMAIL_OK.test(email.trim())) return "Please enter a valid email.";
    if (password.length < 6) return "The password must be at least 6 characters.";
    return "";
  }

  // Step 1 -> Step 2
  function handleNext(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    const problem = checkLogin();
    if (problem) return setError(problem);
    setStep(2);
  }

  function goBack() {
    setError("");
    setNotice("");
    setStep(1);
  }

  // Step 2: create the account
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const loginProblem = checkLogin();
    if (loginProblem) {
      setStep(1);
      return setError(loginProblem);
    }
    const problem = checkProfile(profile);
    if (problem) return setError(problem);

    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: profileMetadata(profile) }
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.replace("/dashboard");
    } else {
      setNotice("Check your email to confirm your account, then sign in.");
    }
  }

  return (
    <div className="center-wrap wide">
      <h1>🏋️ Workout Log</h1>
      <div className="sub">Create your account · Step {step} of 2</div>
      <div className="card">
        {step === 1 ? (
          <form onSubmit={handleNext} noValidate>
            <div className="grid">
              <div className="field full">
                <label htmlFor="su-email">Email</label>
                <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <div className="field full">
                <label htmlFor="su-password">Password (at least 6 characters)</label>
                <input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row-actions">
              <button type="submit" className="primary">Next</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="signup-summary">
              Signing up as <b>{email.trim()}</b>
            </div>
            <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>Now tell us about you. All fields are required.</div>
            <div className="grid">
              <ProfileFields values={profile} onChange={changeProfile} idPrefix="su" />
            </div>
            {error && <div className="error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}
            <div className="row-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={goBack} disabled={loading}>‹ Back</button>
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        )}
      </div>
      <div className="sub">
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
