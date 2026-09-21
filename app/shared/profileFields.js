// Shared by the sign-up page, the Create User page, the Profile page
// and the server. Every field below is compulsory.

export const GENDERS = ["Male", "Female"];

const pad = (n) => String(n).padStart(2, "0");

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export const EMPTY_PROFILE = { name: "", dob: "", gender: "", weight: "", height: "", phone: "" };

// Turns whatever came in into 6 trimmed text values.
export function normalizeProfile(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const text = (v) => (v === null || v === undefined ? "" : String(v).trim());
  return {
    name: text(r.name),
    dob: text(r.dob),
    gender: text(r.gender),
    weight: text(r.weight),
    height: text(r.height),
    phone: text(r.phone)
  };
}

// Returns a message if something is missing or wrong, or "" if everything is fine.
// "latestDob" is only used by the server (its clock may be a day ahead of yours).
export function checkProfile(raw, latestDob) {
  const p = normalizeProfile(raw);
  const latest = latestDob || todayStr();

  if (!p.name) return "Please enter your full name.";
  if (p.name.length > 100) return "Full name is too long (100 letters at most).";

  if (!p.dob) return "Please choose your date of birth.";
  if (!isRealDate(p.dob)) return "Please enter a real date of birth.";
  if (p.dob > latest) return "Date of birth cannot be in the future.";
  if (p.dob < "1900-01-01") return "Please enter a date of birth after 1900.";

  if (!p.gender) return "Please choose your gender.";
  if (!GENDERS.includes(p.gender)) return "Gender must be Male or Female.";

  if (!p.weight) return "Please enter your body weight (kg).";
  const w = Number(p.weight);
  if (!isFinite(w) || w < 20 || w > 400) return "Body weight must be between 20 and 400 kg.";

  if (!p.height) return "Please enter your height (cm).";
  const h = Number(p.height);
  if (!isFinite(h) || h < 50 || h > 260) return "Height must be between 50 and 260 cm.";

  if (!p.phone) return "Please enter your contact number.";
  if (!/^\+?[0-9][0-9\s\-()]{5,19}$/.test(p.phone)) {
    return "Please enter a valid contact number, for example +60 12-345 6789.";
  }
  return "";
}

// What gets saved inside the person's account.
export function profileMetadata(raw) {
  const p = normalizeProfile(raw);
  const oneDecimal = (s) => Math.round(Number(s) * 10) / 10;
  return {
    full_name: p.name,
    dob: p.dob,
    gender: p.gender,
    body_weight_kg: oneDecimal(p.weight),
    height_cm: oneDecimal(p.height),
    contact_number: p.phone
  };
}

// Turns the saved account data back into form values.
export function profileFromMetadata(m) {
  const meta = m || {};
  return {
    name: meta.full_name || "",
    dob: meta.dob || "",
    gender: GENDERS.includes(meta.gender) ? meta.gender : "",
    weight: meta.body_weight_kg != null ? String(meta.body_weight_kg) : "",
    height: meta.height_cm != null ? String(meta.height_cm) : "",
    phone: meta.contact_number || ""
  };
}
