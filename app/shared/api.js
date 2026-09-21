import { supabase } from "../../lib/supabaseClient";

// Calls one of our own server routes as the signed-in person.
// Always returns { ok, status, json } and never throws.
export async function callApi(path, method = "GET", body) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session ? data.session.access_token : "";
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: "Could not reach the server. Please try again." } };
  }
}
