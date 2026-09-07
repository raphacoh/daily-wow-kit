# Template

`edition-template.html` is a complete, tested edition (Hebrew, RTL) that doubles as the series engine.
It is a page *fragment* — `<title>`, `<link>` (Google Fonts), `<style>`, markup and one `<script>` — because
the release job wraps it into a full `<html lang dir>` document. To open it locally, wrap it the same way
(the check script does this for you and writes `_test.html`).

Constants at the top of the script are everything an edition needs:

```js
const EDITION = { n, code:'WOW-001', date, title, parent:'parent@example.com' };
const KIDS    = { younger:{ name, f:false, age:'8–9', grade:'ג–ד' }, older:{ name, f:true, age:'10–11', grade:'ה–ו' } };
const STATS   = { younger:{ streak, best, xp, badges }, older:{ … } };   // as of yesterday, from the ledger
const PW_ENC  = '…';       // base64 of the reversed UTF-8 daily password
const PROXY   = { url:'https://<project>.vercel.app/api', pwHash:'<sha256 hex of the entrance password>' };
```

Empty `PROXY` = no entrance gate and no assistant on the public site (the page still works, with a self-check rubric).

## Check it

```
npm i -D playwright && npx playwright install chromium
node check.js          # walks the older track at 1100px and the younger at 390px, screenshots every interactive into shots/
GATE_PW=… node check.js   # when PROXY.pwHash is set, unlock the gate with the password
```

It prints each track's final score/XP/password and `ERRORS: none` on success (Google Fonts connection
errors are ignored). Use it as the model for the nightly builder's own check.

## Rules the engine enforces (keep them)

- Track ids are `younger` / `older`; names, gender and age come only from `KIDS`.
- Locale knobs when leaving Hebrew: `dir="rtl" lang="he"` on `#app`, `#chat` and `#gate`; `toLocaleString('he-IL')` in `fmt`; `lang='he-IL'` on both speech recognizers; the "send to Dad" strings (`לאבא`) on the results screen and in `copyResults`; and of course every Hebrew string.
- Every formula in an RTL page is inside `<span class="math">` (LTR isolate); bare/signed numbers in `.num`.
- The vault opens only when all four test parts are done; the completion mail carries `WOW-NNN|track|score|max|done`.
- The proxy client (`PX`) and the backend switch (`AI`) time out and fall back — never leave a kid staring at a spinner.
