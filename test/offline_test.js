const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(devices['Pixel 7']); const p = await ctx.newPage();
  await p.addInitScript(() => { window.ANCHOR_NO_AUTO_ONLINE = true; });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  await p.reload(); await p.waitForTimeout(1500);
  const ctl = await p.evaluate(() => !!navigator.serviceWorker.controller); await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(800); const ok = await p.evaluate(() => document.querySelector('.hero') !== null && !!window.BX && !!window.pdfjsLib);
  await p.evaluate(() => { location.hash = '#/phase/A'; }); await p.waitForTimeout(300); const ph = await p.textContent('main');
  console.log('controlled', ctl, 'offline render', ok, 'phase page', ph.includes('Anchor the article')); await b.close(); })();
