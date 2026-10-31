// End-to-end test of ANCHOR Mobile on an emulated phone with mocked live services.
const { chromium, devices } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = '/tmp/claude-0/e2e'; fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(Object.assign({}, devices['Pixel 7'], { acceptDownloads: true, locale: 'en-GB' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGE: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript({ path: path.join(__dirname, 'mock.js') });
  await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(500);
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
  const click = async (txt, opts) => { await p.getByText(txt, Object.assign({ exact: true }, opts || {})).first().click(); await p.waitForTimeout(200); };
  const dl = async (fn, name) => { const [d] = await Promise.all([p.waitForEvent('download'), fn()]); const f = path.join(OUT, name || d.suggestedFilename()); await d.saveAs(f); return f; };
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(S.st, (k, v) => (v instanceof Uint8Array ? '[bytes ' + v.length + ']' : k === 'R' ? undefined : v))));

  console.log('Before you start');
  await go('#/prereq');
  await p.locator('input[type=text]').first().fill('Amira Mamdouh Kastour');
  await p.getByPlaceholder('0000-0000-0000-0000').fill('0000-0002-1825-0097');
  await click('Check'); await p.waitForTimeout(300);
  ok((await p.textContent('main')).includes('Valid ORCID iD'), 'ORCID validated and looked up');
  await p.locator('select').nth(1).selectOption('DE');
  await p.getByPlaceholder('Search institutions by name').fill('Hagen'); await p.waitForTimeout(1200);
  await click('FernUniversität in Hagen'); await p.waitForTimeout(300);
  let s = await st(); ok(s.prereq.institution === 'FernUniversität in Hagen' && s.prereq.dbs.includes('wos'), 'institution chosen from ROR; library databases pre-ticked (' + s.prereq.dbs.length + ')');
  await click('Save and continue to Start');

  console.log('Start');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), click('Choose the article (PDF, Word or text)')]); await fc.setFiles(path.join(__dirname, 'fixtures/article.pdf'));
  await p.waitForTimeout(2500);
  s = await st();
  ok(s.article.text && s.article.text.length > 1000, 'PDF text read (' + (s.article.text || '').length + ' chars, ' + s.article.pages + ' page(s))');
  ok(s.article.doi === '10.1234/jtf.2021.001', 'DOI detected: ' + s.article.doi);
  ok(/disagreement/i.test(s.article.abstract || ''), 'abstract found');
  ok((s.article.references || []).length === 3, 'references found: ' + (s.article.references || []).length);
  ok(/^Doe, J\., & Roe, J\. P\. \(2021\)/.test(s.article.citation || ''), 'APA reference filled from Crossref: ' + s.article.citation);
  await p.locator('select').filter({ hasText: 'APA 7th edition' }).selectOption('ieee'); await p.waitForTimeout(800);
  s = await st(); ok(/\[ieee\]/.test(s.article.citation), 'style change re-fetched the reference from doi.org (IEEE)');
  await p.locator('textarea').first().fill('My own edited reference.'); await p.waitForTimeout(100);
  await p.locator('select').filter({ hasText: 'IEEE' }).selectOption('chicago-author-date'); await p.waitForTimeout(800);
  s = await st(); ok(s.article.citation === 'My own edited reference.' && /chicago/.test(s.article.cite_pending || ''), 'own edit kept; DOI version offered instead');
  await click('Use this instead'); s = await st(); ok(/chicago/.test(s.article.citation), '"Use this instead" applied the DOI reference');
  await p.locator('select').filter({ hasText: 'Chicago author-date' }).selectOption('nature'); await p.waitForTimeout(800);
  s = await st(); ok(s.article.cite_style === 'apa' && /^Doe/.test(s.article.citation), 'nature unavailable -> APA fallback');
  await click('Published version of record');
  await click('Confirm set-up and open phase A'); await p.waitForTimeout(300);
  ok((await p.textContent('.sheet')).includes('Before we start'), 'gate blocks set-up with missing answers');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await click('Thesis or seminar paper'); await click('Yes');
  await click('Confirm set-up and open phase A'); await p.waitForTimeout(400);
  s = await st(); ok(s.setup_ok && s.phases.A.status === 'open' && p.url().endsWith('#/phase/A'), 'set-up confirmed; phase A open; name from Before you start: ' + s.setup.S_name);

  console.log('Phase A (copy-and-paste mode)');
  await click('Show prompt', { exact: true }); await p.waitForTimeout(300);
  const prompt = await p.locator('.sheet textarea').inputValue(); ok(prompt.includes('=== ARTICLE TEXT') && prompt.includes('QUESTIONS FOR THE RESEARCHER'), 'prompt built with article text and question tail');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const draft = await p.evaluate(() => window.ANCHOR_MOCK_AI('x'));
  await p.locator('textarea.draft').fill(draft); await p.waitForTimeout(200);
  s = await st(); ok(s.prompts.length === 1 && s.prompts[0].mode === 'prompt', 'pasting an answer logged the prompt once');
  ok(s.phases.A.ai_q.length === 2, 'model questions extracted: ' + s.phases.A.ai_q.join(' | '));
  await click('Approve and open the next phase'); await p.waitForTimeout(300);
  ok((await p.textContent('.sheet')).includes('Gate A is not ready'), 'gate lists what is missing'); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await click('Yes, version of record'); await p.locator('.q input[type=text]').first().fill('Hypotheses and data.'); await click('Yes, all key numbers');
  const aiq = p.locator('textarea').filter({ hasText: '' }); 
  await p.evaluate(() => { const ph = S.st.phases.A; ph.ai_a = ['LSEG and MSCI', 'No']; S.changed('phases'); }); await p.evaluate(() => rerender());
  for (const c of ['Article-at-a-glance table and section summary are complete', 'Every figure was checked against the uploaded file', 'GATE: version of the article stated; no number taken from a press summary']) await click(c);
  await click('Approve and open the next phase'); await click('Yes, approve'); await p.waitForTimeout(400);
  s = await st(); ok(s.phases.A.status === 'approved' && s.phases.N.status === 'open' && p.url().endsWith('#/phase/N'), 'phase A approved; N open');

  console.log('Phase N with API mode');
  await p.evaluate(() => { S.setDev({ mode: 'api', api_key: 'sk-ant-test' }); }); await go('#/phase/N');
  await click('Draft this phase'); await p.waitForTimeout(600);
  s = await st(); ok(/Article at a glance/.test(s.phases.N.draft) && s.prompts.length === 2 && s.prompts[1].mode === 'api', 'API draft filled and logged');
  ok(s.settings.mode === 'api', 'state mode follows device setting');

  console.log('Bibliometrics');
  await go('#/biblio'); await click("Sample dataset (bibliometrix 'management')"); await click('Import'); await p.waitForTimeout(2500);
  s = await st(); ok(s.biblio.M && s.biblio.M.n === 898, 'sample dataset imported: ' + (s.biblio.M && s.biblio.M.n));
  const ids = await p.evaluate(() => Object.keys(BX.ANALYSES)); const bad = [];
  for (const id of ids) { await go('#/biblio/a/' + id); await click('Run'); await p.waitForSelector('.busy', { state: 'detached', timeout: 120000 }); await p.waitForTimeout(150);
    const txt = await p.textContent('main'); const svg = await p.locator('main .chart svg, main table.tbl').count(); if (!svg) bad.push(id + ': ' + txt.slice(0, 200).replace(/\s+/g, ' '));
    if (['annual_prod', 'cooc_net', 'country_prod', 'thematic_map', 'three_field', 'trend_topics', 'word_cloud', 'treemap', 'historiograph', 'country_collab_map', 'coupling_map', 'bradford', 'author_time', 'rpys', 'corr_country'].includes(id)) await p.screenshot({ path: `${OUT}/an_${id}.png`, fullPage: false });
    if (['annual_prod', 'cooc_net', 'thematic_map'].includes(id)) { await click('Add to report'); await p.waitForTimeout(800); } }
  ok(!bad.length, 'every analysis drew a figure (' + ids.length + ')' + (bad.length ? ': ' + bad.join(' || ') : ''));
  s = await st(); ok(s.report_items.length === 3 && s.report_items.every(i => /bytes/.test(String(i.png))), '3 figures added with PNGs');
  await go('#/biblio'); await click('Check records for retractions (online)'); await p.waitForTimeout(1200);
  ok((await p.textContent('main')).includes('retracted record'), 'retraction check flags the mocked retracted record');

  console.log('OpenAlex corpus');
  await click('OpenAlex (fetch live, free)'); await click('Fetch'); await p.waitForTimeout(1500);
  s = await st(); ok(s.biblio.source === 'openalex' && s.biblio.M.n === 25, 'OpenAlex corpus fetched: ' + s.biblio.M.n);
  await go('#/biblio/a/collab_net'); await click('Run'); await p.waitForSelector('.busy', { state: 'detached', timeout: 60000 }); ok(await p.locator('main .chart svg').count() === 1, 'network from OpenAlex records');
  await go('#/biblio/a/rpys'); await click('Run'); await p.waitForTimeout(500); ok((await p.textContent('main')).includes('OpenAlex gives only as work ids'), 'RPYS refuses OpenAlex records with explanation');

  console.log('Find a focal article');
  await go('#/find'); await p.getByPlaceholder('Subject in plain words, e.g. ESG rating disagreement stock returns').fill('esg disagreement'); await click('Search'); await p.waitForTimeout(800);
  ok((await p.textContent('main')).includes('1,234 matches'), 'search results shown');
  for (let k = 0; k < 3; k++) { await p.getByText('Add to the shortlist', { exact: true }).first().click(); await p.waitForTimeout(250); }
  s = await st(); ok(s.finder.shortlist.length === 3, 'three candidates shortlisted');
  await p.getByText('Download open copy', { exact: true }).first().click(); await p.waitForTimeout(800);
  ok(await p.evaluate(async () => !!(await S.idbGet('cand:' + S.st.finder.shortlist[0].id))), 'open copy stored on the device (not in the project)');
  await p.getByText('Clear research question', { exact: true }).first().click(); await p.waitForTimeout(200);
  ok((await p.textContent('main')).includes('1/4'), 'ticks counted in comparison');

  console.log('Phase H trend and lessons');
  await go('#/phase/H'); await click('Show trend'); await p.waitForTimeout(600); ok(await p.locator('main .chart svg').count() >= 1, 'trend chart');
  await p.evaluate(async () => { const r = await O.refresh(); }); await go('#/phase/C'); await p.waitForTimeout(300);
  ok((await p.textContent('main')).includes('verified online'), 'key references verified (mock Crossref)');
  await p.getByText('Newer reading, live from OpenAlex', { exact: false }).first().click(); await p.getByText('add to my references').first().click(); await p.waitForTimeout(300);
  s = await st(); ok(s.phases.C.accepted.length === 1, 'suggestion accepted into phase C references');

  console.log('Report');
  await go('#/report');
  const fh = await dl(() => click('Report (HTML)')); const html = fs.readFileSync(fh, 'utf8');
  ok(html.includes('AI-USE AND METHODS DISCLOSURE') && html.includes('Amira Mamdouh Kastour') && html.includes('data:image/png;base64'), 'HTML report with name, disclosure and figures');
  ok(!/<script/i.test(html.replace(/&lt;script/g, '')), 'no script in report');
  const fd = await dl(() => click('Report (Word)')); const fl = await dl(() => click('LaTeX package (.zip) for Overleaf')); const fb = await dl(() => click('References (.bib)'));
  const ft = await dl(() => click('AI-use disclosure (.txt)')); const fp = await dl(() => click('Prompt log (.csv)')); const fdc = await dl(() => click('Decision log (.csv)'));
  const fa = await dl(() => click('Project file (.anchor)'));
  console.log('  files:', [fd, fl, fb, ft, fp, fdc, fa].map(f => path.basename(f) + ' ' + fs.statSync(f).size).join(', '));
  ok(fs.readFileSync(ft, 'utf8').includes('Claude (claude.ai), Anthropic, used through copy-and-paste prompts; and Claude (claude-sonnet-5-5)'), 'disclosure names both tools used');
  ok(fs.readFileSync(fb, 'utf8').split('@').length > 30, 'BibTeX has fixed and record entries');

  console.log('Arabic / German UI');
  await p.evaluate(() => { S.setDev({ lang: 'ar' }); I18N.set('ar'); }); await go('#/phase/A'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabic sets right-to-left');
  await p.screenshot({ path: OUT + '/ar_phaseA.png' });
  await p.evaluate(() => { S.setDev({ lang: 'de' }); I18N.set('de'); }); await go('#/'); await p.screenshot({ path: OUT + '/de_home.png' });
  await p.evaluate(() => { S.setDev({ lang: 'en' }); I18N.set('en'); });

  console.log('Open the saved project again');
  await p.evaluate(async () => { await S.reset(); }); await go('#/more');
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), click('Open a saved project (.anchor)')]); await fc2.setFiles(fa); await p.waitForTimeout(1500);
  s = await st(); ok(s.phases.A.status === 'approved' && s.biblio.M && s.biblio.M.n === 25 && s.report_items.length === 3 && s.finder.shortlist.length === 3 && s.article.text, 'round trip: phases, records, figures, shortlist, article text');
  ok(s.decisions.some(d => d.decision === 'Project opened'), 'opening logged');
  fs.writeFileSync(OUT + '/state.json', JSON.stringify(s, null, 1).slice(0, 200000));
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(`\nPASS ${pass}  FAIL ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
