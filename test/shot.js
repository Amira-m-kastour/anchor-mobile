const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(Object.assign({}, devices['Pixel 7'], { locale: process.env.L || 'en-GB', colorScheme: process.env.DARK ? 'dark' : 'light' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGE: ' + e.message));
  await p.addInitScript(() => { window.ANCHOR_NO_AUTO_ONLINE = true; });
  const hashes = (process.argv[2] || '#/').split(',');
  for (const hsh of hashes) { await p.goto('http://localhost:8765/index.html' + hsh); await p.waitForTimeout(700);
    await p.screenshot({ path: '/tmp/claude-0/shot_' + hsh.replace(/[^a-z0-9]/gi, '_') + '.png', fullPage: !!process.env.FULL }); }
  console.log(errs.join('\n') || 'no console errors'); await b.close();
})();
