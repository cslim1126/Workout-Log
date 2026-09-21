"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";
import ProfileFields from "../components/ProfileFields";
import { EMPTY_PROFILE, checkProfile, profileMetadata, profileFromMetadata } from "../shared/profileFields";

export default function ProfilePage() {
  return <AppShell>{() => <Profile />}</AppShell>;
}

function Profile() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // Load the saved profile (it is saved inside the person's own account)
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data || !data.user) {
        setLoadError((error && error.message) || "Could not load your profile. Please refresh the page.");
        return;
      }
      setEmail(data.user.email || "");
      setProfile(profileFromMetadata(data.user.user_metadata));
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // typing in a field clears the old "saved" message
  const changeProfile = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setProfileSuccess("");
  };

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    const problem = checkProfile(profile);
    if (problem) {
      setProfileError(problem);
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: profileMetadata(profile) });
    setSaving(false);
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileSuccess("Profile saved.");
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (!currentPw) return setPwError("Enter your current password.");
    if (newPw.length < 6) return setPwError("The new password must be at least 6 characters.");
    if (newPw !== confirmPw) return setPwError("The new passwords do not match.");
    if (newPw === currentPw) return setPwError("The new password must be different from the current password.");

    setChanging(true);
    // Check the current password first (this also proves it is really you)
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (checkError) {
      setChanging(false);
      setPwError(
        /invalid login/i.test(checkError.message)
          ? "Your current password is not correct."
          : checkError.message
      );
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChanging(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwSuccess("Password changed. Use your new password next time you sign in.");
  }

  return (
    <>
      <div className="card">
        <h2>My profile</h2>
        {loadError ? (
          <div className="error" style={{ marginTop: 0 }}>{loadError}</div>
        ) : !ready ? (
          <div className="empty">Loading…</div>
        ) : (
          <form onSubmit={saveProfile} noValidate>
            <div className="notice" style={{ marginTop: 0, marginBottom: 10 }}>All fields are required.</div>
            <div className="grid">
              <div className="field full">
                <label htmlFor="pf-email">Email</label>
                <input id="pf-email" type="email" value={email} disabled readOnly />
              </div>
              <ProfileFields values={profile} onChange={changeProfile} idPrefix="pf" />
            </div>
            {profileError && <div className="error">{profileError}</div>}
            {profileSuccess && <div className="success">✓ {profileSuccess}</div>}
            <div className="row-actions">
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Change password</h2>
        <form onSubmit={changePassword} noValidate>
          <div className="grid">
            <div className="field full">
              <label htmlFor="pw-current">Current password</label>
              <input id="pw-current" type="password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwSuccess(""); }} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwSuccess(""); }} autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwSuccess(""); }} autoComplete="new-password" />
            </div>
          </div>
          <div className="notice">The new password needs at least 6 characters.</div>
          {pwError && <div className="error">{pwError}</div>}
          {pwSuccess && <div className="success">✓ {pwSuccess}</div>}
          <div className="row-actions">
            <button type="submit" className="primary" disabled={changing}>
              {changing ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
