# Architecture

Everything is built so that **no server of yours is ever needed** for the site itself, the only secret
(an Anthropic API key) sits in one place, and a parent stays in the loop by email.

```
 07:30  topic menu ──► parent's inbox: 5 candidates for tomorrow  (parent replies with a pick, or not)
 02:00  nightly builder ──► settles yesterday (streaks/XP) ──► builds the new edition from yesterday's
        ──► Playwright check ──► reviewer agent (until PASS) ──► review copy (Claude artifact)
        ──► ledger (dashboard db) ──► review email to the parent + a draft of the kids' email
 11:00  release routine ──► reads the review thread (HOLD? changes?) ──► pushes to GitHub Pages
        ──► sends the kids' email ──► replies on the review thread
```

## Pieces

| Piece | Lives in | Notes |
|---|---|---|
| **Edition page** | `daily-wow` repo → GitHub Pages | one self-contained HTML file per day; root `index.html` = today, `e/NNN/` = archive, `editions.json` = release record |
| **Template** | `template/edition-template.html` | the engine every edition inherits: tracks, stations, quiz renderers, dictation, vault, XP/levels/badges, assistant chat, entrance gate, proxy client |
| **Assistant proxy** | Vercel Functions + Upstash Redis | password gate, 5 sessions/day, 40 msgs/session, CORS to your Pages origin, forwards to the Anthropic API |
| **Ledger** | database of a private Claude artifact (the parents' dashboard) | kids' stats, editions, menus, config — read/written with the Artifact tool |
| **Review copies** | dated Claude artifacts (`sample` capability) | the parent's private copy; inside Claude the assistant answers without the proxy |
| **Schedules** | 2 Cowork scheduled tasks + 1 Claude Code routine | see `prompts/README.md` for why two schedulers |

## The page, in one paragraph

A `<title>` + `<link>` (Google Fonts) + `<style>` + markup fragment (the release routine wraps it in a
full `<html lang dir>` document). Constants at the top of the script are all an edition needs to know:
`EDITION` (number, code, date, title, parent email), `KIDS` (names, gender, age, grade for the two
tracks — the markup fills itself from it), `STATS` (each kid's streak/XP/badges as of yesterday),
`PW_ENC` (the daily password, base64 of the reversed UTF-8 string), `PROXY` (proxy URL + SHA-256 of the
entrance password; both empty = no gate and no assistant on the public site), `LEVELS`. Then: a sticky
progress bar, sequential `.step` sections revealed by `goTo(n)`, quick-checks and MCQs with per-option
feedback, a tap-to-order task, numeric tasks, explain-it-back with Web Speech dictation and AI grading
(rubric fallback), `finish()` computing score → XP → level → streak → badges and opening the password
vault only when everything was done, a `mailto:` completion report with a machine line
`WOW-NNN|track|score|max|done`, and the assistant chat. The `AI` object picks the backend: `sample`
inside Claude, the `PX` proxy client on the public site, or none (friendly fallback).

Track ids are fixed (`younger`, `older`); names come from `KIDS`. In an RTL language every formula is
wrapped in `<span class="math">` (LTR isolate) and bare/signed numbers in `.num`.

## Ledger schema

```
meta/config      {parent_email, kids_emails[], kids_url, pages_base, github_repo, next_n,
                  xp_rule, levels, proxy_url, gate_pw_hash}
kids/younger     {name, streak, best, xp, level, badges[], last_done_date, history[{n,date,score,max,xp,complete}]}
kids/older       same
editions/eNNN    {n, code "WOW-NNN", date, title, topics[], summary, url (review artifact), pages_url,
                  password, max_score, reviewed, sent, sent_at, done:{younger:{score,max,at,source}|null, older:…}}
menus/eNNN       {n, for_date, options:[{k, title, hook, domains[], try_at_home}], default_k, chosen}
```

XP for a day = `score × 10 + 20 (if complete) + min(50, streak_after × 5)`. Levels at 0 / 150 / 400 /
800 / 1500 / 2500 / 4000 XP. A missed day resets the streak to 0 (best is kept).

## Security model

- The page is public static HTML. It contains the SHA-256 of the entrance password, the proxy URL, the parent's email (for the completion `mailto:`), the kids' first names, and the day's secret password as reversed base64 (a deterrent, not encryption). No API key, no other personal data.
- The proxy holds the Anthropic key. It answers only its allowed origin, only with the right password, at most N sessions a day (Redis counter, atomic), M messages per session, and blocks an IP after 10 wrong passwords in an hour. Worst case if the password leaks: 5 × 40 short answers a day, a few cents.
- An optional second password (`DEMO_PASSWORD`) opens the same proxy for a public demo under its own daily cap; the kids' quota is untouched.
- Emails never contain the daily password to the kids; the review email to the parent does.
- The assistant persona is kid-safe by prompt; the proxy also bounds prompt and reply sizes.

## Lessons that are baked in (so you don't relearn them)

- RTL languages: formulas must be isolated LTR or they render scrambled — including dynamic text and chat replies.
- Keep an edition at 20–30 minutes; the first attempt was an hour.
- The reviewer agent catches real things (clipped diagrams, a sun drawn in the wrong place, gender slips, phone overflow). Keep it.
- GitHub Pages cannot run code — hence the proxy. GitHub Actions cannot answer a browser in real time.
- Cowork tasks cannot reach GitHub; Claude Code routines can (repo attached) but cannot write the ledger unattended. Split accordingly.
- Serverless functions are stateless — the daily cap needs the Redis store; the functions refuse to run without it.
- The page must time out proxy calls and fall back (rubric / message) — Wi-Fi dies.
