import { requirePermission, json, ID_PATTERN } from "../../shared/serverAuth";

// Reading someone else's workout history (read only).
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { admin, response } = await requirePermission(request, "history.view", "see other users' workout history");
    if (response) return response;

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";

    // Who can be looked at: everyone, with just a name to show in the list.
    if (!userId) {
      const people = [];
      for (let page = 1; page <= 50; page++) {
        const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (list.error) return json({ error: "Could not load the people." }, 500);
        const batch = (list.data && list.data.users) || [];
        for (const u of batch) {
          people.push({ id: u.id, email: u.email || "", name: (u.user_metadata && u.user_metadata.full_name) || "" });
        }
        if (batch.length < 200) break;
      }
      people.sort((a, b) => (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()));
      return json({ people });
    }

    if (!ID_PATTERN.test(userId)) return json({ error: "Unknown user." }, 400);
    const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    let query = admin.from("logs").select("*").eq("user_id", userId);
    if (isDate(from)) query = query.gte("log_date", from);
    if (isDate(to)) query = query.lte("log_date", to);
    const { data, error } = await query
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return json({ error: "Could not load that person's workouts." }, 500);
    return json({ entries: data || [] });
  } catch (e) {
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
