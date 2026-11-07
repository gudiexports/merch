// Vercel function: lets an admin set a login password for a person (creates the login if it does not exist).
// Needs the Vercel environment variable SUPABASE_SERVICE_ROLE_KEY (the secret key from Supabase). Never sent to the browser.
const SUPABASE_URL = "https://pxkhpmatpgkpknxprqsv.supabase.co";
const SUPABASE_KEY = "sb_publishable_WFNgGJFYy3yd3mDMpWBv1Q_kK13TtMy"; // public key

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const secret = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!secret) return res.status(503).json({ error: "not_configured" });

  // caller must be a signed-in admin
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "sign_in" });
  let acc = null;
  try {
    const a = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_access", { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token, "content-type": "application/json" }, body: "{}" });
    acc = a.ok ? await a.json() : null;
  } catch (e) {}
  if (!acc || !acc.isAdmin) return res.status(403).json({ error: "admins_only" });

  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email.endsWith("@gudi.net")) return res.status(400).json({ error: "bad_email" });
  if (password.length < 8) return res.status(400).json({ error: "short_password" });

  // the person must already be on the Users list
  // new-style secret keys (sb_secret_...) go in apikey only; old JWT-style service keys also go in Authorization
  const H = { apikey: secret, "content-type": "application/json" };
  if (!secret.startsWith("sb_secret_")) H.Authorization = "Bearer " + secret;
  try {
    const listed = await fetch(SUPABASE_URL + "/rest/v1/app_users?select=email&email=eq." + encodeURIComponent(email), { headers: H });
    if (!listed.ok) { console.error("admin-user lookup failed", listed.status, (await listed.text()).slice(0, 200)); return res.status(502).json({ error: "lookup_failed" }); }
    const rows = await listed.json();
    if (!rows.length) return res.status(400).json({ error: "not_listed" });

    // try to create the login
    const c = await fetch(SUPABASE_URL + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true }) });
    if (c.ok) return res.status(200).json({ ok: true, created: true });

    // already has a login: find it and change the password
    let id = null;
    for (let page = 1; page <= 20 && !id; page++) {
      const l = await fetch(SUPABASE_URL + "/auth/v1/admin/users?page=" + page + "&per_page=200", { headers: H });
      if (!l.ok) break;
      const j = await l.json();
      const users = j.users || [];
      const m = users.find((u) => String(u.email || "").toLowerCase() === email);
      if (m) id = m.id;
      if (users.length < 200) break;
    }
    if (!id) { console.error("admin-user create failed", c.status); return res.status(502).json({ error: "failed" }); }
    const u = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + id, { method: "PUT", headers: H, body: JSON.stringify({ password, email_confirm: true }) });
    if (!u.ok) { console.error("admin-user update failed", u.status); return res.status(502).json({ error: "failed" }); }
    return res.status(200).json({ ok: true, created: false });
  } catch (e) {
    console.error("admin-user error", e && e.message);
    return res.status(502).json({ error: "failed" });
  }
};
