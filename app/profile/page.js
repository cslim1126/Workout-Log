"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppShell from "../components/AppShell";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const pad = (n) => String(n).padStart(2, "0");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Returns a message if something is wrong, or "" if everything is fine.
function checkProfile({ name, dob, weight, height, phone }) {
  if (name.trim().length > 100) return "Full name is too long (100 letters at most).";
  if (dob) {
    if (!isRealDate(dob)) return "Please enter a real date of birth.";
    if (dob > todayStr()) return "Date of birth cannot be in the future.";
    if (dob < "1900-01-01") return "Please enter a date of birth after 1900.";
  }
  if (weight !== "") {
    const n = Number(weight);
    if (!isFinite(n) || n < 20 || n > 400) return "Body weight must be between 20 and 400 kg.";
  }
  if (height !== "") {
    const n = Number(height);
    if (!isFinite(n) || n < 50 || n > 260) return "Height must be between 50 and 260 cm.";
  }
  if (phone.trim() && !/^\+?[0-9][0-9\s\-()]{5,19}$/.test(phone.trim())) {
    return "Please enter a valid contact number, for example +60 12-345 6789.";
  }
  return "";
}

const oneDecimal = (s) => Math.round(Number(s) * 10) / 10;

export default function ProfilePage() {
  return <AppShell>{() => <Profile />}</AppShell>;
}

function Profile() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [phone, setPhone] = useState("");
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
      const m = data.user.user_metadata || {};
      setEmail(data.user.email || "");
      setName(m.full_name || "");
      setDob(m.dob || "");
      setGender(m.gender || "");
      setWeight(m.body_weight_kg != null ? String(m.body_weight_kg) : "");
      setHeight(m.height_cm != null ? String(m.height_cm) : "");
      setPhone(m.contact_number || "");
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // typing in a field clears the old "saved" message
  const edit = (setter) => (e) => {
    setter(e.target.value);
    setProfileSuccess("");
  };

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    const problem = checkProfile({ name, dob, weight, height, phone });
    if (problem) {
      setProfileError(problem);
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim() || null,
        dob: dob || null,
        gender: gender || null,
        body_weight_kg: weight === "" ? null : oneDecimal(weight),
        height_cm: height === "" ? null : oneDecimal(height),
        contact_number: phone.trim() || null
      }
    });
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
            <div className="grid">
              <div className="field full">
                <label htmlFor="pf-email">Email</label>
                <input id="pf-email" type="email" value={email} disabled readOnly />
              </div>
              <div className="field full">
                <label htmlFor="pf-name">Full name</label>
                <input id="pf-name" type="text" value={name} onChange={edit(setName)} autoComplete="name" maxLength={100} />
              </div>
              <div className="field">
                <label htmlFor="pf-dob">Date of birth</label>
                <input id="pf-dob" type="date" value={dob} onChange={edit(setDob)} min="1900-01-01" max={todayStr()} autoComplete="bday" />
              </div>
              <div className="field">
                <label htmlFor="pf-gender">Gender</label>
                <select id="pf-gender" value={gender} onChange={edit(setGender)}>
                  <option value="">Select…</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pf-weight">Body weight (kg)</label>
                <input id="pf-weight" type="number" inputMode="decimal" step="0.1" min="20" max="400" value={weight} onChange={edit(setWeight)} />
              </div>
              <div className="field">
                <label htmlFor="pf-height">Height (cm)</label>
                <input id="pf-height" type="number" inputMode="decimal" step="0.1" min="50" max="260" value={height} onChange={edit(setHeight)} />
              </div>
              <div className="field full">
                <label htmlFor="pf-phone">Contact number</label>
                <input id="pf-phone" type="tel" value={phone} onChange={edit(setPhone)} autoComplete="tel" placeholder="+60 12-345 6789" maxLength={20} />
              </div>
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
