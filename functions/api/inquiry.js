const LEVELS = ["Complete Beginner", "Beginner", "Elementary", "Intermediate", "Upper Intermediate", "Advanced", "Not Sure Yet"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["Morning (8 am – 12 pm)", "Afternoon (12 pm – 5 pm)", "Evening (5 pm – 8 pm)", "Flexible"];
const PHONE = /^\+?[\d\s().-]{7,40}$/;
const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
const safeCell = (value) => (/^[=+\-@]/.test(value) ? "'" + value : value);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Verifies the Turnstile token with Cloudflare. Returns "ok", "failed" or "unavailable" (network/timeout/5xx).
// Optional env var ALLOWED_HOSTNAMES (comma separated, e.g. "spanishwithlisa.com,www.spanishwithlisa.com")
// also rejects tokens that were solved on another hostname.
async function verifyTurnstile(token, ip, env) {
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) return "unavailable";
    const out = await res.json();
    if (!out || out.success !== true) return "failed";
    const allowed = String(env.ALLOWED_HOSTNAMES || "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(String(out.hostname || "").toLowerCase())) return "failed";
    return "ok";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.TURNSTILE_SECRET_KEY || !env.GOOGLE_SHEETS_WEBHOOK_URL || !env.GOOGLE_SHEETS_WEBHOOK_SECRET) {
    return json({ error: "The inquiry service is not configured yet. Please try again later." }, 503);
  }
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Expected JSON" }, 415);
  const raw = await request.text();
  if (raw.length > 10000) return json({ error: "Payload too large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request" }, 400); }
  if (body.website) return json({ success: true });

  const row = {
    name: clean(body.name, 100),
    phone: clean(body.phone, 40),
    email: clean(body.email, 160).toLowerCase(),
    level: clean(body.level, 40),
    interests: Array.isArray(body.interests) ? body.interests.map(x => clean(x, 60)).slice(0, 8) : [],
    days: Array.isArray(body.days) ? body.days.map(x => clean(x, 3)).slice(0, 7) : [],
    time: clean(body.time, 40),
    comments: clean(body.comments, 2000),
    privacyConsent: body.privacyConsent === true,
    consentTimestamp: clean(body.consentTimestamp, 40),
    privacyVersion: clean(body.privacyVersion, 20),
    receivedAt: new Date().toISOString()
  };
  const digits = row.phone.replace(/\D/g, "");
  if (!row.name || (row.phone && (!PHONE.test(row.phone) || digits.length < 7 || digits.length > 15)) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email) || !LEVELS.includes(row.level) || !row.interests.length || !row.interests.every(x => ["Everyday Conversations", "Spanish for Traveling", "Pronunciation", "Vocabulary", "Grammar", "Salvadoran Expressions & Culture", "Speaking Confidence"].includes(x)) || !row.days.length || !row.days.every(x => DAYS.includes(x)) || !TIMES.includes(row.time) || !row.privacyConsent) {
    return json({ error: "Please review the required fields." }, 400);
  }

  const token = clean(body.token, 4096);
  if (!token) return json({ error: "Complete the security check." }, 403);
  const check = await verifyTurnstile(token, request.headers.get("CF-Connecting-IP"), env);
  if (check === "unavailable") return json({ error: "The security check is temporarily unavailable. Please try again in a few minutes." }, 503);
  if (check !== "ok") return json({ error: "Security verification failed. Please try again." }, 403);

  const safeRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === "phone" ? value : Array.isArray(value) ? value.map(safeCell) : typeof value === "string" ? safeCell(value) : value]));
  let sheetResponse;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    sheetResponse = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.GOOGLE_SHEETS_WEBHOOK_SECRET, inquiry: safeRow }),
      signal: controller.signal
    });
  } catch {
    return json({ error: "We could not save your request. Please try again later." }, 502);
  } finally {
    clearTimeout(timer);
  }
  if (!sheetResponse.ok) return json({ error: "We could not save your request. Please try again later." }, 502);
  let result;
  try { result = await sheetResponse.json(); } catch { result = null; }
  if (!result || result.success !== true) return json({ error: "The request was not confirmed as saved." }, 502);
  return json({ success: true });
}
