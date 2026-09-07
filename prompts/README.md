# Prompts

The Daily Wow is run by an AI agent (Claude) on three schedules. Each schedule has one prompt here.
They are the exact prompts running in production, with the family-specific values replaced by placeholders.

| File | Runs | Where | What it does |
|---|---|---|---|
| [`setup-prompt.md`](setup-prompt.md) | once | a Claude **Cowork** session | The all-in-one bootstrap: builds edition #1 from the kit template, creates the dashboard + ledger, creates the two scheduled tasks, tells you how to create the release routine. Paste this first. |
| [`topic-menu.md`](topic-menu.md) | daily, morning | Cowork scheduled task | Emails the parent five topic candidates for tomorrow; stores them in the ledger. |
| [`nightly-builder.md`](nightly-builder.md) | daily, night | Cowork scheduled task | Settles yesterday (streaks/XP), picks the topic (your reply or the ★ default), builds the new edition from the previous one, runs the browser check and the reviewer agent, publishes the review copy, emails the review. |
| [`release-routine.md`](release-routine.md) | daily, late morning | Claude Code **routine** with the GitHub repo attached | Unless you replied HOLD, pushes the edition to GitHub Pages and sends the kids' email. |

Why two different schedulers: Cowork tasks have the Artifact tool (the ledger database lives in an artifact) but cannot reach GitHub; Claude Code routines can have a GitHub repository attached but cannot answer the consent dialog that writing the ledger requires. So the routine only pushes and emails, and the builder reads the public `editions.json` to learn what was released.

## Placeholders

| Placeholder | Example |
|---|---|
| `{{SERIES_NAME}}` | `הוואו היומי`, `Le Waouh du jour`, `The Daily Wow` — the brand the kids see |
| `{{ASSISTANT_NAME}}` | the in-page assistant's character name, e.g. `ארטו` (a librarian from Alexandria) |
| `{{LANGUAGE}}` / `{{SPEECH_LOCALE}}` | `Hebrew` / `he-IL`, `French` / `fr-FR`, `English` / `en-GB` |
| `{{PARENT_LANGUAGE}}` | language of the emails to you |
| `{{PARENT_NAME}}` / `{{PARENT_EMAIL}}` | you |
| `{{KID_YOUNGER}}`, `{{AGE_YOUNGER}}`, `{{GRADE_YOUNGER}}` | the younger track — name, `8–9`, `3–4` |
| `{{KID_OLDER}}`, `{{AGE_OLDER}}`, `{{GRADE_OLDER}}` | the older track |
| `{{MORE_KIDS}}` | empty, or e.g. `, and their cousins Dani (11, boy) and Lia (10, girl) — Sam's kids — who also use the OLDER track; Dani is on the ADVANCED level` |
| `{{CHALLENGE_WORD}}` | the word "Challenge" in the kids' language (heading of the chapter-5 challenge panel) |
| *(more kids)* | add them to `KIDS` in the template and to `config.kid_ids` / `kids/<id>` in the ledger; the prompts loop over `config.kid_ids`. A cousin's parent goes in `config.reports` (daily report) and as the kid's `cc`. A kid to push: `level:'advanced'`. |
| `{{TIMEZONE}}` | `Europe/Paris` |
| `{{HOME_COUNTRY}}` / `{{HOME_TOWN}}` | for local hooks (latitude, geology, history) |
| `{{GITHUB_USER}}` | your GitHub username; the site repo is `{{GITHUB_USER}}/daily-wow` |
| `{{PAGES_URL}}` | `https://{{GITHUB_USER}}.github.io/daily-wow` (no trailing slash) |
| `{{DASHBOARD_URL}}` | the parents' dashboard artifact URL (created by the setup prompt) |
| `{{MENU_TIME}}` / `{{BUILD_TIME}}` / `{{RELEASE_TIME}}` | `07:30` / `02:00` / `11:00` local |
| `{{HTML_LANG}}` / `{{HTML_DIR}}` | `he` / `rtl`, `fr` / `ltr` — used when the release routine wraps the page fragment |

The kids' entrance password and the proxy URL are not placeholders in the prompts: they live in the ledger (`meta/config.proxy_url`, `meta/config.gate_pw_hash`) and the builder copies them into each edition.
