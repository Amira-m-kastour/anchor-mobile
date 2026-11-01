/* ANCHOR Mobile - the Proposal / thesis tab (screen). The model and the exports are in proposal.js. */
(function (root) {
  'use strict';
  const { S, U, W, PR } = root; const h = U.h; const t = root.t;
  const LANGS = [{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }, { value: 'ar', label: 'العربية' }];
  const key = sid => 'P:' + sid;
  const changed = () => { S.st.proposal_changed = true; S.changed('proposal'); };
  let checksBox = null;
  const refreshChecks = () => { if (checksBox) { const n = checksCard(); checksBox.replaceWith(n); checksBox = n; } };

  SCREENS.proposal = function () {
    const st = S.st; const pr = st.proposal;
    if (!pr) return startCard();
    checksBox = checksCard();
    return h('div', docCard(pr), attCard(pr), h('div.sect', h('h2', t('Outline'))), pr.sections.map((s, k) => sectionCard(pr, s, k)), addCard(pr), checksBox, exportCard());
  };

  function startCard() {
    let preset = 'general', lang = (root.I18N && root.I18N.lang) || 'en';
    if (!['en', 'de', 'ar'].includes(lang)) lang = 'en';
    return W.card(t('Start a research proposal'), h('p', t('The proposal is built from your approved phases, your own text, a timeline, figures and attachments, and exported to Word, HTML (to print as PDF) and LaTeX. A thesis follows in a later version.')),
      W.field(t('Outline'), W.select(Object.keys(PR.PRESETS).map(k => ({ value: k, label: t(PR.PRESETS[k].name) })), preset, v => { preset = v; })),
      W.field(t('Language of the proposal'), W.select(LANGS, lang, v => { lang = v; })),
      h('div.btns', h('button.btn.primary', { onclick: () => { S.st.proposal = PR.create(preset, lang, S.st); changed();
        S.logDecision('Proposal', 'Proposal outline created', PR.PRESETS[preset].name + '; language ' + lang); rerender(); } }, U.icon('list'), t('Create the outline'))));
  }

  function docCard(pr) {
    const f = (label, k, o) => W.field(t(label), W.text(pr[k], v => { pr[k] = v; changed(); refreshChecks(); }, o));
    return W.card(t('Document'), f('Title', 'title'), f('Subtitle (optional)', 'subtitle'), f('Submitted by', 'author'), f('Programme', 'programme'), f('Supervisor', 'supervisor'), f('Place', 'place'),
      W.field(t('Language of the proposal'), W.select(LANGS, pr.lang, v => { pr.lang = v; changed(); })),
      W.field(t('Citation style of the references'), W.select([{ value: 'apa', label: 'APA 7' }, { value: 'harvard', label: 'Harvard' }], pr.cite_style, v => { pr.cite_style = v; changed(); })),
      W.switch(t('Table of contents'), pr.toc, v => { pr.toc = v; changed(); }),
      W.field(t('Word limit (optional)'), W.text(pr.word_limit === null ? '' : pr.word_limit, v => { pr.word_limit = v.trim() === '' || isNaN(Number(v)) ? null : Number(v); changed(); refreshChecks(); }, { type: 'number', inputmode: 'numeric' })),
      pr.page_limit ? h('p.hint', t("This outline's guide allows at most {n} pages.", { n: pr.page_limit })) : null,
      W.field(t('Your Word template (.docx or .dotx)'), pr.template ? h('div.row', U.icon('doc'), h('span', pr.template.name), h('button.btn.ghost.sm', { onclick: () => { pr.template = null; changed(); S.logDecision('Proposal', 'Word template removed', ''); rerender(); } }, t('remove')))
        : h('button.btn.sm', { onclick: addTemplate }, U.icon('upload'), t('Choose a template')), pr.template ? null : t("Without a template the preset's layout is used: 12 pt, line spacing 1.5, margins 2.5 cm.")),
      h('div.btns', h('button.btn.ghost.sm.danger', { onclick: resetProposal }, t('Start again with a new outline'))));
  }
  async function addTemplate() {
    const fs = await U.pickFile('.docx,.dotx'); if (!fs.length) return; const f = fs[0];
    if (f.size > PR.MAX) return U.toast(t('The template is larger than 20 MB.'), 'error');
    const raw = new Uint8Array(await U.readFile(f));
    try { const z = await root.JSZip.loadAsync(raw); if (!z.file('word/document.xml') || !z.file('word/styles.xml')) throw new Error('no document'); }
    catch (e) { return U.toast(t('This file could not be read as a Word template.'), 'error'); }
    S.st.proposal.template = { name: f.name, raw: raw }; changed(); S.logDecision('Proposal', 'Word template added', f.name); rerender();
  }
  async function resetProposal() {
    if (!(await U.confirm(t('Start again?'), t('The outline, your text in it, the timeline and the attachments are removed. The phases are not touched; the versions of your text stay in the project.'), t('Start again'), t('Keep the proposal')))) return;
    S.st.proposal.sections.forEach(s => S.snap(key(s.id), 'your text before starting again', s.text));
    S.st.proposal = null; changed(); S.logDecision('Proposal', 'Proposal removed to start again', ''); rerender();
  }

  // ---------- attachments (decision 7: inside the project up to 20 MB; the phone cannot link to files outside the app)
  function attCard(pr) {
    let role = 'figure', caption = '';
    const att = pr.attachments || [];
    return W.card(t('Figures and attachments'), h('p.hint', t('Figures (PNG or JPEG) can be placed in sections; appendix files are listed in the appendix; private files (ethics letters, data agreements, feedback) stay in the project and are never exported.')),
      W.select([{ value: 'figure', label: t('Figure for a section') }, { value: 'appendix', label: t('Appendix file') }, { value: 'private', label: t('Private (never exported)') }], role, v => { role = v; }),
      W.text('', v => { caption = v; }, { placeholder: t('Caption or short description') }),
      h('div.btns', h('button.btn.sm', { onclick: async () => {
        const fs = await U.pickFile(role === 'figure' ? 'image/png,image/jpeg' : '*/*', true); if (!fs.length) return;
        for (const f of fs) {
          if (f.size > PR.MAX) { U.toast(t('{f} is larger than 20 MB. Keep it on your computer and add it there.', { f: f.name }), 'warn', 9000); continue; }
          if (role === 'figure' && !/\.(png|jpe?g)$/i.test(f.name)) { U.toast(t('{f}: figures must be PNG or JPEG.', { f: f.name }), 'warn'); continue; }
          pr.attachments.push({ id: 'att' + Date.now() + U.uid(), name: f.name, role: role, caption: caption, raw: new Uint8Array(await U.readFile(f)), path: '', size: f.size, added: U.now() });
          S.logDecision('Proposal', 'Attachment added', `${f.name} (${role})`); }
        changed(); rerender(); } }, U.icon('plus'), t('Add files...'))),
      att.length ? h('ul.small', att.map((a, i) => h('li', h('b', a.name), ` (${t(a.role)}${a.path ? ', link' : a.size ? ', ' + (a.size / 1048576).toFixed(1) + ' MB' : ''})`, a.caption ? h('span.muted', ' – ' + a.caption) : null, ' ',
        h('button.btn.ghost.sm', { onclick: () => { S.logDecision('Proposal', 'Attachment removed', a.name); pr.attachments.splice(i, 1); pr.sections.forEach(s => { s.figs = (s.figs || []).filter(x => x !== a.id); }); changed(); rerender(); } }, t('remove'))))) : null);
  }

  // ---------- the outline
  function figChoices(pr) {
    const its = (S.st.report_items || []).filter(i => i.png); const figs = (pr.attachments || []).filter(a => a.role === 'figure' && a.raw);
    return its.map(i => ({ value: 'item:' + i.label, label: t('Report figure:') + ' ' + i.label })).concat(figs.map(a => ({ value: a.id, label: t('Your figure:') + ' ' + (a.caption || a.name) })));
  }
  function sectionCard(pr, s, k) {
    const st = S.st; const num = s.kind === 'appendix' ? '' : pr.sections.slice(0, k + 1).filter(x => x.kind !== 'appendix').length;
    const move = d => { const j = k + d; if (j < 0 || j >= pr.sections.length) return; [pr.sections[k], pr.sections[j]] = [pr.sections[j], pr.sections[k]]; changed(); rerender(); };
    const stale = PR.stale(s, st);
    const kids = [h('div.card-head', h('b', String(num)), W.text(s.title, v => { s.title = v; changed(); }, { label: t('Title') }), h('span.muted.small', s.kind),
      h('button.icon-btn', { 'aria-label': t('Move up'), onclick: () => move(-1) }, U.icon('up')), h('button.icon-btn', { 'aria-label': t('Move down'), onclick: () => move(1) }, U.icon('down')),
      h('button.icon-btn', { 'aria-label': t('Remove this section'), onclick: () => removeSection(pr, k) }, U.icon('trash')))];
    if (!['timeline', 'appendix'].includes(s.kind)) {
      kids.push(W.field(t('Use the approved text of'), W.checks(PR.PHASES.map(j => ({ value: j, label: j })), s.links, v => { const add = v.filter(j => !s.links.includes(j));
        s.links = PR.PHASES.filter(j => v.includes(j)); add.forEach(j => { s.link_text[j] = PR.phaseText(st, j); }); Object.keys(s.link_text).forEach(j => { if (!s.links.includes(j)) delete s.link_text[j]; }); changed(); rerender(); })));
      if (s.links.length) kids.push(h('p.small', s.links.map(j => { const a = PR.phaseAI(st, j); const stj = st.phases[j].status;
        return h('span.linkinfo', h('b', j), ': ', W.statusPill(stj), a.ai ? h('span.badge.ai', t(a.unchanged ? 'AI-drafted' : 'AI-drafted, edited')) : null, ' · ', t('{n} words', { n: PR.countWords(PR.phaseText(st, j)) }), ' '); })));
      if (stale.length) kids.push(W.alert('warn', 'alert', t('Phase {p} changed since you linked it. Read the new text, then accept it.', { p: stale.join(', ') }), ' ',
        h('button.btn.sm', { onclick: () => { PR.linkNow(s, st); changed(); S.logDecision('Proposal', 'Changed phase text accepted', `${s.title}: phase ${stale.join(', ')}`); rerender(); } }, t('Accept the current text'))));
      if (s.links.length) kids.push(h('details.small', h('summary', t('Show the linked text')), h('pre.vtext', s.links.map(j => PR.phaseText(st, j)).join('\n\n'))));
    }
    if (s.kind === 'timeline') kids.push(W.field(t('Milestones: one per line, as: name; start date; end date'), W.area(pr.milestones.map(m => [m.milestone, m.start, m.end].join('; ')).join('\n'), v => {
      pr.milestones = v.split('\n').map(x => x.trim()).filter(Boolean).map(r => { const x = r.split(';').map(y => y.trim()); return { milestone: x[0] || '', start: x[1] || '', end: x[2] || '' }; }); changed(); refreshChecks(); },
      { rows: 4, placeholder: 'Exposé to supervisor; 2026-11-15; 2026-11-15' })));
    const ta = W.area(s.text, v => { s.text = v; changed(); refreshChecks(); }, { rows: ['timeline', 'appendix'].includes(s.kind) ? 3 : 7, placeholder: t('Markdown works: ## subheading, - bullet, **bold**, | tables |. Cite as (Author, 2021) or Author (2021).') });
    ta.addEventListener('change', () => S.snap(key(s.id), 'your edits', s.text));   // a version each time you leave the box
    kids.push(W.field(t(s.kind === 'appendix' ? 'Text of the appendix (optional)' : s.links.length ? 'Your own text after the linked text' : 'Your text'), ta));
    const fc = figChoices(pr);
    if (!['timeline', 'appendix'].includes(s.kind) && fc.length) kids.push(W.field(t('Figures in this section'), W.checks(fc, s.figs || [], v => { s.figs = v; changed(); })));
    const v = (st.draft_versions || []).map((x, i) => [x, i]).filter(x => x[0].phase === key(s.id));
    if (v.length) kids.push(h('details.versions', h('summary', U.icon('clock'), ' ', t('Versions of this text ({n})', { n: v.length })),
      h('ul.vlist', v.slice().reverse().map(([x, i]) => h('li', h('div', h('b', x.time), ' · ', t(x.source), ' · ', t('{n} words', { n: PR.countWords(x.text) })),
        h('button.btn.ghost.sm', { onclick: () => { S.snap(key(s.id), 'your text before a restore', s.text); s.text = x.text; S.snap(key(s.id), 'restored version of ' + x.time, x.text);
          S.logDecision('Proposal', 'Earlier version restored', `${s.title} - ${x.time}`); changed(); rerender(); } }, t('restore')))))));
    return h('section.card.prop-sec', ...kids);
  }
  async function removeSection(pr, k) {
    const s = pr.sections[k]; if (!(await U.confirm(t('Remove this section?'), s.title + ' – ' + t('Its own text stays in the versions list.'), t('Remove'), t('Keep it')))) return;
    S.snap(key(s.id), 'your text before the section was removed', s.text); S.logDecision('Proposal', 'Section removed', s.title); pr.sections.splice(k, 1); changed(); rerender();
  }
  function addCard(pr) {
    let kind = 'text';
    return W.card(null, W.field(t('Add a part'), W.select(PR.KINDS.map(k => ({ value: k, label: t(root.ANCHOR_PROP_WORDS.en.kinds[k]) })), kind, v => { kind = v; })),
      h('div.btns', h('button.btn.sm', { onclick: () => { pr.sections.push(PR.section(kind, pr.lang)); changed(); S.logDecision('Proposal', 'Section added', root.ANCHOR_PROP_WORDS.en.kinds[kind]); rerender(); } }, U.icon('plus'), t('Add'))));
  }

  // ---------- checks and exports
  function checksCard() {
    const st = S.st; const pr = st.proposal; if (!pr) return h('div');
    const cnt = PR.counts(pr, st); const total = cnt.reduce((a, c) => a + c.words, 0); const iss = PR.checks(pr, st); const cc = PR.checkCitations(pr, st); const lim = Number(pr.word_limit);
    return W.card(t('Checks'), W.table([t('Section'), t('Words')], cnt.map(c => [c.section, String(c.words)]).concat([[t('Total'), lim > 0 ? t('{n} of {l}', { n: total, l: lim }) : String(total)]])),
      h('p.small', t('{n} citations found; {r} references will be listed.', { n: cc.citations.length, r: cc.refs.length })),
      iss.length ? W.alert('warn', 'alert', h('ul', iss.map(x => h('li', t(x[0], x[1]))))) : W.alert('ok', 'check', t('Nothing missing.')));
  }
  function exportCard() {
    const fname = ext => 'ANCHOR_proposal_' + U.safeName(S.st.proposal.title || 'untitled') + '_' + U.today() + ext;
    const run = async (label, fn, name, mime) => { const b = U.busy(t('Preparing {f}...', { f: label }));
      try { const out = await fn(S.st); b.done(); await U.save(name, out, mime); S.logDecision('Proposal', `Proposal exported (${label})`, PR.checks(S.st.proposal, S.st).length + ' open check(s)'); }
      catch (e) { b.done(); console.error(e); U.toast(e.message, 'error', 10000); } };
    return W.card(t('Export'), h('p.hint', t('Word, on your template if you uploaded one. Word asks to update the table of contents when the file opens; answer yes.')),
      h('div.btns.col', h('button.btn.primary', { onclick: () => run('Word', PR.docx, fname('.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }, U.icon('download'), t('Proposal (Word)')),
        h('button.btn', { onclick: () => run('HTML', async st => new TextEncoder().encode(await PR.html(st)), fname('.html'), 'text/html') }, U.icon('download'), t('Proposal (HTML, to print as PDF)')),
        h('button.btn', { onclick: () => run('LaTeX', PR.latexZip, fname('_LaTeX.zip'), 'application/zip') }, U.icon('download'), t('LaTeX package (.zip)'))),
      h('p.hint', t('PDF on the phone: open the HTML file and print it, or save the Word file as PDF. LaTeX compiles with XeLaTeX (Overleaf: Menu > Compiler > XeLaTeX).')));
  }
})(window);
