"use client";

import { GENDERS, todayStr } from "../shared/profileFields";

// The six compulsory profile fields. Put it inside <div className="grid">.
// values: { name, dob, gender, weight, height, phone }
// onChange(key, newValue)
export default function ProfileFields({ values, onChange, idPrefix = "pf", autoFill = true }) {
  const set = (key) => (e) => onChange(key, e.target.value);
  const ac = (v) => (autoFill ? v : "off");
  const id = (k) => `${idPrefix}-${k}`;
  return (
    <>
      <div className="field full">
        <label htmlFor={id("name")}>Full name</label>
        <input id={id("name")} type="text" value={values.name} onChange={set("name")} autoComplete={ac("name")} maxLength={100} required />
      </div>
      <div className="field">
        <label htmlFor={id("dob")}>Date of birth</label>
        <input id={id("dob")} type="date" value={values.dob} onChange={set("dob")} min="1900-01-01" max={todayStr()} autoComplete={ac("bday")} required />
      </div>
      <div className="field">
        <label htmlFor={id("gender")}>Gender</label>
        <select id={id("gender")} value={values.gender} onChange={set("gender")} required>
          <option value="">Select…</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("weight")}>Body weight (kg)</label>
        <input id={id("weight")} type="number" inputMode="decimal" step="0.1" min="20" max="400" value={values.weight} onChange={set("weight")} required />
      </div>
      <div className="field">
        <label htmlFor={id("height")}>Height (cm)</label>
        <input id={id("height")} type="number" inputMode="decimal" step="0.1" min="50" max="260" value={values.height} onChange={set("height")} required />
      </div>
      <div className="field full">
        <label htmlFor={id("phone")}>Contact number</label>
        <input id={id("phone")} type="tel" value={values.phone} onChange={set("phone")} autoComplete={ac("tel")} placeholder="+60 12-345 6789" maxLength={20} required />
      </div>
    </>
  );
}
