const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(Object.assign({}, devices['Pixel 7'], { colorScheme: process.env.DARK ? 'dark' : 'light' })); const p = await ctx.newPage();
  await p.addInitScript(() => { window.ANCHOR_NO_AUTO_ONLINE = true; }); await p.goto('http://localhost:8765/index.html#/about'); await p.waitForTimeout(500);
  const ids = (process.argv[2] || 'annual_prod,historiograph,treemap,thematic_map,rpys').split(',');
  await p.evaluate(async ids => { const recs = await (await fetch('data/sample_management.json')).json(); const M = BX.fromRecords(recs); const R = BX.analysis(M);
    const main = document.getElementById('main'); main.innerHTML = ''; for (const id of ids) { const r = BX.run(id, M, R, {}); const el = CH.render(r.chart); el.id = 'c_' + id; main.appendChild(el); } }, ids);
  for (const id of ids) await p.locator('#c_' + id).screenshot({ path: '/tmp/claude-0/c_' + id + '.png' });
  await b.close(); })();
