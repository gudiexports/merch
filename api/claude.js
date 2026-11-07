// Vercel function: lets signed-in @gudi.net users run Claude from the page.
// The Anthropic key lives only in Vercel's environment variable ANTHROPIC_API_KEY. It is never sent to the browser.
const SUPABASE_URL = "https://pxkhpmatpgkpknxprqsv.supabase.co";
const SUPABASE_KEY = "sb_publishable_WFNgGJFYy3yd3mDMpWBv1Q_kK13TtMy"; // public key
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

function pickJson(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not_configured" });

  // who is calling?
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "sign_in" });
  let email = "";
  try {
    const u = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token } });
    if (u.ok) email = ((await u.json()).email || "").toLowerCase();
  } catch (e) {}
  if (!email.endsWith("@gudi.net")) return res.status(401).json({ error: "sign_in" });

  if (req.method === "GET") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const body = req.body || {};
  const prompt = String(body.prompt || "");
  if (!prompt) return res.status(400).json({ error: "no_prompt" });
  const content = [];
  (Array.isArray(body.images) ? body.images : []).slice(0, 10).forEach((im) => {
    if (im && im.data) content.push({ type: "image", source: { type: "base64", media_type: im.type || "image/jpeg", data: im.data } });
  });
  content.push({ type: "text", text: prompt });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: "Reply with one JSON object only. No markdown fences, no text before or after it.",
        messages: [{ role: "user", content }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      const msg = (j.error && j.error.message) || String(r.status);
      console.error("Anthropic error", r.status, msg);
      if (r.status === 401 || r.status === 403) return res.status(503).json({ error: "bad_key", detail: msg });
      if (r.status === 429 || /credit|billing/i.test(msg)) return res.status(429).json({ error: "rate_limited", detail: msg });
      return res.status(502).json({ error: "claude_error", detail: msg });
    }
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const data = pickJson(text);
    if (!data) { console.error("unreadable reply", String(text).slice(0, 300)); return res.status(502).json({ error: "invalid_json" }); }
    return res.status(200).json({ data });
  } catch (e) {
    console.error("claude function failed", e && e.message);
    return res.status(502).json({ error: "claude_error" });
  }
};

module.exports.config = { maxDuration: 300 };
