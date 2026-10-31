/* ANCHOR Mobile - app shell: routing, top bar, bottom navigation, shared form widgets, Home, More, Settings, About,
   and opening/saving .anchor projects. Screens for the workflow live in screens_*.js. */
(function (root) {
  'use strict';
  const h = U.h; const C = root.ANCHOR_CONTENT;
  const W = {}; root.W = W;
  const SCREENS = {}; root.SCREENS = SCREENS;

  // ---------- widgets
  W.field = (label, input, hint) => h('div', label ? h('label.lab', label) : null, input, hint ? h('p.hint', hint) : null);
  W.text = (value, on, o) => { o = o || {}; const i = h('input', { type: o.type || 'text', value: value || '', placeholder: o.placeholder || '', autocomplete: 'off', inputmode: o.inputmode, dir: o.dir || 'auto', 'aria-label': o.label });
    i.addEventListener('input', () => on(i.value)); if (o.onchange) i.addEventListener('change', () => o.onchange(i.value)); return i; };
  W.area = (value, on, o) => { o = o || {}; const a = h('textarea' + (o.cls ? '.' + o.cls : ''), { rows: o.rows || 4, placeholder: o.placeholder || '', dir: 'auto', 'aria-label': o.label }); a.value = value || '';
    a.addEventListener('input', () => on(a.value)); if (o.readonly) a.readOnly = true; return a; };
  W.select = (choices, value, on, o) => { const s = h('select', { 'aria-label': (o && o.label) || '' }, choices.map(c => h('option', { value: c.value }, c.label))); s.value = value === undefined || value === null ? '' : value;
    s.addEventListener('change', () => on(s.value)); return s; };
  W.radio = function (choices, value, on, name) {
    name = name || 'r' + U.uid(); const box = h('div.choices', { role: 'radiogroup' });
    choices.forEach(c => { const id = name + U.uid(); const inp = h('input', { type: 'radio', name: name, id: id, value: c.value, checked: c.value === value });
      const lab = h('label.choice' + (c.value === value ? '.on' : ''), { for: id }, inp, h('span', c.label));
      inp.addEventListener('change', () => { box.querySelectorAll('.choice').forEach(x => x.classList.remove('on')); lab.classList.add('on'); on(c.value); }); box.appendChild(lab); });
    return box;
  };
  W.checks = function (choices, values, on) {
    const box = h('div.choices'); const sel = new Set(values || []);
    choices.forEach(c => { const id = 'c' + U.uid(); const inp = h('input', { type: 'checkbox', id: id, checked: sel.has(c.value) });
      const lab = h('label.choice' + (sel.has(c.value) ? '.on' : ''), { for: id }, inp, h('span', c.label));
      inp.addEventListener('change', () => { if (inp.checked) sel.add(c.value); else sel.delete(c.value); lab.classList.toggle('on', inp.checked);
        on(choices.map(x => x.value).filter(v => sel.has(v))); }); box.appendChild(lab); });
    return box;
  };
  W.switch = (label, value, on) => { const i = h('input', { type: 'checkbox', checked: !!value }); i.addEventListener('change', () => on(i.checked)); return h('label.switch', i, h('span', label)); };
  W.seg = (choices, value, on) => { const box = h('div.seg', { role: 'tablist' }); choices.forEach(c => { const b = h('button' + (c.value === value ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': c.value === value ? 'true' : 'false', onclick: () => { box.querySelectorAll('button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); }); b.classList.add('on'); b.setAttribute('aria-selected', 'true'); on(c.value); } }, c.label); box.appendChild(b); }); return box; };
  // a framework question (labels and choices shown translated; answers are stored in English, as the desktop app stores them)
  W.question = function (q, value, on) {
    const label = t(q.label); const ch = (q.choices || []).map(c => ({ value: c, label: t(c) }));
    let input;
    if (q.type === 'radio') input = W.radio(ch, value, on);
    else if (q.type === 'checkbox') input = W.checks(ch, Array.isArray(value) ? value : value ? [value] : [], on);
    else if (q.type === 'textarea') input = W.area(value, on, { rows: 4, label: label });
    else input = W.text(value, on, { label: label });
    return h('div.q', h('label.lab', label), input);
  };
  W.alert = (kind, icon, ...kids) => h('div.alert' + (kind ? '.' + kind : ''), U.icon(icon || 'info'), h('div', ...kids));
  W.card = (title, ...kids) => h('section.card', title ? h('h3', title) : null, ...kids);
  W.table = function (cols, rows, o) {
    o = o || {}; const n = Math.min(rows.length, o.max || 200);
    const isNum = cols.map((c, j) => rows.slice(0, 50).every(r => r[j] === null || r[j] === undefined || r[j] === '' || typeof r[j] === 'number'));
    const fmt = v => v === null || v === undefined ? '' : typeof v === 'number' ? (Number.isInteger(v) ? (Math.abs(v) < 10000 ? String(v) : I18N.num(v)) : I18N.num(v, 3)) : String(v);
    return h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', cols.map(c => h('th', o.tr === false ? c : t(String(c)))))),
      h('tbody', rows.slice(0, n).map(r => h('tr', r.map((v, j) => h('td' + (isNum[j] ? '.num' : ''), fmt(v)))))))
    , rows.length > n ? h('p.hint', { style: { padding: '6px 10px' } }, t('Showing {n} of {m} rows.', { n: n, m: rows.length })) : null);
  };
  W.statusPill = s => h('span.pill' + (s === 'approved' ? '.ok' : s === 'needs review' ? '.warn' : s === 'open' ? '.acc' : ''), t(s));
  W.onlinePill = function (long) { const o = S.st.online;
    if (O.refreshing) return h('span.pill', U.icon('rotate'), t('checking online'));
    if (!o) return h('span.pill', long ? t('Not checked yet') : t('built-in'));
    if (o.online) return h('span.pill.ok', U.icon('globe'), long ? t('live · checked {d}', { d: o.checked_at }) : t('live {d}', { d: (o.checked_at || '').slice(11, 16) }));
    return h('span.pill.warn', long ? t('offline - {e} Built-in references in use.', { e: (o.errors || [])[0] || '' }) : t('offline')); };
  W.mdLite = function (txt) { // safe minimal rendering of a draft for previews (headings, bold, lists, paragraphs)
    const out = h('div.md'); String(txt || '').split(/\n{2,}/).forEach(block => { const b = block.trim(); if (!b) return;
      if (/^#{1,4} /.test(b)) { out.appendChild(h('h4', b.replace(/^#+ /, ''))); return; }
      if (/^([-*]|\d+[.)]) /m.test(b) && b.split('\n').every(l => /^\s*([-*]|\d+[.)]) /.test(l) || !l.trim())) { out.appendChild(h('ul', b.split('\n').filter(l => l.trim()).map(l => h('li', l.replace(/^\s*([-*]|\d+[.)]) /, ''))))); return; }
      out.appendChild(h('p', b)); }); return out; };

  // ---------- routing
  let current = null;
  root.go = function (hash) { if (location.hash === hash) render(); else location.hash = hash; };
  function parse() { const p = (location.hash || '#/').replace(/^#\/?/, '').split('/'); return { name: p[0] || 'home', args: p.slice(1) }; }
  const TITLES = { home: () => S.APP_NAME, prereq: () => t('Before you start'), find: () => t('Find a focal article'), start: () => t('Start'),
    phase: a => t('Phase {id}', { id: a[0] }), phases: () => t('Phases'), biblio: () => t('Bibliometrics'), report: () => t('Report & disclosure'), settings: () => t('Settings'), about: () => t('About'), more: () => t('More') };
  const TAB = { home: 'home', prereq: 'more', find: 'more', start: 'home', phase: 'phases', phases: 'phases', biblio: 'biblio', report: 'report', settings: 'more', about: 'more', more: 'more' };
  function render() {
    const r = parse(); const scr = SCREENS[r.name] || SCREENS.home; current = r;
    const main = document.getElementById('main'); main.innerHTML = '';
    try { main.appendChild(scr.apply(null, r.args)); } catch (e) { console.error(e); main.appendChild(W.alert('bad', 'alert', t('Something went wrong on this page: {msg}', { msg: e.message }))); }
    bar(r); nav(r); window.scrollTo(0, 0);
  }
  root.rerender = function () { const y = window.scrollY; const main = document.getElementById('main'); const r = current || parse(); main.innerHTML = '';
    try { main.appendChild((SCREENS[r.name] || SCREENS.home).apply(null, r.args)); } catch (e) { console.error(e); main.appendChild(W.alert('bad', 'alert', e.message)); } bar(r); nav(r); window.scrollTo(0, y); };
  function bar(r) {
    const b = document.getElementById('bar'); b.innerHTML = '';
    const sub = S.st.article.title ? S.st.article.title : S.APP_TAGLINE;
    const back = r.name !== 'home' && TAB[r.name] !== r.name && !['phase', 'biblio', 'report'].includes(r.name);
    b.appendChild(h('div.in',
      back ? h('button.icon-btn', { 'aria-label': t('Back'), onclick: () => history.length > 1 ? history.back() : go('#/') }, U.icon('back', 'flip')) : h('span.icon-btn', { 'aria-hidden': 'true' }, U.icon('anchor')),
      h('div.ttl', h('b', (TITLES[r.name] || TITLES.home)(r.args)), h('span', sub)),
      h('button.icon-btn', { 'aria-label': t('Save project'), title: t('Save project'), onclick: saveProject }, U.icon('save')),
      h('button.icon-btn', { 'aria-label': t('Open project'), title: t('Open project'), onclick: openProject }, U.icon('folder'))));
  }
  function nav(r) {
    const n = document.getElementById('nav'); n.innerHTML = ''; const tab = TAB[r.name] || 'home';
    const cur = S.PHASE_IDS.find(id => S.st.phases[id].status !== 'approved') || 'R';
    const items = [['home', '#/', 'home', t('Home')], ['phases', '#/phase/' + (r.name === 'phase' ? r.args[0] : cur), 'layers', t('Phases')], ['biblio', '#/biblio', 'chart', t('nav:biblio')],
      ['report', '#/report', 'doc', t('Report')], ['more', '#/more', 'menu', t('More')]];
    n.appendChild(h('div.in', items.map(it => h('a' + (tab === it[0] ? '.on' : ''), { href: it[1], 'aria-current': tab === it[0] ? 'page' : null }, U.icon(it[2]), h('span', it[3])))));
  }
  root.addEventListener('hashchange', render);

  // ---------- projects
  async function saveProject() {
    const b = U.busy(t('Saving the project...'));
    try { const origin = await S.idbGet('origin'); const bytes = await P.build(S.st, origin);
      const name = 'ANCHOR_' + U.safeName(S.st.article.title) + '_' + U.today() + '.anchor';
      b.done(); await U.save(name, bytes, 'application/octet-stream');
      S.logDecision('Set-up', 'Project saved', name);
      U.toast(t('Project saved as {name}. It contains the full text of the article: share it only with people allowed to read that article.', { name: name }), 'ok', 7000);
    } catch (e) { b.done(); console.error(e); U.toast(t('Saving failed: {msg}', { msg: e.message }), 'error'); }
  }
  root.saveProject = saveProject;
  async function openProject(file) {
    if (!(file instanceof root.File)) { const f = await U.pickFile('.anchor,.rds,application/octet-stream'); if (!f.length) return; file = f[0]; }
    if (S.st.article.text && !(await U.confirm(t('Open a saved project?'), t('The review on this device will be replaced by the project you open. Save it first if you need it.'), t('Open'), t('Cancel')))) return;
    const b = U.busy(t('Opening the project...'));
    try { const bytes = new Uint8Array(await U.readFile(file)); const st = await P.open(bytes, file.name);
      S.replace(st); await S.idbSet('origin', bytes);
      S.logDecision('Set-up', 'Project opened', `${file.name} (saved with version ${st.app_version_saved || 'before 1.1'}; opened in ANCHOR Mobile)`);
      await S.saveNow(); b.done();
      if (st.settings.mode === 'ollama') U.toast(t('This project used Ollama on a computer. The phone offers copy-and-paste prompts and the Claude API.'), 'warn', 8000);
      U.toast(t('Project restored.'), 'ok'); go(S.st.setup_ok ? '#/phase/' + (S.PHASE_IDS.find(id => S.st.phases[id].status !== 'approved') || 'R') : '#/start');
    } catch (e) { b.done(); console.error(e); U.toast(e.message, 'error', 12000); }
  }
  root.openProject = openProject;

  // ---------- Home
  SCREENS.home = function () {
    const st = S.st; const a = st.article;
    const next = !st.setup_ok ? (a.text ? '#/start' : '#/start') : '#/phase/' + (S.PHASE_IDS.find(id => st.phases[id].status !== 'approved') || 'R');
    const allDone = S.PHASE_IDS.every(id => st.phases[id].status === 'approved');
    const hero = h('div.hero', anchorMark(),
      h('h1', S.APP_NAME), h('p.tag', S.APP_TAGLINE),
      a.text ? h('p.art', h('b', a.title || a.file), h('br'), h('span.small', t('{n} of 6 phases approved', { n: S.PHASE_IDS.filter(id => st.phases[id].status === 'approved').length }))) :
        h('p.art', t('Turn one article into a systematic review and research agenda, with a decision gate after every phase.')),
      h('div.btns', h('a.btn.primary', { href: allDone ? '#/report' : next }, allDone ? t('Export the report') : a.text ? t('Continue') : t('Start a review')),
        !a.text ? h('button.btn', { onclick: () => openProject() }, U.icon('folder'), t('Open a saved project')) : null));
    const step = (href, n, title, sub, state) => h('li', h('a' + (state ? '.' + state : ''), { href: href }, h('span.n', state === 'done' ? U.icon('check') : n), h('span.d', h('b', title), h('span', sub))));
    const prDone = !!st.prereq.checked_at;
    const steps = h('ol.steps',
      step('#/prereq', '1', t('Before you start'), t('Researcher, affiliation, databases and licences'), prDone ? 'done' : ''),
      step('#/find', '2', t('Find a focal article'), st.finder && st.finder.chosen ? t('Chosen') : t('Optional: search OpenAlex and compare candidates'), st.finder && st.finder.chosen ? 'done' : ''),
      step('#/start', '3', t('Start'), a.text ? (a.file || '') : t('Upload the article and set up the review'), st.setup_ok ? 'done' : (!st.setup_ok && prDone) ? 'cur' : ''),
      C.phases.map(p => { const s = st.phases[p.id].status; return step('#/phase/' + p.id, p.id, t(p.name), t(s), s === 'approved' ? 'done' : (s === 'open' || s === 'needs review') ? 'cur' : ''); }),
      step('#/biblio', '∑', t('Bibliometrics'), st.biblio.M ? t('{n} records in use', { n: I18N.num(st.biblio.M.n) }) : t('Import exports or fetch from OpenAlex'), st.biblio.M ? 'done' : ''),
      step('#/report', '→', t('Report & disclosure'), t('HTML, Word, LaTeX, BibTeX and the AI-use disclosure'), ''));
    const saved = S.lastSaved ? h('p.hint', t('Saved on this device {d}.', { d: S.lastSaved })) : null;
    return h('div', hero, h('div.sect', h('h2', t('Your review'))), steps, saved);
  };
  function anchorMark() { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'mark'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M12 7a2 2 0 100-4 2 2 0 000 4zM12 7v14M5 13a7 7 0 0014 0M8 10h8'); s.appendChild(p); return s; }

  // ---------- More
  SCREENS.more = function () {
    const it = (href, icon, title, sub, onclick) => h(href ? 'a' : 'button', href ? { href: href } : { onclick: onclick, type: 'button' }, U.icon(icon), h('span.d', h('b', title), sub ? h('span', sub) : null), U.icon('next', 'flip'));
    return h('div',
      h('div.list', it('#/prereq', 'list', t('Before you start'), t('Researcher, affiliation, databases and licences')), it('#/find', 'search', t('Find a focal article'), t('Search OpenAlex, shortlist, compare'))),
      h('div.sect', h('h2', t('Project'))),
      h('div.list', it(null, 'folder', t('Open a saved project (.anchor)'), t('Projects from ANCHOR Studio on a computer open here too'), () => openProject()),
        it(null, 'save', t('Save project (.anchor)'), t('Opens in ANCHOR Studio on a computer'), saveProject),
        it(null, 'trash', t('Start a new review'), t('Clears the review on this device'), async () => { if (await U.confirm(t('Start a new review?'), t('The review on this device is deleted. Save the project first if you need it.'), t('Delete and start new'), t('Cancel'))) { await S.reset(); U.toast(t('New review started.'), 'ok'); go('#/'); } })),
      h('div.sect', h('h2', t('App'))),
      h('div.list', it('#/settings', 'gear', t('Settings'), t('Language, drafting mode, internet features')), it('#/about', 'info', t('About'), S.APP_BRAND)));
  };

  // ---------- Settings
  SCREENS.settings = function () {
    const d = S.dev();
    const langSel = W.select(Object.keys(I18N.NAMES).map(k => ({ value: k, label: I18N.NAMES[k] })), I18N.lang, v => { S.setDev({ lang: v }); I18N.set(v); rerender(); }, { label: t('Language') });
    const draftSel = W.select([{ value: '', label: t('Same as the app') }].concat(Object.keys(I18N.NAMES).map(k => ({ value: k, label: I18N.NAMES[k] }))), d.draft_lang || '', v => S.setDev({ draft_lang: v }), { label: t('Language of AI drafts') });
    const themeSeg = W.seg([{ value: 'system', label: t('System') }, { value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }], d.theme || 'system', v => { S.setDev({ theme: v }); applyTheme(); });
    const keyIn = W.text(S.apiKey(), v => S.setDev({ api_key: v.trim() }), { type: 'password', placeholder: 'sk-ant-...', label: t('Anthropic API key') });
    return h('div',
      W.card(t('Language and appearance'), W.field(t('Language'), langSel), W.field(t('Language of AI drafts'), draftSel, t('Prompts ask Claude to write in this language; the framework instructions stay in English.')), h('label.lab', t('Theme')), themeSeg),
      W.card(t('Drafting mode'), modeChooser(),
        W.switch(t("Include the article's text in prompts (otherwise attach the PDF in Claude yourself)"), d.include_text, v => S.setDev({ include_text: v })),
        h('h4', t('Claude API')), W.field(t('Anthropic API key'), keyIn, t('Used only to call the Claude API from this device. Never written into project files, reports or logs.')),
        W.switch(t('Remember the key on this device'), d.remember_key, v => S.setDev({ remember_key: v })),
        h('p.hint', t('A remembered key is stored unencrypted in this app\'s storage on this device. Leave it off on shared devices.')),
        W.field(t('Model'), W.text(d.api_model, v => S.setDev({ api_model: v.trim() || 'claude-sonnet-5-5' }))),
        h('div.btns', h('button.btn.sm', { onclick: async () => { const b = U.busy(t('Testing the connection...')); try { const r = await AI.test(); b.done(); U.toast(t('Claude answered: {r}', { r: String(r).slice(0, 60) }), 'ok'); } catch (e) { b.done(); U.toast(e.message, 'error'); } } }, U.icon('play'), t('Test connection')))),
      W.card(t('Internet features'),
        W.switch(t('Live reference checks, retraction alerts and new-reading suggestions (Crossref, OpenAlex)'), d.online, v => { S.setDev({ online: v }); }),
        h('p.hint', t('Only DOIs and short search terms are sent; never the article text, drafts, notes or keys. Without a connection the app uses its built-in references.')),
        W.field(t('Contact email (optional)'), W.text(d.crossref_mailto, v => S.setDev({ crossref_mailto: v.trim() }), { type: 'email', placeholder: t('leave empty to stay anonymous') }), t('Gives faster Crossref and OpenAlex access. Kept on this device only.')),
        W.field(t('OpenAlex API key (optional, for heavy use)'), W.text(d.openalex_key, v => S.setDev({ openalex_key: v.trim() }), { type: 'password' })),
        h('div.row', { style: { marginTop: '10px' } }, h('button.btn.sm', { onclick: async () => { const p = O.refresh(); rerender(); await p; rerender(); } }, U.icon('rotate'), t('Check now')), W.onlinePill(true))),
      W.card(t('This device'), h('p.small', S.lastSaved ? t('The review is saved automatically on this device (last: {d}).', { d: S.lastSaved }) : t('The review is saved automatically on this device.')),
        h('p.hint', t('The saved review includes the article\'s full text; it stays in this app\'s storage on this device.')),
        h('div.btns', h('button.btn.sm', { onclick: async () => { await S.saveNow(); U.toast(t('Saved.'), 'ok'); } }, U.icon('save'), t('Save now')))));
  };
  function modeChooser() {
    const choices = [{ value: 'prompt', label: t('Copy-and-paste prompts (Claude.ai, no key)') }, { value: 'api', label: t('Claude API key (drafts inside the app)') }, { value: 'manual', label: t('Manual only (no AI)') }];
    return h('div', W.radio(choices, S.dev().mode, v => { S.setDev({ mode: v }); S.logDecision('Set-up', 'Drafting mode', v); }),
      h('div.tbl-wrap', h('table.tbl', h('tr', h('th', t('Mode')), h('th', t('Strength')), h('th', t('Limit'))),
        h('tr', h('td', t('Copy-and-paste')), h('td', t('Uses your claude.ai account; no key')), h('td', t('More taps'))),
        h('tr', h('td', t('API key')), h('td', t('One tap per phase')), h('td', t('Paid API; text leaves your device'))),
        h('tr', h('td', t('Manual')), h('td', t('Full control')), h('td', t('Slowest'))))));
  }
  W.modeChooser = modeChooser;
  function applyTheme() { const th = S.dev().theme; if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme'); }

  // ---------- About (with the tribute)
  W.tribute = () => h('div.tribute', h('img', { src: 'img/tribute.png', alt: t('Portrait of Mamdouh Kastour'), width: 84, height: 84 }),
    h('div', h('p', h('em', t('In tribute to my father,')), h('br'), h('b', 'Mamdouh Kastour'), ' (1950–2020)'),
      h('p.hint', t("Photo: Kastour family. All rights reserved; not covered by the app's GPL-3 licence."))));
  SCREENS.about = function () {
    return h('div',
      W.card(null, h('p.brandline', h('b', S.APP_BRAND)), h('p.muted', S.APP_TAGLINE),
        h('div.kv', h('span', t('Mobile app')), h('span', 'ANCHOR Mobile ' + S.MOBILE_VERSION), h('span', t('Project files')), h('span', t('compatible with ANCHOR Studio {v}', { v: S.APP_VERSION }))),
        h('p.small', { style: { marginTop: '10px' } }, t('ANCHOR framework by Amira Mamdouh Kastour · bibliometric engine: a JavaScript port of bibliometrix (Aria & Cuccurullo, 2017) · developed with Claude (Anthropic).')),
        W.tribute()),
      W.card(t('Licences'), h('p.small', t('ANCHOR Mobile is GPL-3. Bundled software keeps its own licences: pdf.js (Apache-2.0), JSZip (MIT), SheetJS Community Edition (Apache-2.0), Papa Parse (MIT), world-atlas and topojson-client (ISC; Natural Earth data, public domain), IBM Plex and Source Serif 4 fonts (SIL OFL 1.1). Reference data from bibliometrix (GPL-3).')),
        h('p.small', t('Crossref, OpenAlex and ROR metadata are CC0; ORCID public data under ORCID terms. The tribute portrait is © the Kastour family and not under GPL-3.')),
        h('a.btn.sm', { href: 'vendor/licenses/NOTICE.txt', target: '_blank' }, U.icon('doc'), t('Full licence notices'))),
      W.card(t('Privacy'), h('p.small', t('Your review, the article and its text stay on this device. Live checks send only DOIs and short search terms. In API mode the prompt (with the article text, if you include it) goes to Anthropic with your own key. Nothing is sent to the app\'s author.'))));
  };

  // ---------- start-up
  async function boot() {
    I18N.init(); applyTheme();
    if (root.ANCHOR_BXDATA) { BX.COUNTRIES = ANCHOR_BXDATA.countries.map(c => ({ name: c[0], continent: c[1], lon: c[2], lat: c[3] })); BX.STOPWORDS = ANCHOR_BXDATA.stopwords; }
    await S.load();
    S.on('settings', () => { const b = document.getElementById('bar'); if (b && current) bar(current); });
    render();
    // the Android app hands over a .anchor file opened from another app
    root.anchorOpenFromAndroid = function (name, b64) { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); openProject(new File([u8], name)); };
    if (root.AnchorAndroid && root.AnchorAndroid.ready) root.AnchorAndroid.ready();
    // check references and new reading once a day while the app is open
    const o = S.st.online; const stale = !o || !o.checked_at || (Date.now() - new Date(o.checked_at.replace(' ', 'T')).getTime()) > 6 * 3600 * 1000;
    if (S.cfg().enabled && stale && navigator.onLine !== false && !root.ANCHOR_NO_AUTO_ONLINE) setTimeout(() => O.refresh().then(() => { if (current && ['phase', 'settings', 'start'].includes(current.name)) rerender(); }), 2500);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !root.AnchorAndroid) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  root.addEventListener('DOMContentLoaded', boot);
})(window);
