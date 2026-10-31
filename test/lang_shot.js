const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const L = process.argv[2];
  const ctx = await b.newContext(Object.assign({}, devices['Pixel 7'], { colorScheme: process.env.DARK ? 'dark' : 'light' })); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(l => { window.ANCHOR_NO_AUTO_ONLINE = true; localStorage.setItem('anchor.settings', JSON.stringify({ lang: l, theme: 'system' })); }, L);
  for (const h of (process.argv[3] || '#/,#/phase/A,#/biblio,#/start').split(',')) { await p.goto('http://localhost:8765/index.html' + h); await p.waitForTimeout(600); await p.screenshot({ path: `/tmp/claude-0/L_${L}${process.env.DARK ? 'd' : ''}_${h.replace(/\W/g, '')}.png` }); }
  console.log(errs.join('\n') || 'ok'); await b.close(); })();
