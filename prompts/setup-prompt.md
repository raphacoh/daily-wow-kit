# Setup prompt — paste this into a new Claude Cowork session

**Before pasting (15 minutes, once):**

1. You need Claude with **Cowork** and the **Gmail connector** connected to your (the parent's) Gmail, plus access to **Claude Code routines** (claude.ai/code/routines) — same subscription.
2. On GitHub, create a **public** repository named **`daily-wow`** (GitHub Pages from a private repo needs a paid GitHub plan), add the kit's `template/library.html` as `e/index.html` (the library of past editions) and an empty `.nojekyll`, and enable **Settings → Pages → Deploy from a branch → main / (root)**. Your kids' site will be `https://<your-username>.github.io/daily-wow/`.
3. Deploy the assistant proxy from this kit's `proxy/` folder on Vercel (10 minutes, free — see `proxy/README.md`). Note the production URL and the password you chose.
4. Fill in every `[bracket]` in the block below, paste the whole block (from `=== PROMPT START ===` to `=== PROMPT END ===`) as your first message, and answer Claude's few questions. It will build edition #1, set up the automation, and email you the first review.
5. Do the one-time things in the checklist at the bottom (mainly: create the release routine by pasting a prompt Claude will hand you, and give the kids the password).

---

=== PROMPT START ===

You are going to set up and run **"The Daily Wow"** for my kids: an agent that every day creates a brand-new interactive learning website for them, in our language, on a new topic mixing science, engineering, maths, biology, physics, space, history or geography — explained in an engaging, interactive way, with a test at the end, 20–30 minutes in total. Everything below is a spec that is already built and running for another family. **Do not redesign it — reuse the kit.** The kit is the public GitHub repository https://github.com/raphacoh/daily-wow-kit . Fetch its files over HTTPS from https://raw.githubusercontent.com/raphacoh/daily-wow-kit/main/ (docs/architecture.md, …/main/template/edition-template.html, …/main/template/check.js, …/main/prompts/nightly-builder.md, …/main/prompts/topic-menu.md, …/main/prompts/release-routine.md). Read `docs/architecture.md` first.

## 0. My family (fill-ins)

- Kids: `[Name 1]`, `[age, e.g. 8–9]`, `[boy/girl]`, grade `[e.g. 3–4]` — the **younger track**; and `[Name 2]`, `[age]`, `[boy/girl]`, grade `[e.g. 5–6]` — the **older track**. *(One kid is fine — then build one track. More kids are fine too — each one is an entry in the template's `KIDS` map with a `track`; a cousin gets `cc: [their parent's email]` so that parent is copied on the completion mail and receives a short daily report. Mark a kid you want pushed harder with `level:'advanced'`: they get the harder twin of the numeric task, the challenge panel addressed to them, and a pushier assistant and grader.)*
- Language of the kids' site and of the emails to the kids: `[Hebrew / French / English / …]`. Language of the emails to me: `[English / French / …]`.
- Time zone: `[e.g. Europe/Paris]`. Where we live (for local hooks): `[town, country]`.
- My name and email (review + reports): `[Name]`, `[parent@example.com]`. Kids' email(s) for the daily edition: `[kid@example.com]` (leave empty to send everything to me for now).
- Series name (the brand the kids see): `[e.g. "Le Waouh du jour"]`. Assistant character: `[e.g. a witty librarian from the Library of Alexandria named Arto]`.
- Times (local): topic menu `[07:30]`, nightly build `[02:00]`, release to the kids `[11:00]`.
- GitHub username: `[username]` — the public repository `[username]/daily-wow` exists, is empty, and has GitHub Pages enabled from `main`.
- Assistant proxy (already deployed from the kit's `proxy/` folder): production URL `[https://xxx.vercel.app]` — everywhere it is stored or used (`meta/config.proxy_url`, `PROXY.url`) it takes the `/api` suffix: `https://xxx.vercel.app/api`; the kids' entrance password is `[password]` — store **only its SHA-256 hex** in the ledger and the page, never the password itself.

## 1. What one edition is

A single self-contained HTML page (all CSS/JS inline, no external assets except Google Fonts), mobile-first. One site for both kids with **two tracks**: on the first screen each kid taps their name; shared story and core explanation, then track-specific sections, quiz difficulty and prompts. Younger track: concrete, very short sentences, hands-on. Older track: the *why*, one deeper mechanism or a real calculation.

Structure (sequential "stations", each revealed with a Continue button, with a progress bar in a sticky top bar): **hero** (title, a one-paragraph hook that makes a 9-year-old say "what?!", a predict-before-you-learn control, the track picker) → **3–5 short chapters** telling one real story, each with a hands-on interactive (slider simulations, toggles, canvas/SVG animations, tap-to-reveal; at least 3 interactives that actually teach the mechanism) and one quick-check → **track chapter** (younger: a try-at-home experiment with a small calculator; older: the mechanism with a simulation and a real calculation) → **connections** (4 tiny tiles to other domains + an optional 2-minute bonus game) → **the test** (8–10 min: 4 multiple-choice = 3 shared + 1 per track, each option with an explanation; one tap-to-order task; one numeric task per track; and "now you are the teacher" — the kid explains the idea in their own words, typed or dictated, graded by Claude with a self-check rubric fallback and a model answer) → **results** (score ring, "3 things to tell at dinner", guess-vs-reality reveal, gamification) → a collapsed **"for adults: sources and accuracy"** footer.

**The assistant.** A floating "Didn't get it? Ask [assistant]" button opens a chat with a persona prompt holding the full lesson context: simple warm language at the kid's level, examples from kids' lives, hints instead of answers on test questions, happy to go further on any related question, kid-safe, no emoji. On the public site the chat and the explanation grader go through the **proxy** (password-gated, 5 sessions/day); when I open the review copy inside Claude they use the artifact's `sample` capability. Both paths are already implemented in the template — keep that code byte-for-byte.

**The entrance gate.** On the public site the page opens with a password screen (the proxy password; SHA-256 checked in the page, remembered per device). Inside Claude there is no gate. Also implemented in the template.

**Gamification.** Each kid has a streak (consecutive completed days), XP, a level (7 named levels, gendered where the language needs it), badges (first day, no mistakes, teacher = 3 stars on the explanation, sharp guess, streak 3/7/14/30/100). XP for a day = score×10 + 20 for completing the test + min(50, streak×5). The page shows today's XP, total, level progress, a 7-day streak row and today's badges; the agent keeps the truth in the ledger and embeds each kid's stats into the next day's page.

**The daily secret password.** Completing the whole test unlocks a fun 2–3-word phrase from the day's story on the results screen — the kid tells it to the parents (we use it for screen time). It is scrambled in the page (base64 of the reversed string). It is in my review email, never in the kids' email.

**Completion signal.** The results screen has a one-tap "send to Dad/Mom" mail button (mailto to my address with score, badges and a machine line `WOW-NNN|younger|score|max|done`) plus a copy button. I can also reply `✓ [Name]` on the day's thread. The nightly builder reads both.

**Hard rules for every edition:** (1) native-speaker quality in our language; correct gender/number per kid; short sentences for the younger kid; no emoji in running text. (2) **If our language is right-to-left, every mathematical expression reads LEFT-TO-RIGHT** — wrap each computation in an isolated LTR span (`<span class="math">360 ÷ 7.2 = 50</span>`), including dynamic readouts, signed numbers, feedback strings and chat output. (3) 20–30 minutes total: ≈1,100 words per track, 3–4 interactives, test 8–10 minutes — the first edition ever built was 60 minutes; cut ruthlessly. (4) Interactives understandable without reading: huge clear pictures, labels ≥18 px in a 640 px canvas, nothing clipped, physically correct. (5) Verify every fact against 2–4 reliable sources; be honest where experts disagree; list sources in the adults' footer. (6) No hidden-answer leaks; lock the track after start; keep the daily password locked until the test is complete. (7) Light and dark theme both readable; a per-topic accent palette inside the series frame.

## 2. Quality gate: the reviewer agent

Before publishing ANY edition, spawn a separate **reviewer agent** that plays each kid and then a demanding parent-teacher: it wraps the page in a test skeleton, clicks through every exercise on both tracks in a real headless browser (Playwright/Chromium) at desktop and phone widths, screenshots every interactive and judges whether an 8-year-old understands the picture, checks that every formula renders correctly, checks grammar/gender, fact-checks against the web, estimates time-on-task, and reports PASS/FAIL with blockers / important / nice-to-have, quoting exact strings. Fix everything, re-run your own browser check (the kit's `template/check.js` is the model), and send the reviewer another round until PASS (max 3 rounds). If blockers remain, do not publish; email me what failed.

## 3. Infrastructure (once)

- **Public site:** GitHub Pages from `[username]/daily-wow`. Root `index.html` = today's edition (the kids' bookmark); every edition lives forever at `e/NNN/index.html` and the kids' email links to that permanent URL; `e/index.html` is the **library page** (the kit's `template/library.html`, copied once — it lists every edition from `editions.json`, so kids can find and finish old lessons; a late completion earns XP but not streak); `editions.json` at the root lists released editions `{n, date, title, path}`; `.nojekyll` present. Only the release routine pushes.
- **Review copies:** each edition is also published as a dated Claude artifact with the `sample` capability — my private review copy and the template for the next day.
- **Parents' dashboard:** a private artifact declaring the `db` capability; it renders the ledger live (streaks, XP, badges, passwords, completions, editions) and its database IS the ledger. Do not declare `db` on kids' pages.
- **Ledger schema:** `meta/config` {parent_email, kids_emails[], kids_url, pages_base, github_repo, next_n, xp_rule, levels, proxy_url, gate_pw_hash}; `kids/younger`, `kids/older` {name, streak, best, xp, level, badges[], last_done_date, history[]}; `editions/eNNN` {n, code "WOW-NNN", date, title, topics[], summary, url, pages_url, password, max_score, reviewed, sent, sent_at, done:{younger, older}}; `menus/eNNN` {n, for_date, options[5], default_k, chosen}.
- **Three schedules:** the topic menu and the nightly builder are **Cowork scheduled tasks** — use the kit's `prompts/topic-menu.md` and `prompts/nightly-builder.md` with every placeholder filled from section 0 and the dashboard URL you create; cron in UTC. The release is a **Claude Code routine** with the repo attached — you cannot create it; hand me `prompts/release-routine.md` filled in, with the exact steps (claude.ai/code/routines → New routine → name, repository `[username]/daily-wow`, schedule daily at `[release time]`, Gmail connector only, paste the prompt).

## 4. What to do right now, in this session

1. Ask me only what is genuinely missing from section 0, then proceed without waiting for anything else.
2. Fetch the kit files. Build **edition #1** from `template/edition-template.html`: it is a complete, tested Hebrew edition (Eratosthenes measuring the Earth with a stick). Keep its frame and engine; set the `KIDS` block (names, gender, age, grade), `EDITION.parent`, `PROXY` (my proxy URL with `/api`, and the SHA-256 hex of the password), the series and assistant names; translate/adapt every string if our language is not Hebrew (remove `dir="rtl"`/RTL styles and change the `he-IL` locale settings for an LTR language); adapt the local hooks in the demo content (Israeli places, noon time, latitude) to where we live; adapt the "Dad" strings (`לאבא`) to whoever the kids report to; write the first topic yourself if you prefer another story, honoring every rule above. Run your own browser check, then the reviewer loop until PASS.
3. Publish the dated artifact (capability `sample`) and the parents' dashboard (capability `db`); seed the ledger (both kids at streak 0 / 0 XP / level 1, `editions/e001`, `meta/config` with my settings incl. `proxy_url` (production URL + `/api`) and `gate_pw_hash`, `next_n = 2`).
4. Create the two Cowork scheduled tasks. Make sure the first nightly run does not build a second edition for the same day (the guard in the builder), and fire today's topic menu manually if its time has already passed.
5. Send me the review email for edition #1 in the exact format the builder will use, and leave the kids' draft ready (marker `WOW-DRAFT-1`).
6. Give me the filled-in release routine prompt and the click-by-click instructions to create it; tell me to run it once with the text `REPUBLISH 1 NOTIFY-KIDS` if I want edition #1 live before tomorrow (that publishes it and sends the kids' draft).
7. Finish with a short summary: the links (public site, dashboard, review copy), today's password, the daily rhythm (menu → build → review → release), how I reply (number / HOLD / changes / ✓ Name), and what I must still do myself.

Work autonomously, state your assumptions, and remember the bar: **extraordinarily engaging, fun and mind-blowing — in the content, not just the format.**

=== PROMPT END ===

---

## After setup — one-time checklist for the parent

- Create the **release routine** exactly as Claude instructs (claude.ai/code/routines, repository attached, Gmail only, daily at your release time). Run it once with `REPUBLISH 1 NOTIFY-KIDS` if you want edition #1 live today.
- Give the kids the **entrance password** (the proxy `PASSWORD`). The daily secret password is a different thing — it's in your review email each day.
- Reply to the morning **topic menu** with a number (or your own idea); silence = the ★ default.
- Reply **HOLD** or describe changes on the **review email** before the release hour; silence = it goes out.
- When a kid tells you the daily password, reply **✓ Name** on that day's thread (or let them tap "send to Dad/Mom" on the results screen) — that is what feeds streaks and XP.
- Scheduled tasks run on UTC cron; when your clocks change for daylight saving, ask Claude to shift the two tasks by an hour (the routine uses your local time).
