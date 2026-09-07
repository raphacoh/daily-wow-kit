const { chromium } = require('playwright');
const fs = require('fs');
const dir = __dirname; fs.mkdirSync(dir + '/shots', { recursive: true });
const frag = fs.readFileSync(dir + '/edition-template.html', 'utf8');
fs.writeFileSync(dir + '/_test.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>${frag}</body></html>`);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [track, vw] of [['older', 1100], ['younger', 390]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
    page.on('pageerror', e => errors.push(track + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_/.test(m.text())) errors.push(track + ' console: ' + m.text()); });
    await page.goto('file://' + dir + '/_test.html'); await page.waitForTimeout(500);
    if (await page.isVisible('#gate')) { console.log(track, 'gate shown → unlocking'); await page.fill('#gateIn', process.env.GATE_PW || ''); await page.press('#gateIn', 'Enter'); await page.waitForTimeout(400); console.log(track, 'gate still visible:', await page.isVisible('#gate')); }
    await page.click(`.track[data-pick=${track}]`); await page.click('#startBtn'); await page.waitForTimeout(300);
    await page.click('#roundBtn'); await page.click('text=שלחו את הספינה'); await page.waitForTimeout(2200);
    await (await page.$('#shipCv')).screenshot({ path: dir + `/shots/${track}-ship.png` });
    await page.click('.step[data-step="1"] .next .btn'); await page.waitForTimeout(300);
    await (await page.$('#stickCv')).screenshot({ path: dir + `/shots/${track}-sticks0.png` });
    await page.fill('#curve', '85'); await page.$eval('#curve', e => e.dispatchEvent(new Event('input'))); await page.waitForTimeout(200);
    await (await page.$('#stickCv')).screenshot({ path: dir + `/shots/${track}-sticks85.png` });
    await page.click('#qc2 .opt[data-i="0"]'); // wrong on purpose
    await page.click('#next2'); await page.waitForTimeout(300);
    await page.click('text=קבעו 7.2°');
    if (track === 'older') {
      await page.fill('#olderDiv', '40'); await page.click('#olderDivBtn');
      await page.fill('#olderDiv', '50'); await page.click('#olderDivBtn'); await page.waitForTimeout(200);
      await page.fill('#olderMul', '40000'); await page.click('#olderStep2 .btn');
    } else { for (let i = 0; i < 5; i++) await page.click('#addSlices'); }
    await page.waitForTimeout(200);
    await (await page.$('.step[data-step="3"]')).screenshot({ path: dir + `/shots/${track}-pizza.png` });
    await page.click('.step[data-step="3"] .next .btn'); await page.waitForTimeout(200);
    await page.click('.step[data-step="4"] .next .btn'); await page.waitForTimeout(300);
    if (track === 'older') {
      for (const v of ['1', '10', '60']) { await page.fill('#sunDist', v); await page.$eval('#sunDist', e => e.dispatchEvent(new Event('input'))); await page.waitForTimeout(100); await (await page.$('#rayCv')).screenshot({ path: dir + `/shots/rays-${v}.png` }); console.log('rayErr@' + v, await page.$eval('#rayErr', e => e.textContent)); }
    } else {
      await (await page.$('.step[data-step="5"] [data-track=younger] .panel.instrument')).screenshot({ path: dir + `/shots/younger-stickcalc.png` });
    }
    await page.click('.step[data-step="5"] .next .btn'); await page.waitForTimeout(300);
    await page.click('#sieveBox summary'); await page.waitForTimeout(100);
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]) await page.click(`#sieve button[data-n="${p}"]`);
    console.log('sieve:', await page.$eval('#sieveMsg', e => e.textContent.slice(0, 80)));
    await (await page.$('.step[data-step="6"]')).screenshot({ path: dir + `/shots/${track}-conn.png` });
    await page.click('text=למבחן!'); await page.waitForTimeout(300);
    const answers = [1, 1, 1, track === 'older' ? 1 : 2];
    for (let i = 0; i < 4; i++) await page.click(`#mcqs .q:nth-child(${i + 1}) .opt[data-i="${answers[i]}"]`);
    for (const id of ['a', 'b', 'c', 'd', 'e']) await page.click(`#order .card[data-id="${id}"]`);
    await page.click('#orderCheck');
    if (track === 'older') { await page.fill('#numOlder', '40000'); await page.click('.q[data-track=older] .btn'); } else { await page.fill('#numYounger', '10'); await page.click('.q[data-track=younger] .btn'); }
    // finish without explanation → vault locked
    await page.click('#finishBtn'); await page.waitForTimeout(600);
    console.log(track, 'locked vault:', await page.$eval('#vaultTitle', e => e.textContent));
    await page.click('#vaultBody .btn'); await page.waitForTimeout(300);
    await page.fill('#explain', 'ארטוסתנס ראה שבסיינה אין צל ובאלכסנדריה יש צל בזווית 7.2 מעלות. זה בגלל שכדור הארץ עגול. הוא חילק 360 ב-7.2 וקיבל 50, ואז הכפיל ב-800 קילומטר וקיבל 40,000.');
    await page.click('#explainBtn'); await page.waitForTimeout(process.env.PROXY_WAIT ? +process.env.PROXY_WAIT : 1500);
    for (const b of await page.$$('#explainFb input[type=checkbox]')) await b.check();
    await page.click('#finishBtn'); await page.waitForTimeout(1500);
    await (await page.$('.step[data-step="8"]')).screenshot({ path: dir + `/shots/${track}-results.png` });
    console.log(track, JSON.stringify(await page.evaluate(() => ({ pw: document.querySelector('.vault .pw')?.textContent, xp: document.getElementById('xpToday').textContent, det: document.getElementById('xpDetail').textContent, res: document.getElementById('resLine').textContent, title: document.getElementById('resTitle').textContent, who: document.getElementById('who').textContent, scrollW: document.documentElement.scrollWidth, vw: innerWidth }))));
    await page.click('#fab'); await page.waitForTimeout(300);
    await (await page.$('#chat')).screenshot({ path: dir + `/shots/${track}-chat.png` });
    await page.close();
  }
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
