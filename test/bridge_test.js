// Simulates the Android bridge: saving through AnchorAndroid.saveFile and opening a .anchor handed over by the system.
const { chromium, devices } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(devices['Pixel 7']); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.ANCHOR_NO_AUTO_ONLINE = true; window.__saves = []; window.__ready = 0;
    window.AnchorAndroid = { saveFile(n, m, b64, id) { window.__saves.push({ n, m, len: b64.length }); setTimeout(() => window.__anchorSaved[id](true), 10); }, ready() { window.__ready++; }, copy() {}, openUrl(u) { window.__opened = u; } }; });
  await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(600);
  const b64 = fs.readFileSync('/tmp/claude-0/mobile.anchor').toString('base64');
  await p.evaluate(x => window.anchorOpenFromAndroid('mobile.anchor', x), b64); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ ready: window.__ready, a: S.st.phases.A.status, n: S.st.biblio.M && S.st.biblio.M.n, name: S.st.setup.S_name }));
  await p.evaluate(() => saveProject()); await p.waitForTimeout(1500);
  await p.evaluate(() => U.open('https://doi.org/10.1/x'));
  console.log(JSON.stringify(st), JSON.stringify(await p.evaluate(() => [window.__saves, window.__opened])), errs.join(';') || 'no errors'); await b.close(); })();
