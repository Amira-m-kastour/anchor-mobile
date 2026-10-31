/* ANCHOR Mobile - the six phases (A, N, C, H, O, R) with their decision gates (port of the desktop app's phase pages). */
(function (root) {
  'use strict';
  const h = U.h; const C = root.ANCHOR_CONTENT;
  const pendingPrompt = {};   // copy-and-paste mode: a shown prompt counts as AI use only once an answer is pasted

  function contextFor(id) {
    const st = S.st; const i = S.PHASE_IDS.indexOf(id); if (i === 0) return '';
    const txt = S.PHASE_IDS.slice(0, i).map(j => st.phases[j].status === 'approved' ? '## Phase ' + j + ' (approved)\n' + String(st.phases[j].draft || '').slice(0, 8000) : '').filter(Boolean);
    const pr = P.prisma(st);
    if (['N', 'C', 'R'].includes(id) && pr) txt.push('PRISMA counts: ' + Object.keys(pr).filter(k => pr[k] !== undefined && pr[k] !== null).map(k => k + ' = ' + pr[k]).join('; '));
    if (['C', 'H', 'R'].includes(id)) txt.push('## Bibliometric summary\n' + biblioSummary(st.biblio.M, st.biblio.R));
    return txt.join('\n\n');
  }
  function biblioSummary(M, R) {
    if (!M) return '(no bibliometric data imported)';
    const yrs = M.PY.filter(v => v !== null); const out = [`Documents: ${M.n}; years ${Math.min.apply(null, yrs)}-${Math.max.apply(null, yrs)}.`];
    if (BX.has(M, 'SO')) out.push('Top sources: ' + BX.sortTable(M.SO).slice(0, 8).map(x => x[0]).join('; '));
    if (R && R.Authors && R.Authors.length) out.push('Top authors: ' + R.Authors.slice(0, 8).map(x => x[0]).join('; '));
    if (BX.has(M, 'DE')) out.push('Top author keywords: ' + BX.tableTag(M, 'DE').slice(0, 15).map(x => x[0].trim()).join('; '));
    if (R && R.MostCitedPapers && R.MostCitedPapers.length) out.push('Most cited: ' + R.MostCitedPapers.slice(0, 8).map(x => x.Paper).join('; '));
    return out.join('\n');
  }
  root.biblioSummary = biblioSummary;
  function answersFor(p) {
    const st = S.st; const a = { 'Article version': st.article.version, 'Review purpose': st.setup.S_purpose };
    for (const q of p.questions) { const v = st.phases[p.id].answers[q.id]; a[q.label] = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) ? '(not answered)' : v; }
    return a;
  }
  function makePrompt(p, revision) {
    const st = S.st; let pr = AI.buildPrompt(p, st.article.text || '', contextFor(p.id), answersFor(p), S.dev().include_text);
    if (revision) pr += '\n\n=== YOUR PREVIOUS DRAFT ===\n' + st.phases[p.id].draft + '\n\n=== REVISION REQUESTED BY THE RESEARCHER ===\n' + revision + '\nRevise the draft accordingly.';
    return pr;
  }

  SCREENS.phases = () => SCREENS.phase(S.PHASE_IDS.find(id => S.st.phases[id].status !== 'approved') || 'R');
  SCREENS.phase = function (id) {
    const p = S.phase(id) || C.phases[0]; id = p.id;
    const st = S.st; const ph = st.phases[id]; const locked = S.isLocked(id);
    const tabs = h('nav.ptabs', { 'aria-label': t('Phases') }, C.phases.map(q => h('a' + (q.id === id ? '.on' : ''), { href: '#/phase/' + q.id }, h('span.st.' + st.phases[q.id].status.replace(' ', '-')), q.id + ' · ' + t('tab:' + q.id))));
    const head = h('div.phase-head', h('div.letter', id), h('div', h('h1', t(p.name)), h('p.q', t(p.question))));
    let banner;
    if (locked) banner = W.alert('', 'lock', !st.setup_ok ? h('span', t('Confirm the set-up on the Start page first.'), ' ', h('a', { href: '#/start' }, t('Open Start'))) : t('Phase {p} must be approved before this phase opens.', { p: S.PHASE_IDS[S.PHASE_IDS.indexOf(id) - 1] }));
    else if (ph.status === 'approved') banner = W.alert('ok', 'check', t('Approved {d}. Reopen it to make changes.', { d: ph.approved_at || '' }));
    else if (ph.status === 'needs review') banner = W.alert('warn', 'alert', t('An earlier phase was changed after this one was approved. Review and approve again.'));
    else banner = W.alert('', 'info', t('Answer the questions, produce the draft, tick the checks, then decide at the gate.'));
    const needs = W.card(t('What this phase needs'), h('div.needs', h('div', h('h4', t('Input')), h('p', t(p.input))), h('div', h('h4', t('Actions')), h('p', t(p.actions))), h('div', h('h4', t('Output')), h('p', t(p.output)))));

    // questions for you
    const qCard = W.card(t('Questions for you'), h('p.hint', t('Your answers steer the draft and are required before the gate opens.')),
      p.questions.map(q => W.question(q, ph.answers[q.id], v => { ph.answers[q.id] = v; S.changed('phases'); })));

    // draft
    const m = S.dev().mode;
    const modeInfo = { prompt: t("Copy-and-paste mode: 'Draft this phase' shows a prompt. Paste it into claude.ai, then paste Claude's answer below."),
      api: t("API mode: 'Draft this phase' asks {m} and puts the draft below for you to edit.", { m: S.dev().api_model }), manual: t('Manual mode: write this phase yourself in the box below.') }[m] || '';
    const aiqBox = h('div');
    const drawAiq = () => { aiqBox.innerHTML = ''; if (!ph.ai_q.length) return;
      aiqBox.appendChild(h('div', h('h4', t('Questions raised in the draft')), ph.ai_q.map((q, k) => h('div', h('label.lab', q), W.area(ph.ai_a[k] || '', v => { ph.ai_a[k] = v; S.changed('phases'); }, { rows: 2 }))))); };
    drawAiq();
    const draft = W.area(ph.draft, v => { ph.draft = v; const q = AI.extractQuestions(v); const changed = JSON.stringify(q) !== JSON.stringify(ph.ai_q); ph.ai_q = q; if (changed) { ph.ai_a = q.map((x, k) => ph.ai_a[k] || ''); drawAiq(); }
      const pp = pendingPrompt[id]; if (pp && v.trim().length >= 50) { S.logPrompt(id, pp, 'prompt'); delete pendingPrompt[id]; } S.changed('phases'); },
      { cls: 'draft', rows: 16, placeholder: t("The draft appears here. Edit it freely: this text is what goes into your report. In copy-and-paste mode, paste Claude's answer here.") });
    if (locked) draft.readOnly = true;
    const draftCard = W.card(null, h('div.card-head', h('h3', t('Draft of this phase')), h('div.row',
        h('button.btn.primary.sm', { onclick: () => runDraft(p), disabled: locked }, U.icon('wand'), t('Draft this phase')),
        h('button.btn.sm', { onclick: () => showPrompt(p, makePrompt(p)), disabled: locked }, U.icon('clipboard'), t('Show prompt')))),
      h('p.hint', modeInfo), draft, aiqBox);

    // quality controls and the gate
    const ctl = W.card(t('Quality controls'), h('ul.ctl', p.controls.map(k => h('li', h('b', k), ' ', t(C.controls[k])))));
    const gate = h('section.card.gate', h('h3', t('Gate {id}', { id: id })),
      W.checks(p.checks.map(c => ({ value: c, label: t(c) })), ph.checks, v => { ph.checks = v; S.changed('phases'); }),
      W.field(t('Notes and open items'), W.area(ph.notes, v => { ph.notes = v; S.changed('phases'); }, { rows: 3 })),
      h('div.btns.col', h('button.btn.ok', { onclick: () => approve(p), disabled: locked }, U.icon('check'), t('Approve and open the next phase')),
        h('button.btn.warn', { onclick: () => revise(p), disabled: locked }, U.icon('rotate'), t('Ask for a revision')),
        h('button.btn.sm', { onclick: () => reopen(p) }, U.icon('unlock'), t('Reopen this phase'))));

    return h('div', tabs, head, banner, needs, qCard, draftCard, extraFor(id), lessonsCard(id), ctl, gate);
  };

  function showPrompt(p, pr) {
    pendingPrompt[p.id] = pr;
    const ta = h('textarea.prompt-box.mono', { readonly: true, rows: 14 }); ta.value = pr;
    U.sheet(t('Prompt for phase {id}', { id: p.id }), h('div',
      h('ol.small', h('li', t('Copy the prompt.')), h('li', t('Open claude.ai') + (S.dev().include_text ? '' : t(' and attach the article PDF')) + '.'), h('li', t('Paste and send.')), h('li', t("Paste Claude's full answer into the draft box."))),
      h('p.hint', t('The prompt is added to your AI-use disclosure only when you paste an answer into the draft box. If you do not use it, nothing is recorded.')), ta),
      [{ label: t('Open claude.ai'), onclick: () => { U.open('https://claude.ai/new'); return false; } }, { label: t('Copy prompt'), kind: 'primary', onclick: () => { U.copy(pr, ta).then(ok => U.toast(ok ? t('Prompt copied. Paste it into claude.ai.') : t('Select the text and copy it.'), ok ? 'ok' : 'warn')); return false; } }, { label: t('Close') }], { wide: true, nofocus: true });
  }
  async function runDraft(p, revision) {
    if (S.isLocked(p.id)) return U.toast(t('This phase is still locked.'), 'warn');
    const m = S.dev().mode; const pr = makePrompt(p, revision);
    if (m === 'manual') return U.toast(t('Manual mode: write the phase in the draft box. Switch mode under Settings to get AI drafts.'));
    if (m === 'prompt') return showPrompt(p, pr);
    const ph = S.st.phases[p.id];
    if (!revision && ph.draft.trim() && !(await U.confirm(t('Replace the current draft?'), t('The draft box already has text. A new draft will replace it.'), t('Replace with a new draft'), t('Keep my text')))) return;
    S.logPrompt(p.id, pr, 'api');
    const b = U.busy(t('Drafting phase {id}...', { id: p.id }));
    try { const out = await AI.draft('api', pr); ph.draft = out; ph.ai_q = AI.extractQuestions(out); ph.ai_a = ph.ai_q.map(() => ''); S.changed('phases'); b.done(); rerender();
      U.toast(t('Draft ready. Read it, edit it, answer any questions it raises, then decide at the gate.'), 'ok', 8000); }
    catch (e) { b.done(); U.toast(e.message, 'error', 15000); }
  }
  function approve(p) {
    const st = S.st; const ph = st.phases[p.id]; const id = p.id;
    if (S.isLocked(id)) return U.toast(t('This phase is still locked.'), 'warn');
    const miss = [].concat(!ph.draft.trim() ? [t('The draft is empty')] : [], p.checks.filter(c => !ph.checks.includes(c)).map(c => t('Tick:') + ' ' + t(c)),
      p.questions.filter(q => { const v = ph.answers[q.id]; return v === undefined || v === null || !String(Array.isArray(v) ? v.join('') : v).trim(); }).map(q => t('Answer:') + ' ' + t(q.label)),
      ph.ai_q.map((q, k) => !String(ph.ai_a[k] || '').trim() ? t("Answer the draft's question:") + ' ' + q : null).filter(Boolean),
      id === 'N' && !st.biblio.M && ph.answers.N_fallback !== C.phases.find(x => x.id === 'N').questions[5].choices[1] ? [t('Import database exports under Bibliometrics > Data, or choose to continue with snowballing')] : []);
    if (miss.length) return U.sheet(t('Gate {id} is not ready', { id: id }), h('ul', miss.map(x => h('li', x))), [{ label: 'OK', kind: 'primary' }]);
    U.sheet(t('Approve phase {id}?', { id: id }), h('p', t('You confirm that you have read and checked this phase and take responsibility for it.')),
      [{ label: t('Not yet') }, { label: t('Yes, approve'), kind: 'ok', onclick: () => {
        ph.status = 'approved'; ph.approved_at = U.now(); const i = S.PHASE_IDS.indexOf(id);
        if (i < S.PHASE_IDS.length - 1 && st.phases[S.PHASE_IDS[i + 1]].status === 'locked') st.phases[S.PHASE_IDS[i + 1]].status = 'open';
        S.logDecision(id, 'Approved', ph.notes);
        if (i < S.PHASE_IDS.length - 1) { U.toast(t('Phase {a} approved. Phase {b} is open.', { a: id, b: S.PHASE_IDS[i + 1] }), 'ok'); go('#/phase/' + S.PHASE_IDS[i + 1]); }
        else { U.toast(t('All six gates passed. Export your report.'), 'ok'); go('#/report'); } } }]);
  }
  function revise(p) {
    let note = ''; const m = S.dev().mode;
    U.sheet(t('Revision of phase {id}', { id: p.id }), h('div', W.field(t('What should change?'), W.area('', v => { note = v; }, { rows: 4 })),
      h('p.hint', m === 'api' ? t('A new draft will be requested with your instructions.') : m === 'prompt' ? t('A revision prompt will be shown for you to paste into Claude.') : t('Your note is logged; edit the draft yourself.'))),
      [{ label: t('Cancel') }, { label: t('Request revision'), kind: 'primary', onclick: () => { const ph = S.st.phases[p.id]; if (ph.status === 'approved') ph.status = 'open';
        S.logDecision(p.id, 'Revision requested', note); rerender(); setTimeout(() => runDraft(p, note), 250); } }]);
  }
  function reopen(p) {
    const st = S.st; const ph = st.phases[p.id];
    if (ph.status !== 'approved') return U.toast(t('Only approved phases can be reopened.'));
    ph.status = 'open'; S.PHASE_IDS.slice(S.PHASE_IDS.indexOf(p.id) + 1).forEach(j => { if (st.phases[j].status === 'approved') st.phases[j].status = 'needs review'; });
    S.logDecision(p.id, 'Reopened', "Later approved phases marked 'needs review'"); rerender();
  }

  // ---------- lessons learned and what's in it for me
  function lessonsCard(id) {
    const st = S.st; const L = C.lessons[id]; const ph = st.phases[id]; if (!L) return null;
    const refs = L.refs.map(k => O.refLive(k, st));
    const acc = ph.accepted || [];
    let sg = st.online && st.online.suggestions && st.online.suggestions[id]; if (sg) sg = sg.filter(s => s.doi && !acc.some(a => a.doi === s.doi) && !refs.some(r => r.doi === s.doi));
    const refLi = r => h('li', O.refApa(r), ' ', h('a', { href: 'https://doi.org/' + r.doi, target: '_blank', rel: 'noopener', onclick: e => { e.preventDefault(); U.open('https://doi.org/' + r.doi); } }, U.icon('external')),
      h('br'), h('span.small.' + (r.status === 'ok' ? 'st-ok' : ['retracted', 'concern'].includes(r.status) ? 'st-bad' : r.status === 'corrected' ? 'st-warn' : 'muted'), O.statusLabel(r)));
    return h('section.card.lessons', h('div.card-head', h('h3', U.icon('grad'), ' ', t("Lessons learned & what's in it for me")), W.onlinePill()),
      h('h4', t('Lessons learned')), h('ul.small', L.lessons.map(x => h('li', t(x)))),
      h('h4', t("What's in it for me")), h('p.small', t(L.wiifm)),
      h('h4', t('Key references')), h('ol.refs', refs.map(refLi)),
      acc.length ? h('div', h('h4', t('References you added')), h('ol.refs', acc.map(r => h('li', O.refApa(r), ' ', h('button.btn.ghost.sm', { onclick: () => { ph.accepted = acc.filter(x => x.doi !== r.doi); S.logDecision(id, 'Reference removed', 'doi:' + r.doi); rerender(); } }, t('remove')))))) : null,
      sg && sg.length ? h('details.small', h('summary', U.icon('globe'), ' ', t('Newer reading, live from OpenAlex ({n}, most cited first)', { n: sg.length })),
        h('ol.refs', sg.map(s => h('li', O.refApa(s), ' ', t('Cited {n} times.', { n: s.cited_by }), ' ', h('button.btn.ghost.sm', { onclick: () => { ph.accepted = acc.concat([{ au: s.au, year: s.year, title: s.title, journal: s.journal, vol: s.vol, iss: s.iss, pages: s.pages, doi: s.doi }]);
          S.logDecision(id, 'Reference added (live suggestion)', `${s.au} (${s.year}). ${s.title}. doi:${s.doi}`); U.toast(t("Added to this stage's references and to references.bib."), 'ok'); rerender(); } }, U.icon('plus'), t('add to my references'))))),
        h('p.hint', t('Suggestions are not checked by a person. Read an article before you cite it.')))
        : st.online && st.online.online ? h('p.hint', t('No newer reading found online for this stage.')) : h('p.hint', t('Live suggestions appear when the app is online. References as of {d}.', { d: C.lessons_asof })),
      W.field(t('My lessons learned in this stage'), W.area(ph.my_lessons, v => { ph.my_lessons = v; S.changed('phases'); }, { rows: 3 })),
      W.field(t("What's in it for me"), W.area(ph.my_wiifm, v => { ph.my_wiifm = v; S.changed('phases'); }, { rows: 3 })),
      h('p.hint', t('Both boxes are optional and appear in your reports.')));
  }

  // ---------- phase-specific cards
  function extraFor(id) {
    if (id === 'A') return focalCard();
    if (id === 'N') return prismaCard();
    if (id === 'C') return h('div', itemsCard('C'), openCopiesCard());
    if (id === 'H') return h('div', trendCard(), itemsCard('H'));
    if (id === 'O') return W.card(t('Data & methods'), W.alert('', 'info', t('The econometric analyses of phase O (panel regressions, event studies, meta-analysis, rating disagreement) run in ANCHOR Studio on a computer. Open this project there to run them; the results come back into this project and its report.')),
      h('p.small', t('On the phone you can write and approve phase O: the questions, the draft and the gate work as usual.')), itemsCard('O'));
    return null;
  }
  let focalOA = null;
  function focalCard() {
    const box = h('div');
    const draw = () => { box.innerHTML = ''; const f = focalOA; if (!f) { box.appendChild(h('p.hint', t('Not fetched yet.'))); return; }
      box.appendChild(h('p.small', h('b', t('{r} references · cited by {c} works · checked {d}.', { r: f.n_refs, c: I18N.num(f.n_citing), d: f.retrieved })), ' ',
        f.open ? h('span', t('Open copy:'), ' ', h('a', { href: f.open.url, onclick: e => { e.preventDefault(); U.open(f.open.url); } }, f.open.host || t('link')), ` (${f.open.version}${f.open.license ? ', ' + f.open.license : ''}).`) : t('No open copy found: read it through your library.')));
      if (f.citing.length) box.appendChild(h('details.small', h('summary', t('Citing works (most cited first)')), W.table(['Title', 'Year', 'Citations', 'Journal'], f.citing.map(r => [r.title, r.year, r.cited_by, r.journal]), { max: 50 })));
      if (f.refs.length) box.appendChild(h('details.small', h('summary', t('References')), W.table(['Title', 'Year', 'Citations', 'Journal'], f.refs.map(r => [r.title, r.year, r.cited_by, r.journal]), { max: 100 }))); };
    draw();
    return W.card(t('Focal article in OpenAlex: references, citing works, open copy'), h('p.hint', t('Free, live (OpenAlex, CC0 metadata). Only the DOI is sent. Open copies are listed as links; the app never stores the article PDF in files for sharing.')),
      h('div.btns', h('button.btn.sm.primary', { onclick: async () => { if (!S.cfg().enabled) return U.toast(t('Switch on the internet features in Settings first.'), 'warn'); const b = U.busy(t('Fetching from OpenAlex...'));
          try { focalOA = await focalLinks(S.st.article.doi); S.logDecision('A', 'Focal article in OpenAlex', `${focalOA.n_refs} references, cited by ${focalOA.n_citing}`); draw(); } catch (e) { U.toast(e.message, 'error'); } finally { b.done(); } } }, U.icon('download'), t('Fetch')),
        h('button.btn.sm', { onclick: () => { root.BIB_PRESET = { source: 'openalex', mode: 'both' }; go('#/biblio'); } }, t('Use references + citing works as the phase N corpus'))), box);
  }
  async function focalLinks(doi) {
    const fw = await O.focalWork(doi); const id = O.oaShort(fw.id); const sel = 'id,doi,display_name,publication_year,cited_by_count,primary_location,best_oa_location,open_access';
    const brief = w => ({ title: w.display_name || w.title || '', year: w.publication_year, cited_by: w.cited_by_count || 0, journal: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '', doi: O.norm(w.doi || '') });
    const refs = await O.oaWorks('cited_by:' + id, null, 200); let citing = { works: [], found: null };
    try { const x = await O.http('https://api.openalex.org/works', { filter: 'cites:' + id, sort: 'cited_by_count:desc', per_page: 200, select: sel }); citing = { works: x.results || [], found: (x.meta && x.meta.count) || 0 }; } catch (e) { /* none */ }
    const oa = fw.best_oa_location;
    return { n_refs: (fw.referenced_works || []).length, refs: refs.works.map(brief), citing: citing.works.map(brief), n_citing: citing.found, retrieved: U.now(),
      open: oa ? { url: oa.pdf_url || oa.landing_page_url || '', version: oa.version || '', license: oa.license || '', host: (oa.source && oa.source.display_name) || '' } : null };
  }
  function prismaCard() {
    const st = S.st; const pr = P.prisma(st); const m = st.prisma_manual;
    const num = k => W.text(m[k] === undefined || m[k] === null || isNaN(m[k]) ? '' : m[k], v => { const x = v.trim() === '' ? null : Number(v); m[k] = x === null || isNaN(x) ? null : x; st.prisma_changed = true; S.changed('prisma'); }, { type: 'number', inputmode: 'numeric' });
    return W.card(t('PRISMA 2020 flow'), h('p.hint', t("Identification counts come from the data you import under Bibliometrics > Data. Enter the screening counts as you screen; leave empty to show 'pending'.")),
      pr ? prismaBoxes(pr) : W.alert('', 'info', t("No database exports imported yet. Counts are 'pending'.")),
      W.field(t('Excluded at title/abstract screening'), num('excluded_screen')), W.field(t('Full texts assessed'), num('assessed')),
      W.field(t('Full texts excluded (reasons in notes)'), num('excluded_full')), W.field(t('Studies included'), num('included')));
  }
  function prismaBoxes(pr) { const v = x => x === undefined || x === null || isNaN(x) ? t('pending') : I18N.num(x);
    return h('div.prisma', [['Records identified from databases', 'identified'], ['Duplicates removed', 'duplicates'], ['Retracted records removed (retraction check)', 'retracted'], ['Records removed by filters (year, type, language)', 'filtered'], ['Records screened (title/abstract)', 'screened'],
      ['Records excluded at screening', 'excluded_screen'], ['Reports assessed for eligibility', 'assessed'], ['Reports excluded (with reasons)', 'excluded_full'], ['Studies included in the review', 'included']].filter(x => x[1] !== 'retracted' || pr.retracted > 0).map(x => h('div', t(x[0]), ': ', h('b', 'n = ' + v(pr[x[1]]))))); }
  root.prismaBoxes = prismaBoxes;
  function itemsCard(phase) {
    const its = S.st.report_items.map((it, k) => [it, k]).filter(x => (x[0].phase || 'C') === phase);
    return W.card(phase === 'C' ? t('Bibliometric figures chosen for the report') : phase === 'H' ? t('Research-front trend in the report') : t('Analysis results in the report'),
      its.length ? h('ol.small', its.map(([it, k]) => h('li', it.label, it.from_desktop ? h('span.muted', ' (' + t('from ANCHOR Studio') + ')') : null, ' ', h('button.btn.ghost.sm', { onclick: () => { S.st.report_items.splice(k, 1); S.changed('report_items'); rerender(); } }, t('remove'))))) :
        h('p.hint', phase === 'C' ? t("None yet. Run analyses under Bibliometrics and press 'Add to report'.") : t('None yet.')),
      phase === 'C' ? h('a.btn.sm', { href: '#/biblio' }, U.icon('chart'), t('Open the Bibliometrics analyses')) : null);
  }
  let copies = null;
  function openCopiesCard() {
    const box = h('div'); if (copies) box.appendChild(W.table(['Title', 'Year', 'Citations', 'Open copy'], copies.map(r => [r.title, r.year, r.cited_by, r.open_copy || t('no open copy (use the library)')]), { max: 300 }));
    return W.card(t('Open copies of the records in use (OpenAlex)'), h('p.hint', t('Finds legal open-access copies for screening (up to 300 most-cited records with a DOI). Links only; paywalled papers: use your library.')),
      h('button.btn.sm', { onclick: async () => { const M = S.st.biblio.M; if (!M) return U.toast(t('Import or fetch records under Bibliometrics > Data first.'), 'warn'); if (!S.cfg().enabled) return U.toast(t('Switch on the internet features in Settings first.'), 'warn');
        const idx = Array.from({ length: M.n }, (_, i) => i).sort((a, b) => (M.TC[b] || 0) - (M.TC[a] || 0)); const dois = Array.from(new Set(idx.map(i => O.norm(M.DI[i] || '')).filter(d => /^10\./.test(d) && !/[|,]/.test(d)))).slice(0, 300);
        const b = U.busy(t('Looking for open copies...')); try { const out = [];
          for (let i = 0; i < dois.length; i += 50) { const x = await O.http('https://api.openalex.org/works', { filter: 'doi:' + dois.slice(i, i + 50).join('|'), per_page: 100, select: 'id,doi,display_name,publication_year,cited_by_count,best_oa_location,open_access' });
            (x.results || []).forEach(w => out.push({ title: w.display_name || '', year: w.publication_year, cited_by: w.cited_by_count || 0, open_copy: (w.best_oa_location && (w.best_oa_location.pdf_url || w.best_oa_location.landing_page_url)) || (w.open_access && w.open_access.oa_url) || '' })); }
          copies = out; rerender(); } catch (e) { U.toast(e.message, 'error'); } finally { b.done(); } } }, U.icon('search'), t('Find open copies')), box);
  }
  let trend = null; let terms = 'ESG rating disagreement'; let tFrom = 2000; let tTo = new Date().getFullYear();
  function trendCard() {
    const box = h('div'); if (trend) box.appendChild(CH.render({ type: 'bar', x: trend.map(d => d.year), y: trend.map(d => d.papers), xlab: t('Publication year'), ylab: t('Papers (OpenAlex)'), title: `${t('Research front:')} "${terms}"` }));
    return W.card(t('Research-front trend (OpenAlex)'),
      W.field(t('Construct terms'), W.text(terms, v => { terms = v; })),
      h('div.row', h('div.grow', W.field(t('From'), W.text(tFrom, v => { tFrom = v; }, { type: 'number' }))), h('div.grow', W.field(t('To'), W.text(tTo, v => { tTo = v; }, { type: 'number' })))),
      h('div.btns', h('button.btn.sm.primary', { onclick: async () => { if (!S.cfg().enabled) return U.toast(t('Switch on the internet features in Settings first.'), 'warn'); if (!terms.trim()) return U.toast(t('Write the construct terms, for example: ESG rating disagreement.'), 'warn');
          const b = U.busy(t('Counting papers per year...')); try { const x = await O.http('https://api.openalex.org/works', { search: terms.trim(), filter: `publication_year:${parseInt(tFrom, 10)}-${parseInt(tTo, 10)},is_paratext:false`, group_by: 'publication_year' });
            const g = (x && x.group_by) || []; if (!g.length) throw new Error(t('OpenAlex found no papers for these terms.'));
            trend = g.map(k => ({ year: parseInt(k.key, 10), papers: Number(k.count || 0) })).sort((a, b) => a.year - b.year); rerender(); } catch (e) { U.toast(e.message, 'error'); } finally { b.done(); } } }, U.icon('chart'), t('Show trend')),
        h('button.btn.sm', { onclick: async () => { if (!trend) return U.toast(t('Show the trend first.'), 'warn');
          const spec = { type: 'bar', x: trend.map(d => d.year), y: trend.map(d => d.papers), xlab: 'Publication year', ylab: 'Papers (OpenAlex)', title: `Research front: "${terms}"` };
          await root.addReportItem(`Research-front trend: papers per year on "${terms}" (OpenAlex, ${U.today()})`, spec, { cols: ['year', 'papers'], rows: trend.map(d => [d.year, d.papers]) }, 'H', ''); rerender(); } }, U.icon('plus'), t('Add to report (phase H)'))),
      box, h('p.hint', t('Counts of papers matching the terms per year in OpenAlex; use them to argue whether the question is current, not as evidence for the hypotheses.')));
  }
})(window);
