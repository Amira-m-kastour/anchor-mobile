// The Proposal / thesis tab on an emulated phone: outline from a desktop project, typing, checks, exports, template, project round trip.
const { chromium, devices } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = '/tmp/claude-0/ptest'; const SRC = process.argv[2]; const TPL = process.argv[3];
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(Object.assign({}, devices['Pixel 7'], { acceptDownloads: true }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript({ path: path.join(__dirname, 'mock.js') });
  await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(800);
  await p.evaluate(async arr => { const st = await P.open(new Uint8Array(arr), 'desk.anchor'); S.replace(st); }, Array.from(fs.readFileSync(SRC)));
  await p.evaluate(() => { location.hash = '#/proposal'; }); await p.waitForTimeout(500);
  ok((await p.textContent('main')).includes('Start a research proposal'), 'start card shown');
  await p.getByText('Create the outline', { exact: true }).click(); await p.waitForTimeout(500);
  let pr = await p.evaluate(() => JSON.parse(JSON.stringify(S.st.proposal, (k, v) => v instanceof Uint8Array ? '[bytes]' : v)));
  ok(pr && pr.sections.length === 9 && pr.sections[0].links.join('') === 'AH' && pr.sections[0].link_text.A.length > 10, 'outline with linked approved text (' + (pr && pr.sections.length) + ' sections)');
  ok(await p.locator('.badge.ai').count() > 0, 'AI-drafted phase text is marked');
  const ta = p.locator('.prop-sec textarea').first(); await ta.fill('My own motivation, as argued by Lim et al. (2021).'); await ta.dispatchEvent('change'); await p.waitForTimeout(300);
  const chk = await p.textContent('main'); ok(/No reference found for: Lim et al\. \(2021\)/.test(chk), 'checks flag the citation without a reference');
  ok(await p.evaluate(() => S.st.draft_versions.some(v => /^P:/.test(v.phase) && v.source === 'your edits')), 'your text kept as a version');
  await p.evaluate(() => { const pr = S.st.proposal; pr.milestones = [{ milestone: 'Literature review', start: '2026-11-01', end: '2026-11-30' }, { milestone: 'Expose to supervisor', start: '2027-01-15', end: '2027-01-15' }]; pr.title = 'Rating disagreement and returns'; });
  // a figure, then the exports
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 250; const g = c.getContext('2d'); g.fillStyle = '#B4561A'; g.fillRect(20, 20, 200, 120);
    const raw = await new Promise(r => c.toBlob(bl => bl.arrayBuffer().then(a => r(new Uint8Array(a))), 'image/png'));
    const pr = S.st.proposal; pr.attachments.push({ id: 'attX', name: 'framework.png', role: 'figure', caption: 'Conceptual framework', raw: raw, path: '', size: raw.length, added: U.now() }); pr.sections[1].figs = ['attX']; S.st.proposal_changed = true; });
  const docx = await p.evaluate(async () => Array.from(await PR.docx(S.st))); fs.writeFileSync(OUT + '/m.docx', Buffer.from(docx));
  const html = await p.evaluate(() => PR.html(S.st)); fs.writeFileSync(OUT + '/m.html', html);
  const tex = await p.evaluate(async () => Array.from(await PR.latexZip(S.st))); fs.writeFileSync(OUT + '/m.zip', Buffer.from(tex));
  ok(docx.length > 5000 && /Rating disagreement and returns/.test(html) && /AI statement/.test(html) && /Figure 1: Conceptual framework/.test(html) && /Figure 2: Timeline/.test(html), 'Word, HTML and LaTeX exported, with timeline chart, figure and AI statement');
  ok(/phase H\): drafted with AI/.test(html), 'AI statement names the AI-drafted phase');
  // German document, then a Word template
  await p.evaluate(() => { S.st.proposal.lang = 'de'; }); const hde = await p.evaluate(() => PR.html(S.st)); ok(/Erkl/.test(hde) && /lang="de"/.test(hde), 'document language German');
  await p.evaluate(() => { S.st.proposal.lang = 'en'; });
  if (TPL) { const tpl = await p.evaluate(async arr => { S.st.proposal.template = { name: 'chair.docx', raw: new Uint8Array(arr) }; return Array.from(await PR.docx(S.st)); }, Array.from(fs.readFileSync(TPL)));
    fs.writeFileSync(OUT + '/m_tpl.docx', Buffer.from(tpl)); ok(tpl.length > 5000, 'Word on an uploaded template'); }
  // save the project for the desktop
  const bytes = await p.evaluate(async () => Array.from(await P.build(S.st))); fs.writeFileSync(OUT + '/m.anchor', Buffer.from(bytes));
  const back = await p.evaluate(async arr => { const st = await P.open(new Uint8Array(arr), 'x'); return { n: st.proposal.sections.length, att: st.proposal.attachments[0].raw.length, tpl: !!st.proposal.template, ms: st.proposal.milestones.length }; }, bytes);
  ok(back.n === 9 && back.att > 100 && back.tpl === !!TPL && back.ms === 2, 'project round trip keeps the proposal ' + JSON.stringify(back));
  // the screen in Arabic
  await p.evaluate(() => { I18N.set('ar'); rerender(); }); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/ar.png', fullPage: false });
  await p.evaluate(() => { I18N.set('en'); rerender(); });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(`PASS ${pass}  FAIL ${fail}`); await b.close();
})();
