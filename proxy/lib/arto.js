/**
 * Assistant proxy — shared logic for the three Vercel Functions in /api.
 *
 * Lets your public GitHub Pages site talk to Claude
 * without exposing the API key, gated by the kids' password and hard daily caps.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY      (sensitive) your Anthropic API key
 *   PASSWORD               the kids' entrance password, e.g. "sunshine42"
 *   ALLOWED_ORIGINS        REQUIRED, comma-separated — your GitHub Pages origin, e.g. "https://yourname.github.io"
 *   MAX_SESSIONS_PER_DAY   optional, default 5   (a session = one device using the assistant or the grader that day)
 *   DEMO_PASSWORD          optional — a second, public password for a demo page; its sessions are counted separately
 *   DEMO_MAX_SESSIONS_PER_DAY  optional, default 10 (cap for the demo password)
 *   MAX_MSGS_PER_SESSION   optional, default 40
 *   MODEL                  optional, default "claude-sonnet-5"
 *   TIMEZONE               optional, default "Asia/Jerusalem" (day boundary for the cap)
 *
 * Counter store: Upstash Redis added from the project's Storage tab. Its integration injects
 *   KV_REST_API_URL + KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * — both spellings are accepted.
 *
 * Endpoints (POST JSON; CORS restricted to ALLOWED_ORIGINS):
 *   /api/session  {password}                            -> {token, sessionsLeft, day}
 *   /api/chat     {token, system, messages, max_tokens} -> {text, msgsLeft}
 *   /api/status   {}                                    -> {day, sessionsUsed, sessionsLeft, store, model, configured, demo?}
 */

const DEFAULTS = {
  ALLOWED_ORIGINS: '',
  MAX_SESSIONS_PER_DAY: 5,
  DEMO_MAX_SESSIONS_PER_DAY: 10,
  MAX_MSGS_PER_SESSION: 40,
  MODEL: 'claude-sonnet-5',
  TIMEZONE: 'Asia/Jerusalem',
  MAX_OUTPUT_TOKENS: 700,
  SESSION_TTL_SECONDS: 6 * 3600,
  MAX_PASSWORD_FAILS_PER_HOUR: 10,
};

export async function handle(request, route) {
  const env = process.env;
  const cfg = { ...DEFAULTS, ...pick(env, Object.keys(DEFAULTS)) };
  const allowed = String(cfg.ALLOWED_ORIGINS).split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  if (!allowed.length) return json({ error: 'origins_not_configured', hint: 'Set ALLOWED_ORIGINS to your GitHub Pages origin, e.g. https://yourname.github.io' }, 500, {});
  const origin = request.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!allowed.includes(origin)) return json({ error: 'forbidden_origin' }, 403, cors);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const kv = store(env);
  if (!kv) return json({ error: 'store_not_configured', hint: 'Add Upstash Redis from the Storage tab and redeploy' }, 500, cors);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();

  try {
    if (route === 'session') return await session(body, env, cfg, cors, ip, kv);
    if (route === 'chat') return await chat(body, env, cfg, cors, kv);
    if (route === 'status') return await status(env, cfg, cors, kv);
    return json({ error: 'not_found' }, 404, cors);
  } catch (e) {
    return json({ error: 'server_error', detail: String(e && e.message || e) }, 500, cors);
  }
}

/* ---------- handlers ---------- */

async function session(body, env, cfg, cors, ip, kv) {
  if (!env.PASSWORD) return json({ error: 'password_not_configured' }, 500, cors);

  // brute-force guard per IP
  const failKey = `fails:${ip}`;
  const fails = Number(await kv.get(failKey)) || 0;
  if (fails >= Number(cfg.MAX_PASSWORD_FAILS_PER_HOUR)) return json({ error: 'too_many_attempts' }, 429, cors);

  const pw = String(body.password || '');
  const isDemo = !!env.DEMO_PASSWORD && await safeEqual(pw, String(env.DEMO_PASSWORD));
  const ok = isDemo || await safeEqual(pw, String(env.PASSWORD));
  if (!ok) {
    await kv.incr(failKey, 3600);
    return json({ error: 'wrong_password' }, 401, cors);
  }

  const day = localDay(cfg.TIMEZONE);
  const scope = isDemo ? 'demo' : 'kids';
  const max = Number(isDemo ? cfg.DEMO_MAX_SESSIONS_PER_DAY : cfg.MAX_SESSIONS_PER_DAY);
  const dayKey = isDemo ? `demo:day:${day}` : `day:${day}`;
  const used = await kv.incr(dayKey, 3 * 86400);                 // atomic: nobody can slip past the cap
  if (used > max) { await kv.decr(dayKey); return json({ error: 'daily_limit', sessionsLeft: 0, day, scope }, 429, cors); }

  const token = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8);
  await kv.set(`sess:${token}`, JSON.stringify({ msgs: 0, day, scope, created: Date.now() }), Number(cfg.SESSION_TTL_SECONDS));
  return json({ token, sessionsLeft: max - used, day, scope }, 200, cors);
}

async function chat(body, env, cfg, cors, kv) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'api_key_not_configured' }, 500, cors);
  const token = String(body.token || '');
  if (!/^[0-9a-f-]{30,60}$/i.test(token)) return json({ error: 'bad_token' }, 401, cors);

  const sessKey = `sess:${token}`;
  const raw = await kv.get(sessKey);
  if (!raw) return json({ error: 'session_expired' }, 401, cors);
  const sess = JSON.parse(raw);
  const maxMsgs = Number(cfg.MAX_MSGS_PER_SESSION);
  if (sess.msgs >= maxMsgs) return json({ error: 'session_limit', msgsLeft: 0 }, 429, cors);

  // validate the payload — small, bounded, plain text only
  const system = String(body.system || '').slice(0, 12000);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = String(m.content || '').slice(0, 4000);
    if (!content.trim()) continue;
    if (clean.length && clean[clean.length - 1].role === m.role) { clean[clean.length - 1].content += '\n' + content; continue; }
    clean.push({ role: m.role, content });
  }
  if (!clean.length || clean[clean.length - 1].role !== 'user') return json({ error: 'bad_messages' }, 400, cors);
  const maxTokens = Math.min(Number(body.max_tokens) || 500, Number(cfg.MAX_OUTPUT_TOKENS));

  // count the message before calling, so a flood cannot outrun the cap
  sess.msgs += 1;
  await kv.set(sessKey, JSON.stringify(sess), Number(cfg.SESSION_TTL_SECONDS));

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: cfg.MODEL, max_tokens: maxTokens, system, messages: clean }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: 'upstream_error', status: upstream.status, detail: detail.slice(0, 300) }, 502, cors);
  }
  const data = await upstream.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return json({ text, msgsLeft: maxMsgs - sess.msgs }, 200, cors);
}

async function status(env, cfg, cors, kv) {
  const day = localDay(cfg.TIMEZONE);
  const max = Number(cfg.MAX_SESSIONS_PER_DAY);
  const used = Math.min(Number(await kv.get(`day:${day}`)) || 0, max);
  const out = { day, sessionsUsed: used, sessionsLeft: Math.max(0, max - used), store: kv.name, model: cfg.MODEL,
    configured: { password: !!env.PASSWORD, api_key: !!env.ANTHROPIC_API_KEY, demo: !!env.DEMO_PASSWORD } };
  if (env.DEMO_PASSWORD) {
    const dmax = Number(cfg.DEMO_MAX_SESSIONS_PER_DAY), dused = Math.min(Number(await kv.get(`demo:day:${day}`)) || 0, dmax);
    out.demo = { sessionsUsed: dused, sessionsLeft: Math.max(0, dmax - dused) };
  }
  return json(out, 200, cors);
}

/* ---------- Upstash Redis over REST (no npm dependency) ---------- */

function store(env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const call = async cmds => {
    const r = await fetch(url.replace(/\/+$/, '') + '/pipeline', {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error('redis_' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120));
    const out = await r.json();
    const bad = out.find(x => x && x.error); if (bad) throw new Error('redis: ' + bad.error);
    return out.map(x => x.result);
  };
  return {
    name: env.KV_REST_API_URL ? 'upstash (KV_*)' : 'upstash (UPSTASH_*)',
    get: async k => (await call([['GET', k]]))[0],
    set: async (k, v, ttl) => call([['SET', k, v, 'EX', ttl]]),
    incr: async (k, ttl) => Number((await call([['INCR', k], ['EXPIRE', k, ttl]]))[0]),
    decr: async k => call([['DECR', k]]),
  };
}

/* ---------- helpers ---------- */

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function pick(obj, keys) { const o = {}; for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') o[k] = obj[k]; return o; }
function localDay(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
