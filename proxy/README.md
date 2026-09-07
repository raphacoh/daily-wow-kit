# Assistant proxy (Vercel Functions)

Three tiny serverless functions that let the public GitHub Pages site talk to Claude without
exposing your API key. They check the kids' entrance password, cap usage at **5 sessions per day**
(a session = one device using the assistant or the explanation grader that day), 40 questions per
session, and only answer requests coming from your own site. No npm dependencies, no build step.

```
api/session.js   POST {password}                            -> {token, sessionsLeft, day}
api/chat.js      POST {token, system, messages, max_tokens} -> {text, msgsLeft}
api/status.js    POST {}                                    -> {day, sessionsUsed, sessionsLeft, store, configured}
lib/arto.js      all the logic (password check, caps, CORS, Anthropic call, Upstash Redis over REST)
```

## Deploy (≈10 minutes)

1. Put this `proxy/` folder in its own GitHub repository (e.g. `wow-proxy`, private is fine).
2. Vercel → **Add New… → Project** → import that repo → Framework Preset **Other** → add the
   environment variables below → **Deploy**.
3. Project → **Storage** → **Create Database** → **Upstash** → **Redis** → Free plan → create and
   connect to the project (keep the default `KV_` variable prefix). This is the daily counter.
4. **Deployments** → ⋯ → **Redeploy** the latest deployment so the functions pick up the new variables.
5. Test with the production URL (`https://<project>.vercel.app`, not a preview URL):

```
curl -s -X POST https://<project>.vercel.app/api/status \
  -H 'Origin: https://<yourname>.github.io' -H 'content-type: application/json' -d '{}'
# → {"day":"…","sessionsUsed":0,"sessionsLeft":5,"store":"upstash (KV_*)","configured":{"password":true,"api_key":true}}
```

Your page's `PROXY.url` is then `https://<project>.vercel.app/api`.

## Environment variables

| Name | Required | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes (mark **Sensitive**) | key from https://console.anthropic.com |
| `PASSWORD` | yes | the kids' entrance password — Latin letters/digits are easiest to type, e.g. `sunshine42` |
| `ALLOWED_ORIGINS` | yes | your Pages origin, e.g. `https://yourname.github.io` (comma-separate several) |
| `MAX_SESSIONS_PER_DAY` | no | default `5`; `0` pauses the assistant |
| `MAX_MSGS_PER_SESSION` | no | default `40` |
| `MODEL` | no | default `claude-sonnet-5` |
| `TIMEZONE` | no | default `Asia/Jerusalem` — the day boundary for the cap |
| `DEMO_PASSWORD` | no | a second, public password (e.g. `demo`) for a shared demo page; counted separately |
| `DEMO_MAX_SESSIONS_PER_DAY` | no | default `10` — cap for the demo password |

Upstash's integration injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the `UPSTASH_REDIS_REST_*`
spelling is accepted too). Without a store the functions refuse to run, so the cap can never be silently off.

Wrong password 10× from one IP blocks that IP for an hour. Rotate the password by changing `PASSWORD`,
redeploying, and putting the new SHA-256 hash in the page (`gate_pw_hash` in the ledger).

Cost: Vercel Hobby free tier, Upstash free plan, and roughly $0.01–0.03 of Anthropic API per kid per day.
