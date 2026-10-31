/* ANCHOR Mobile - Before you start, Find a focal article, Start. */
(function (root) {
  'use strict';
  const h = U.h; const C = root.ANCHOR_CONTENT;
  const ISO = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'.split(' ');
  const regionName = (cc, l) => { try { return new Intl.DisplayNames([l || I18N.lang], { type: 'region' }).of(cc); } catch (e) { return cc; } };
  root.regionName = regionName;
  const prq = () => S.st.prereq;
  const setP = (patch) => { Object.assign(S.st.prereq, patch); S.changed('prereq'); };

  // ---------------------------------------------------------------- Before you start
  SCREENS.prereq = function () {
    const p = prq();
    const nameIn = W.text(p.name || S.st.setup.S_name || '', v => { setP({ name: v }); if (!S.st.setup.S_name || S.st.setup.S_name === p.name) S.st.setup.S_name = v; });
    const orcidStatus = h('div');
    const showOrcid = () => { orcidStatus.innerHTML = ''; const id = p.orcid || ''; if (!id) return;
      orcidStatus.appendChild(O.orcidOk(id) ? h('p.hint.st-ok', U.icon('check'), ' ', t('Valid ORCID iD'), p.orcid_name ? ' (' + t('public record: {n}', { n: p.orcid_name }) + ')' : '') : h('p.hint.st-bad', t('This is not a valid ORCID iD (format or check digit).'))); };
    const orcidIn = W.text(p.orcid, v => { setP({ orcid: v.trim().replace(/^https?:\/\/orcid.org\//, '').toUpperCase(), orcid_name: '' }); showOrcid(); }, { placeholder: '0000-0000-0000-0000', inputmode: 'text' });
    showOrcid();
    const orcidBtn = h('button.btn.sm', { onclick: async () => { if (!O.orcidOk(p.orcid)) return U.toast(t('Enter a valid ORCID iD first.'), 'warn');
      try { const nm = await O.orcidName(p.orcid); setP({ orcid_name: nm }); showOrcid(); } catch (e) { U.toast(e.message, 'error'); } } }, U.icon('user'), t('Check'));
    const card1 = W.card('1 · ' + t('Researcher'),
      W.field(t('Name as it should appear on outputs'), nameIn),
      W.field(t('ORCID iD (optional)'), h('div.row', h('div.grow', orcidIn), orcidBtn)), orcidStatus,
      W.field(t('Role'), W.select(['', 'Student (bachelor)', 'Student (master)', 'Doctoral researcher', 'Researcher or staff', 'Other'].map(v => ({ value: v, label: v ? t(v) : '—' })), p.role, v => setP({ role: v }))),
      W.field(t('Programme or module'), W.text(p.programme, v => setP({ programme: v }))),
      W.field(t('Supervisor or reviewer (optional)'), W.text(p.supervisor, v => setP({ supervisor: v }))),
      h('label.lab', t('I am prepared in')), W.checks(C.skills.map(s => ({ value: s.value, label: t(s.label) })), p.skills, v => setP({ skills: v })),
      h('p.hint', t("Not yet? Each stage's 'Lessons learned' card lists checked references to prepare.")),
      W.field(t('Time plan per phase (optional)'), W.area(p.timeplan, v => setP({ timeplan: v }), { rows: 2 })));

    // software on this device
    const sw = [[t('ANCHOR Mobile'), 'ok', 'ANCHOR Mobile ' + S.MOBILE_VERSION + ' (' + t('projects compatible with ANCHOR Studio {v}', { v: S.APP_VERSION }) + ')'],
      [t('Bibliometrics'), 'ok', t('bibliometrix 4.3.1 analyses ported to JavaScript (checked against R)')],
      [t('Econometrics (phase O)'), 'desktop', t('Runs in ANCHOR Studio on a computer')],
      [t('Internet features'), !S.cfg().enabled ? 'off' : S.st.online ? (S.st.online.online ? 'ok' : 'offline') : 'not checked', 'Crossref, OpenAlex'],
      [t('AI drafting mode'), 'ok', S.dev().mode + (S.dev().mode === 'api' ? ' (' + S.dev().api_model + ')' : '')]];
    const card2 = W.card('2 · ' + t('Software'), h('div.tbl-wrap', h('table.tbl', sw.map(r => h('tr', h('td', r[0]), h('td', h('span.pill' + (r[1] === 'ok' ? '.ok' : r[1] === 'offline' ? '.warn' : ''), t(r[1]))), h('td.muted', r[2]))))),
      h('label.lab', t('Outside tools I will also use (optional)')),
      W.checks([['latex', 'LaTeX or Overleaf'], ['rstudio', 'RStudio'], ['python_lseg', 'Python with the LSEG Data Library'], ['stata', 'Stata'], ['refman', 'A reference manager (Zotero, Citavi, EndNote)']].map(x => ({ value: x[0], label: t(x[1]) })), p.tools, v => setP({ tools: v })));

    // affiliation
    const instBox = h('div');
    const results = h('div');
    const instNote = () => { instBox.innerHTML = ''; if (p.institution) instBox.appendChild(W.alert('ok', 'check', h('b', p.institution), p.ror_id ? h('span.small', ' · ROR ' + p.ror_id.replace('https://ror.org/', '')) : h('span.small', ' · ' + t('typed by you')))); };
    instNote();
    const choose = (r, how) => { setP({ ror_id: r.id, institution: r.name, domains: r.domains, inst_country: r.country || '' }); S.st.setup.S_inst = r.name;
      const lib = libraryDbs(r.name, r.domains); if (lib) { if (!p.dbs.length) setP({ dbs: lib.dbs.slice(), db_source: lib.source }); if (!p.access_route) setP({ access_route: lib.access }); }
      S.logDecision('Setup', 'Affiliation', `${r.name} (${r.id}) ${how}`); results.innerHTML = ''; rerender(); };
    const search = U.debounce(async q => { results.innerHTML = ''; if (q.trim().length < 3) return;
      try { const r = await O.rorSearch(q, p.country); results.appendChild(r.length ? h('div.list', r.slice(0, 12).map(x => h('button', { type: 'button', onclick: () => choose(x, 'chosen from the list') }, h('span.d', h('b', x.name), h('span', [x.city, regionName(x.country)].filter(Boolean).join(', ')))))) : h('p.hint', t('No institution found. Type the name below instead.')));
        results.appendChild(h('p.hint', t('Source: Research Organization Registry (ROR, CC0).'))); } catch (e) { results.appendChild(h('p.hint.st-bad', e.message)); } }, 600);
    const countrySel = W.select([{ value: '', label: t('(choose)') }].concat(ISO.map(c => ({ value: c, label: regionName(c) })).sort((a, b) => a.label.localeCompare(b.label, I18N.lang))), p.country, v => setP({ country: v, country_how: v ? 'chosen' : '' }));
    const domainIn = W.text('', () => {}, { placeholder: t('e.g. name@university.edu (only the part after @ is used)'), type: 'email' });
    const card3 = W.card('3 · ' + t('Academic affiliation'),
      W.field(t('Region (country)'), countrySel),
      W.field(t('Institution'), W.text('', v => search(v), { type: 'search', placeholder: t('Search institutions by name') }), t('Searches the Research Organization Registry, in the region you chose first.')),
      results, instBox,
      W.field(t('Or detect from your institution\'s email domain'), h('div.row', h('div.grow', domainIn), h('button.btn.sm', { onclick: async () => { try { const r = await O.rorByDomain(domainIn.value); choose(r, 'detected from the email domain ' + domainIn.value.replace(/.*@/, '')); U.toast(t('Detected: {n}.', { n: r.name }), 'ok'); } catch (e) { U.toast(e.message, 'error'); } } }, t('Detect')))),
      W.field(t('Not listed? Type the institution\'s name'), W.text(p.ror_id ? '' : p.institution, v => { setP({ institution: v.trim(), ror_id: '', domains: '', inst_country: '' }); S.st.setup.S_inst = v.trim(); })),
      W.field(t('Faculty or department'), W.text(p.faculty, v => setP({ faculty: v }))),
      W.field(t('Library access route'), W.text(p.access_route, v => setP({ access_route: v }), { placeholder: t('e.g. VPN, campus network, proxy') })),
      W.field(t('Library link for articles (optional)'), W.text(p.resolver, v => setP({ resolver: v.trim() }), { type: 'url', placeholder: 'https://proxy.example.edu/login?url=' }), t("Your library's proxy or link-resolver prefix; articles then open through the library.")),
      h('label.lab', t('Institutional rules I have read')), W.checks(C.rules.map(r => ({ value: r.value, label: t(r.label) })), p.rules, v => setP({ rules: v })),
      W.field(t('Links to those rules (optional)'), W.area(p.rule_links, v => setP({ rule_links: v }), { rows: 2 })),
      h('label.lab', t('Ethics approval')), W.radio(C.ethics.map(e => ({ value: e.value, label: t(e.label) })), p.ethics, v => setP({ ethics: v })));

    // databases and licensing
    const lib = libraryDbs(p.institution, p.domains);
    const raters = () => { const r = C.db_catalog.filter(d => p.dbs.includes(d.id) && d.rater).map(d => d.rater); return Array.from(new Set(r)); };
    const raterBox = h('div'); const showR = () => { raterBox.innerHTML = ''; const ra = raters();
      raterBox.appendChild(W.alert(ra.length >= 2 ? 'ok' : 'warn', ra.length >= 2 ? 'check' : 'alert', h('b', t('ESG rating families available: {n}', { n: ra.length })), ra.length ? ' (' + ra.join(', ') + ').' : '',
        ra.length < 2 ? ' ' + t("The anchor article's rating disagreement needs at least two raters. Phase O offers three routes: a hand-collected second rater, LSEG pillar dispersion as a proxy, or consensus only.") : '')); };
    showR();
    const card4 = W.card('4 · ' + t('Databases and licensing'),
      h('p.hint', t('Tick what you can actually use. The app pre-ticks what your library is known to license; you confirm.')),
      lib ? h('p.hint', t('Library list: {s}', { s: lib.source })) : h('p.hint', t('No library list known for your institution: tick what you can use.')),
      W.checks(C.db_catalog.map(d => ({ value: d.id, label: h('span', t(d.name), h('span.muted.small', ' · ' + t(d.licence)), lib && lib.dbs.includes(d.id) ? h('span.pill', { style: { marginInlineStart: '6px' } }, t('listed by your library')) : null) })), p.dbs, v => { setP({ dbs: v }); showR(); }),
      raterBox,
      W.field(t('Licence for my report'), W.select(C.output_licences.map(x => ({ value: x.value, label: t(x.label) })), p.output_licence, v => setP({ output_licence: v }))),
      W.field(t('Licence for my analysis code'), W.select(C.code_licences.map(x => ({ value: x.value, label: t(x.label) })), p.code_licence, v => setP({ code_licence: v }))),
      h('details.small', h('summary', t('What may be shared')), h('ul',
        h('li', t("ANCHOR Studio is GPL-3; bundled software keeps its own licences (see About). The tribute portrait is © the Kastour family and not under GPL-3.")),
        h('li', t('Crossref, OpenAlex and ROR metadata are CC0; World Bank data CC BY 4.0; FRED, French library, GDELT, IMF and SEC data under their own terms (cite them).')),
        h('li', t('Licensed data (LSEG, WRDS, FactSet, Bloomberg, MSCI, Sustainalytics) and the published article PDF are never put in files the app makes for sharing.')),
        h('li', t("These are short summaries, not legal advice; follow each provider's terms.")))));
    return h('div',
      W.alert('', 'list', h('b', t('Before you start.')), ' ', t('Record who is doing the review, with what software, under which affiliation and with which data licences. Everything here is printed as an appendix in your reports. Passwords, keys and email addresses are never stored.')),
      card1, card2, card3, card4,
      h('div.btns', h('button.btn.primary', { onclick: () => { setP({ checked_at: U.now() }); S.logDecision('Setup', 'Before you start saved', `${p.dbs.length} databases, ${raters().length} rating families`); go('#/start'); } }, t('Save and continue to Start'), U.icon('next', 'flip')),
        p.checked_at ? h('span.hint', t('Saved {d}', { d: p.checked_at })) : null));
  };
  function libraryDbs(name, domains) {
    for (const r of C.institution_dbs) { const doms = String(r.domains).split(/\s+/);
      if ((domains && doms.some(d => domains.indexOf(d) >= 0)) || (name && String(name).toLowerCase().indexOf(r.name_pattern) >= 0)) return r; }
    return null;
  }

  // ---------------------------------------------------------------- Find a focal article
  const FMAX = 10;
  let found = null;            // the last search (not stored; the shortlist is)
  let fq = { query: '', from: 2000, to: new Date().getFullYear(), types: ['article', 'review'], lang: '', min_cites: 0, sort: 'relevance', oa_only: false };
  const fin = () => { if (!S.st.finder) S.st.finder = { shortlist: [], ticks: {}, notes: {}, summary: '', query: '', filters: '', sort: 'relevance', found: 0, searched_at: '', chosen: null, chosen_at: null, reason: '' }; return S.st.finder; };
  const vlabel = v => C.version_label[v] ? t(C.version_label[v]) : v;
  const CRIT = () => C.find_criteria.map(c => ({ value: c.label, label: t(c.value) }));
  async function cand(id) { return S.idbGet('cand:' + id); }
  SCREENS.find = function () {
    const f = S.st.finder; const short = (f && f.shortlist) || [];
    const box = h('div');
    if (f && f.query && !fq.query) fq.query = f.query;
    const qIn = W.text(fq.query, v => { fq.query = v; }, { type: 'search', placeholder: t('Subject in plain words, e.g. ESG rating disagreement stock returns') });
    qIn.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    const status = h('div');
    const resBox = h('div');
    async function run() {
      if (!S.cfg().enabled) return U.toast(t('Searching needs the internet features (Settings). You can still upload an article on the Start page.'), 'warn');
      const b = U.busy(t('Searching OpenAlex...'));
      try { found = await O.findSearch(Object.assign({}, fq, { n: 50 })); const ff = fin(); Object.assign(ff, { query: found.query, filters: found.filters, sort: found.sort, found: found.found, searched_at: found.at }); S.changed('finder'); }
      catch (e) { U.toast(e.message, 'error'); } finally { b.done(); }
      drawResults();
    }
    function drawResults() {
      status.innerHTML = ''; resBox.innerHTML = '';
      if (!found) { status.appendChild(h('p.hint', S.cfg().enabled ? t('No search yet.') : t('Internet features are off (Settings), so search is not available.'))); return; }
      if (!found.rows.length) { status.appendChild(W.alert('', 'info', t('No matches. Widen the years, remove filters or use other words.'))); return; }
      const nret = found.rows.filter(r => r.retracted).length;
      status.appendChild(h('p.small', t('{n} matches in OpenAlex ({d}); showing the first {k}.', { n: I18N.num(found.found), d: found.at, k: found.rows.length }), nret ? h('span.st-bad', ' ' + t('{n} retracted.', { n: nret })) : null));
      const sl = fin().shortlist;
      found.rows.forEach(r => { const on = sl.some(x => x.id === r.id);
        resBox.appendChild(h('div.cand' + (on ? '.short' : ''), r.retracted ? h('span.pill.bad', t('RETRACTED')) : null, h('h3', r.title),
          h('div.meta', `${r.authors} (${r.year === null ? 'n.d.' : r.year}). ${r.journal}`),
          h('div.row.small', { style: { marginTop: '6px' } }, h('span.pill', t('{n} citations', { n: I18N.num(r.cites) })), r.per_year !== null ? h('span.pill', t('{n} per year', { n: I18N.num(r.per_year, 1) })) : null, r.fwci !== null ? h('span.pill', 'FWCI ' + I18N.num(r.fwci, 2)) : null,
            h('span.pill' + (r.pdf_url || r.oa_url ? '.ok' : ''), r.pdf_url || r.oa_url ? t('open') + (r.version ? ' (' + vlabel(r.version) + ')' : '') : t('closed'))),
          h('div.btns', on ? h('span.pill.acc', U.icon('check'), t('On the shortlist')) : h('button.btn.sm', { onclick: () => addShort(r) }, U.icon('plus'), t('Add to the shortlist')),
            r.abstract ? h('details.small.grow', h('summary', t('Abstract (OpenAlex)')), h('p', r.abstract)) : null))); });
    }
    function addShort(r) { const ff = fin(); if (ff.shortlist.some(x => x.id === r.id)) return U.toast(t('Already on the shortlist.'));
      if (ff.shortlist.length >= FMAX) return U.toast(t('The shortlist holds {n} candidates. Remove one first.', { n: FMAX }), 'warn');
      ff.shortlist.push(Object.assign({}, r)); S.changed('finder'); rerender(); }
    drawResults();
    const filters = h('details', { style: { marginTop: '8px' } }, h('summary.small', U.icon('filter'), ' ', t('Filters and sorting')),
      h('div.row', h('div.grow', W.field(t('From year'), W.text(fq.from, v => { fq.from = v; }, { type: 'number', inputmode: 'numeric' }))), h('div.grow', W.field(t('To year'), W.text(fq.to, v => { fq.to = v; }, { type: 'number', inputmode: 'numeric' })))),
      h('label.lab', t('Type')), W.checks(C.find_types.map(x => ({ value: x.value, label: t(x.label) })), fq.types, v => { fq.types = v; }),
      W.field(t('Language'), W.select([['', 'Any language'], ['en', 'English'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['ar', 'Arabic'], ['zh', 'Chinese']].map(x => ({ value: x[0], label: t(x[1]) })), fq.lang, v => { fq.lang = v; })),
      W.field(t('Min. citations'), W.text(fq.min_cites, v => { fq.min_cites = v; }, { type: 'number', inputmode: 'numeric' })),
      W.field(t('Sort by'), W.select(C.find_sorts.map(x => ({ value: x.value, label: t(x.label) })), fq.sort, v => { fq.sort = v; })),
      W.switch(t('Open access only'), fq.oa_only, v => { fq.oa_only = v; }));
    const searchCard = W.card(t('Find a focal article'),
      h('p.hint', t('Search OpenAlex, shortlist up to ten candidates, read them, compare them and choose one. Legal open copies can be downloaded and stay on this device; paywalled articles open through your library (link prefix on Before you start). Downloaded PDFs are never put in project files, reports or shared packages.')),
      h('div.row', h('div.grow', qIn), h('button.btn.primary', { onclick: run }, U.icon('search'), t('Search'))), filters, status, resBox,
      h('p.hint', t('Already have the article?'), ' ', h('a', { href: '#/start' }, t('Go to Start and upload it.'))));

    // shortlist
    const shortCard = W.card(t('Shortlist') + ` (${short.length}/${FMAX})`);
    if (!short.length) shortCard.appendChild(h('p.hint', t('Nothing shortlisted yet. Search and add candidates.')));
    const ff = S.st.finder; const resolver = prq().resolver;
    short.forEach(r => {
      const pdfNote = h('span.small'); cand(r.id).then(c => { if (c) pdfNote.appendChild(h('span.st-ok', U.icon('doc'), ' ', t('PDF on this device ({how}, {kb} KB)', { how: t(c.how), kb: Math.round(c.bytes.length / 1024) }))); });
      const el = h('div.cand.short',
        h('div.row.between', h('div.grow', r.retracted ? h('span.pill.bad', t('retracted')) : null, h('h3', r.title), h('div.meta', `${r.authors} (${r.year}). ${r.journal}${r.doi ? ' · doi:' + r.doi : ''}`)),
          h('button.icon-btn', { 'aria-label': t('Remove'), onclick: () => { ff.shortlist = ff.shortlist.filter(x => x.id !== r.id); delete ff.ticks[r.id]; delete ff.notes[r.id]; S.idbDel('cand:' + r.id); S.changed('finder'); rerender(); } }, U.icon('x'))),
        h('div.btns',
          r.pdf_url || r.oa_url ? h('span.pill.ok', t('open copy') + (r.version ? ': ' + vlabel(r.version) : '') + (r.licence ? ' · ' + r.licence : '')) : h('span.pill', t('no open copy')),
          r.pdf_url ? h('button.btn.sm', { onclick: () => download(r) }, U.icon('download'), t('Download open copy')) : null,
          r.oa_url ? h('button.btn.sm', { onclick: () => U.open(r.oa_url) }, U.icon('external'), t('Open copy')) : null,
          r.doi ? h('button.btn.sm', { onclick: () => U.open(O.libraryLink(r.doi, resolver)) }, U.icon('external'), resolver ? t('Open in library') : t('Open at publisher (DOI)')) : null,
          h('button.btn.sm', { onclick: () => uploadFor(r) }, U.icon('upload'), t('Add the PDF you obtained'))), pdfNote,
        h('label.lab', t('Your judgement')), W.checks(CRIT(), ff.ticks[r.id] || [], v => { ff.ticks[r.id] = v; S.changed('finder'); drawCompare(); }),
        W.field(t('Notes'), W.area(ff.notes[r.id] || '', v => { ff.notes[r.id] = v; S.changed('finder'); }, { rows: 2 })),
        r.abstract ? h('details.small', h('summary', t('Abstract (OpenAlex)')), h('p', r.abstract)) : h('p.hint', t('No abstract in OpenAlex.')));
      shortCard.appendChild(el);
    });
    async function download(r) {
      if (!S.cfg().enabled) return U.toast(t('Downloading needs the internet features (Settings).'), 'warn');
      const b = U.busy(t('Downloading the open copy...'));
      try { const bytes = await O.download(r.pdf_url); await S.idbSet('cand:' + r.id, { bytes: bytes, how: 'open copy', at: U.now(), name: (r.doi || r.id).replace(/[^A-Za-z0-9._-]/g, '_') + '.pdf' });
        S.logDecision('Find', 'Open copy downloaded (private folder)', `doi:${r.doi}; ${vlabel(r.version)}; licence: ${r.licence || 'not stated'}`); b.done(); U.toast(t('Saved on this device only.'), 'ok'); rerender(); }
      catch (e) { b.done(); U.toast(t('Download failed: {msg}', { msg: e.message }), 'error', 12000); }
    }
    async function uploadFor(r) { const fl = await U.pickFile('.pdf,application/pdf'); if (!fl.length) return; const bytes = new Uint8Array(await U.readFile(fl[0]));
      if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '%PDF') return U.toast(t('That file is not a PDF.'), 'error');
      await S.idbSet('cand:' + r.id, { bytes: bytes, how: 'uploaded by you', at: U.now(), name: fl[0].name }); U.toast(t('PDF kept on this device only.'), 'ok'); rerender(); }

    // comparison
    const cmpBox = h('div');
    function scored() { const ff2 = S.st.finder; const sh = (ff2 && ff2.shortlist) || []; sh.forEach(r => { r.fit = O.fitScore(r, ff2.ticks[r.id], sh); }); return sh; }
    function drawCompare() { cmpBox.innerHTML = ''; const sh = scored(); if (!sh.length) { cmpBox.appendChild(h('p.hint', t('Shortlist candidates to compare them.'))); return; }
      cmpBox.appendChild(W.table(['Candidate', 'Retracted', 'Citations', 'Per year', 'FWCI', 'Open copy', 'References', 'Your ticks', 'Fit (guide)'],
        sh.map(r => [`${r.title.slice(0, 70)} (${r.year})`, r.retracted ? t('YES') : t('no'), r.cites, r.per_year, r.fwci === null ? '-' : Math.round(r.fwci * 100) / 100, r.pdf_url || r.oa_url ? (r.version ? vlabel(r.version) : t('yes')) : t('none'), r.n_refs, ((ff.ticks[r.id] || []).length) + '/4', r.fit]))); }
    drawCompare();
    const cmpCard = W.card(t('Compare the candidates'), h('p.hint', t('The score combines your ticks (60%) with citations per year, field-weighted citation impact and open-copy availability (40%); a retracted article scores 0. It is a guide only: you choose.')), cmpBox, short.length ? aiSummary(short) : null);

    // choose
    let choice = (ff && ff.chosen) || (short[0] && short[0].id); let reason = (ff && ff.reason) || '';
    const useCard = W.card(t('Use as focal article'), short.length ? h('div',
      W.field(t('Candidate'), W.select(short.map(r => ({ value: r.id, label: `${r.title.slice(0, 90)} (${r.year})${r.retracted ? ' [' + t('RETRACTED') + ']' : ''}` })), choice, v => { choice = v; })),
      W.field(t('Why this article? (goes into the decision log and the report)'), W.area(reason, v => { reason = v; }, { rows: 2 })),
      h('div.btns', h('button.btn.primary', { onclick: () => useIt(choice, reason) }, t('Use as focal article and open Start'), U.icon('next', 'flip'))),
      ff && ff.chosen ? h('p.hint.st-ok', U.icon('check'), ' ', t('Chosen {d}; logged with {n} alternative(s).', { d: ff.chosen_at || '', n: Math.max(0, short.length - 1) })) : null) : h('p.hint', t('Shortlist at least one candidate.')));
    return h('div', searchCard, shortCard, cmpCard, useCard);
  };
  function aiSummary(short) {
    const ff = S.st.finder; const m = S.dev().mode; const pr = O.findSummaryPrompt(short);
    const out = ff.summary ? h('div.card', { style: { background: 'var(--surface2)' } }, h('b.small', t('AI summary of the abstracts (labelled as AI output; check it against the abstracts)')), h('pre.small', { style: { whiteSpace: 'pre-wrap' } }, ff.summary)) : null;
    const head = h('h4', t("Optional: AI summary of each candidate's abstract"));
    if (m === 'manual') return h('div', head, h('p.hint', t('Your drafting mode is Manual (no AI), so no summary is offered. Read the abstracts above.')), out);
    if (m === 'prompt') { const ta = W.area(pr, () => {}, { rows: 5, cls: 'mono', readonly: true }); let paste = '';
      return h('div', head, h('p.hint', t('Copy this prompt into claude.ai, then paste the answer back. The prompt is logged only when you paste an answer.')), ta,
        h('div.btns', h('button.btn.sm', { onclick: async () => { await U.copy(pr, ta); U.toast(t('Prompt copied.'), 'ok'); } }, U.icon('copy'), t('Copy prompt')), h('button.btn.sm', { onclick: () => U.open('https://claude.ai/new') }, U.icon('external'), 'claude.ai')),
        W.field(t('Paste the answer here'), W.area('', v => { paste = v; }, { rows: 4 })),
        h('div.btns', h('button.btn.sm', { onclick: () => { if (!paste.trim()) return U.toast(t('Paste the answer first.'), 'warn'); S.logPrompt('Find', pr, 'prompt'); ff.summary = paste.trim(); S.changed('finder'); U.toast(t('Summary saved; the prompt is in the prompt log.'), 'ok'); rerender(); } }, t('Save the summary'))), out); }
    return h('div', head, h('p.hint', t('Sends the abstracts (not your notes) to the Claude API.')),
      h('div.btns', h('button.btn.sm', { onclick: async () => { const b = U.busy(t('Summarising the abstracts...')); try { const x = await AI.draft('api', pr); S.logPrompt('Find', pr, 'api'); ff.summary = x.trim(); S.changed('finder'); b.done(); rerender(); } catch (e) { b.done(); U.toast(e.message, 'error'); } } }, U.icon('wand'), t('Summarise the abstracts'))), out);
  }
  async function useIt(id, reason) {
    const ff = S.st.finder; const sh = ff.shortlist; sh.forEach(r => { r.fit = O.fitScore(r, ff.ticks[r.id], sh); }); const r = sh.find(x => x.id === id); if (!r) return;
    if (r.retracted && !(await U.confirm(t('This article is retracted'), t('OpenAlex marks this article as retracted. Anchoring a review on it undermines the review. Use it anyway? The choice will be logged.'), t('Use it anyway'), t('Cancel')))) return;
    if (r.retracted) S.logDecision('Find', 'Retracted article chosen despite warning', id);
    const a = S.st.article; const ref = O.findRef(r);
    if (!U.nz(a.citation) || citeIsAuto(a.citation, a)) { a.citation = ref; markAuto(a, ref); }
    const c = await cand(id);
    if (c) { try { const info = await ART.read(new File([c.bytes], c.name || 'article.pdf', { type: 'application/pdf' })); Object.assign(a, info); } catch (e) { U.toast(e.message, 'error'); } }
    a.title = r.title; a.doi = r.doi;
    if (c && c.how === 'open copy' && C.version_to_start[r.version]) a.version = C.version_to_start[r.version];
    Object.assign(ff, { chosen: id, reason: reason || '', chosen_at: U.now() });
    const alts = sh.filter(x => x.id !== id);
    S.logDecision('Find', 'Focal article chosen from search', `${r.title} (${r.year}) doi:${r.doi}; fit ${r.fit}; ${alts.length} alternative(s)${alts.length ? ': ' + alts.map(x => `${x.title.slice(0, 60)} (doi:${x.doi}, fit ${x.fit})`).join('; ') : ''}${reason ? '; reason: ' + reason : ''}`);
    S.changed('article');
    U.toast(c ? t('Start page filled and the PDF loaded from this device.') : t('Start page filled. Upload the PDF there once you have it through your library.'), 'ok', 8000);
    go('#/start'); if (O.isDoi(O.norm(a.doi))) lookup(O.norm(a.doi), a.cite_style || 'apa', 'auto');
  }

  // ---------------------------------------------------------------- citation from the DOI (your own edits are never overwritten)
  const markAuto = (a, txt) => { a.cite_auto = txt; a.cite_autos = (a.cite_autos || []).filter(x => x !== txt).concat([txt]).slice(-30); };
  const citeIsAuto = (cur, a) => cur === a.cite_auto || (a.cite_autos || []).includes(cur);
  let citeKey = '';
  function applyCitation(cit) { const a = S.st.article; const cur = a.citation || '';
    if (!cur.trim() || citeIsAuto(cur, a)) { a.citation = cit; markAuto(a, cit); delete a.cite_pending; return true; }
    if (cur !== cit) a.cite_pending = cit; return false; }
  async function lookup(d, style, why) {
    const loud = why === 'button'; style = style || 'apa';
    if (!d) return loud && U.toast(t('Enter the DOI first.'), 'warn');
    if (!S.cfg().enabled) return loud && U.toast(t('Internet features are switched off in Settings.'), 'warn');
    citeKey = d + ' ' + style;
    const st = S.st; const f = st.online && st.online.focal;
    let r; const b = loud ? U.busy(t('Looking up the DOI at Crossref...')) : null;
    try { r = (!loud && f && f.doi === d && f.found) ? f : await O.crossref(d); }
    catch (e) { if (b) b.done(); return U.toast(t('Could not reach Crossref: {msg}', { msg: e.message }), loud ? 'error' : 'warn'); }
    if (!r || !r.found) { if (b) b.done(); return U.toast(t('Crossref has no record for doi:{d}. Check it for typos.', { d: d }), 'warn'); }
    st.online = st.online || { checked_at: '', online: false, refs: {}, suggestions: {}, errors: [], mobile: true }; st.online.focal = r; st.online.focal_mobile = true;
    if (!U.nz(st.article.title)) st.article.title = r.meta.title;
    let cit;
    try { cit = await O.citeDoi(d, style, r.meta); }
    catch (e) { const lab = (C.cite_styles.find(x => x.value === style) || {}).label || style;
      U.toast(t('doi.org gave no {s} reference ({msg}); APA built from Crossref is used instead.', { s: lab, msg: e.message }), 'warn', 9000); cit = O.refApa(r.meta); style = 'apa'; citeKey = d + ' apa'; }
    if (b) b.done();
    st.article.cite_style = style;
    const used = applyCitation(cit);
    const lab = (C.cite_styles.find(x => x.value === style) || {}).label || style;
    S.logDecision('Set-up', used ? 'Focal reference filled from the DOI' : 'Reference from the DOI offered (your edited reference kept)', `doi:${d} · style: ${lab}${r.status !== 'ok' ? ' - notice: ' + r.status : ''}`);
    S.changed('article'); if (location.hash.indexOf('#/start') === 0) rerender();
  }
  root.lookupDoi = lookup;

  // ---------------------------------------------------------------- Start
  SCREENS.start = function () {
    const st = S.st; const a = st.article;
    const info = h('div');
    if (!a.text) info.appendChild(W.alert('', 'info', t('Upload the article to begin. ANCHOR reads its text, DOI, abstract and reference list. The article text never leaves this device unless you choose the API mode; the live reference checks send only DOIs and search terms.')));
    else info.appendChild(W.alert('ok', 'check', h('b', a.file || ''), ' · ' + t('{p} pages · {w} words · {r} references found', { p: a.pages || '?', w: I18N.num(a.words || 0), r: (a.references || []).length }),
      a.abstract ? h('details.small', h('summary', t('Abstract found')), h('p', a.abstract)) : null, h('p.small', { style: { margin: '4px 0 0' } }, t('Check the title, DOI and reference below and correct them if needed.'))));
    const upload = h('button.btn.primary.block', { onclick: async () => { const fl = await U.pickFile('.pdf,.docx,.txt,application/pdf'); if (!fl.length) return;
      const b = U.busy(t('Reading the article...'));
      try { const inf = await ART.read(fl[0]);
        if (st.article.text && st.article.text !== inf.text) {   // the anchor itself changed: everything approved rests on the old one
          const flagged = S.PHASE_IDS.filter(j => st.phases[j].status === 'approved'); flagged.forEach(j => { st.phases[j].status = 'needs review'; });
          S.logDecision('Start', 'Anchor article replaced', 'New file: ' + fl[0].name + (flagged.length ? "; phases marked 'needs review': " + flagged.join(', ') : ''));
          if (flagged.length) U.toast(t('The article changed. Phases {p} need review.', { p: flagged.join(', ') }), 'warn', 12000); }
        Object.assign(st.article, inf); st.article.title = inf.title_guess || st.article.title; st.article.doi = inf.doi || st.article.doi; S.changed('article'); b.done();
        if (inf.scanned) U.toast(t('Very little text could be read. The PDF may be scanned; run OCR first or upload a text version.'), 'warn', 12000);
        rerender(); const d = O.norm(inf.doi || ''); if (O.isDoi(d)) lookup(d, st.article.cite_style || 'apa', 'auto'); }
      catch (e) { b.done(); U.toast(e.message, 'error', 10000); } } }, U.icon('upload'), a.text ? t('Replace the article file') : t('Choose the article (PDF, Word or text)'));
    const doiIn = W.text(a.doi, v => { a.doi = v; S.changed('article'); doiTyped(); }, { placeholder: '10.xxxx/...', inputmode: 'url' });
    const doiTyped = U.debounce(() => { const d = O.norm(a.doi); const s = a.cite_style || 'apa'; if (O.isDoi(d) && citeKey !== d + ' ' + s) lookup(d, s, 'auto'); }, 1200);
    const f = st.online && st.online.focal; const d0 = O.norm(a.doi);
    let live = null;
    if (f && f.doi === d0) { if (!f.found) live = W.alert('warn', 'alert', t('Crossref has no record for this DOI.'));
      else if (f.status === 'ok') live = h('p.hint.st-ok', U.icon('check'), ' ', t('Verified at Crossref {d}; no correction or retraction notices.', { d: f.checked_at }));
      else live = W.alert(f.status === 'corrected' ? 'warn' : 'bad', 'alert', h('b', t('This article has a published {n}:', { n: t(O.NOTICE_NAME[f.status]) })), ' ', (f.notices || []).map(n => `${n.label} (${n.date}, doi:${n.doi})`).join('; '), '. ', t('Read the notice before anchoring a review on it.')); }
    const citeArea = W.area(a.citation, v => { a.citation = v; S.changed('article'); }, { rows: 3 });
    const pend = a.cite_pending && a.cite_pending !== a.citation ? W.alert('', 'info', t('Your edited reference was kept. From the DOI:'), ' ', h('em', a.cite_pending), ' ',
      h('button.btn.ghost.sm', { onclick: () => { a.citation = a.cite_pending; markAuto(a, a.cite_pending); delete a.cite_pending; S.logDecision('Set-up', 'Reference replaced with the one from the DOI', O.norm(a.doi)); S.changed('article'); rerender(); } }, t('Use this instead'))) :
      h('p.hint', t('Filled from the DOI in the chosen style. If you edit it, your version is kept.'));
    const card1 = W.card('1 · ' + t('Upload the article this review is anchored on'),
      h('p.hint', t('No article yet?'), ' ', h('a', { href: '#/find' }, t('Find a focal article')), ' ', t('by searching a subject.'), ' ', t('Continuing a review?'), ' ', h('a', { href: '#', onclick: e => { e.preventDefault(); openProject(); } }, t('Open a saved project (.anchor)')), '.'),
      upload, info,
      W.field(t('Title'), W.text(a.title, v => { a.title = v; S.changed('article'); })),
      W.field(t('DOI'), h('div.row', h('div.grow', doiIn), h('button.btn.sm', { onclick: () => lookup(O.norm(a.doi), a.cite_style || 'apa', 'button') }, U.icon('search'), t('Look up online')))), live,
      W.field(t('Citation style'), W.select(C.cite_styles.map(x => ({ value: x.value, label: t(x.label) })), a.cite_style || 'apa', v => { a.cite_style = v; S.changed('article'); const d = O.norm(a.doi); if (O.isDoi(d) && citeKey !== d + ' ' + v) lookup(d, v, 'style'); })),
      W.field(t('Full reference'), citeArea), pend,
      h('label.lab', t('Which version is this file?')), W.radio(['Published version of record', 'Accepted manuscript', 'Working paper', 'Preprint'].map(v => ({ value: v, label: t(v) })), a.version, v => { a.version = v; S.changed('article'); }));
    const card2 = W.card('2 · ' + t('About you'), h('p.hint', t('Name and institution are filled from'), ' ', h('a', { href: '#/prereq' }, t('Before you start')), t(', which also records software, affiliation and data licences.')),
      C.setup.map(q => W.question(q, st.setup[q.id] !== undefined ? st.setup[q.id] : q.id === 'S_name' ? prq().name : q.id === 'S_inst' ? prq().institution : undefined, v => { st.setup[q.id] = v; if (q.id === 'S_name' && !prq().name) prq().name = v; S.changed('setup'); })));
    const card3 = W.card('3 · ' + t('How should drafts be produced? (your decision)'), W.modeChooser(), h('p.hint', t('You can change this at any time under Settings.')));
    const prog = h('ul.ctl', C.phases.map(p => h('li', h('b', p.id), ' ', t(p.name), ' ', W.statusPill(st.phases[p.id].status))));
    const card4 = W.card('4 · ' + t('Progress'), h('p', st.setup_ok ? t('Set-up confirmed.') : t('Set-up not yet confirmed.')), prog,
      h('div.btns.col', h('button.btn.primary', { onclick: confirmSetup }, t('Confirm set-up and open phase A'), U.icon('next', 'flip'))));
    return h('div', card1, card2, card3, card4);
  };
  function confirmSetup() {
    const st = S.st; const a = st.article;
    if (!st.setup.S_name && prq().name) st.setup.S_name = prq().name;
    if (!st.setup.S_inst && prq().institution) st.setup.S_inst = prq().institution;
    const miss = [].concat(!a.text ? [t('Upload the article')] : [], !U.nz(a.citation) ? [t('Enter the full reference of the article')] : [], !a.version ? [t('Say which version of the article you uploaded')] : [],
      C.setup.filter(q => { const v = st.setup[q.id]; return v === undefined || v === null || !String(Array.isArray(v) ? v.join('') : v).trim(); }).map(q => t(q.label)));
    if (miss.length) return U.sheet(t('Before we start'), h('ul', miss.map(m => h('li', m))), [{ label: 'OK', kind: 'primary' }]);
    st.setup_ok = true; if (st.phases.A.status === 'locked') st.phases.A.status = 'open';
    S.logDecision('Set-up', 'Confirmed', 'Mode: ' + S.dev().mode + ' · Version: ' + a.version);
    go('#/phase/A');
  }
})(window);
