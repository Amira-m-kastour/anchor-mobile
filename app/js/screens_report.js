/* ANCHOR Mobile - Report & disclosure screen. */
(function (root) {
  'use strict';
  const h = U.h;
  SCREENS.report = function () {
    const st = S.st;
    const stamp = ext => 'ANCHOR_' + U.safeName(st.article.title) + '_' + U.today() + ext;
    const act = async (label, fn) => { const b = U.busy(t('Building {x}...', { x: label })); try { await fn(); } catch (e) { console.error(e); U.toast(e.message, 'error', 10000); } finally { b.done(); } };
    const langs = [{ value: 'en', label: 'English' }].concat(I18N.lang !== 'en' ? [{ value: I18N.lang, label: I18N.NAMES[I18N.lang] }] : []);
    const btn = (icon, label, fn) => h('button', { type: 'button', onclick: fn }, U.icon(icon), h('span.d', h('b', label)), U.icon('download'));
    const list = h('div.list',
      btn('doc', t('Report (HTML)'), () => act('HTML', () => U.save(stamp('.html'), RP.html(st), 'text/html'))),
      btn('doc', t('Report (Word)'), () => act('Word', async () => U.save(stamp('.docx'), await RP.docx(st), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))),
      btn('doc', t('LaTeX package (.zip) for Overleaf'), () => act('LaTeX', async () => U.save(stamp('_LaTeX.zip'), await RP.latexZip(st), 'application/zip'))),
      btn('list', t('References (.bib)'), () => act('BibTeX', () => U.save(stamp('_references.bib'), RP.bib(st), 'application/x-bibtex'))),
      btn('info', t('AI-use disclosure (.txt)'), () => act('disclosure', () => U.save(stamp('_disclosure.txt'), RP.disclosure(st), 'text/plain'))),
      btn('list', t('Prompt log (.csv)'), () => act('CSV', () => U.save(stamp('_prompts.csv'), U.csvStrict([['time', 'phase', 'mode', 'prompt']].concat(st.prompts.map(p => [p.time, p.phase, p.mode, p.prompt]))), 'text/csv'))),
      btn('list', t('Decision log (.csv)'), () => act('CSV', () => U.save(stamp('_decisions.csv'), U.csvStrict([['time', 'phase', 'decision', 'note']].concat(st.decisions.map(d => [d.time, d.phase, d.decision, d.note]))), 'text/csv'))),
      btn('save', t('Project file (.anchor)'), () => root.saveProject()));
    const disc = h('pre.small', { style: { whiteSpace: 'pre-wrap', background: 'var(--surface2)', padding: '12px', borderRadius: '10px', margin: 0 } }, RP.disclosure(st));
    const frame = h('iframe.report-frame', { sandbox: '', title: t('Report preview') });
    let shown = false;
    const preview = h('details.card', { ontoggle: () => { if (!shown) { frame.srcdoc = RP.html(st); shown = true; } } }, h('summary', t('Report preview')), frame);
    return h('div',
      W.card(t('Export'), h('p.hint', t('PDF: open the HTML report and print it to PDF from your browser or phone, or open the Word report and save it as PDF.')),
        W.field(t('Language of the report headings'), W.seg(langs, RP.lang(), v => { RP.setLang(v); rerender(); })), h('div', { style: { marginTop: '12px' } }, list),
        W.alert('warn', 'alert', t('The project file contains the full text of the article you uploaded. Share it only with people allowed to read that article (for example your supervisor), never publicly.'))),
      W.card(t('Disclosure'), disc, h('div.btns', h('button.btn.sm', { onclick: async () => { const ok = await U.copy(RP.disclosure(st)); U.toast(ok ? t('Copied.') : t('Select the text and copy it.'), ok ? 'ok' : 'warn'); } }, U.icon('copy'), t('Copy')))),
      decisionLog(), preview);
  };
  // the decision log: entries are never changed; a correction is added beside the original, with the reason
  const CORR = 'Correction to the entry of ';
  function decisionLog() {
    const d = S.st.decisions; if (!d.length) return null;
    const corrected = e => d.some(x => x.decision.startsWith(CORR + e.time + ' (' + e.decision + ')'));
    return W.card(t('Decision log'), h('p.hint', t('Entries cannot be changed or deleted. To correct one, add a correction: it is logged beside the original, with your reason, and appears in every report.')),
      h('ul.vlist', d.map((e, k) => [e, k]).reverse().slice(0, 60).map(([e]) => h('li', h('div', h('b', e.time), ' · ', e.phase, ' · ', e.decision, corrected(e) ? h('span.badge.warn', t('corrected')) : null, e.note ? h('div.hint', e.note) : null),
        e.decision.startsWith(CORR) ? null : h('button.btn.ghost.sm', { onclick: () => correct(e) }, t('Add a correction'))))));
  }
  function correct(e) {
    let why = '';
    U.sheet(t('Add a correction'), h('div', h('p', h('b', `${e.time} · ${e.phase} · ${e.decision}`)), W.field(t('What was wrong, and what is correct?'), W.area('', v => { why = v; }, { rows: 4 }))),
      [{ label: t('Cancel') }, { label: t('Add the correction'), kind: 'primary', onclick: () => { if (!why.trim()) { U.toast(t('Write what was wrong and what is correct.'), 'warn'); return false; }
        S.logDecision(e.phase, CORR + e.time + ' (' + e.decision + ')', why.trim()); U.toast(t('Correction added to the decision log.'), 'ok'); rerender(); } }]);
  }
})(window);
