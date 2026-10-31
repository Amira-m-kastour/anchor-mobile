/* ANCHOR Mobile - Bibliometrics: data (exports, OpenAlex, the article's reference list, sample data), filters, retraction
   check, and the analyses (same ids, labels and tables as ANCHOR Studio; figures drawn on the device). */
(function (root) {
  'use strict';
  const h = U.h;
  const OA_UNSUPPORTED = ['local_cited_sources', 'local_cited_refs', 'rpys'];
  const GROUP_ORDER = ['Overview', 'Sources', 'Authors', 'Documents', 'Words', 'Conceptual structure', 'Intellectual structure', 'Social structure'];
  let src = 'files'; let oa = { mode: 'search', query: 'ESG rating disagreement stock returns', from: 2000, to: new Date().getFullYear(), types: ['article', 'review'], lang: '', max: 500 };
  let filt = null; let pendingFiles = [];
  let dsCheck = null;

  function setBiblio(M_all, log, dup, source) {
    const b = S.st.biblio; b.M_all = M_all; b.M = M_all; b.log = log; b.dup = dup || 0; b.source = source; b.retracted_removed = []; b.changed = true; filt = null; dsCheck = null; S.bibReady(); S.changed('biblio');
  }
  root.addReportItem = async function (label, chart, table, phase, note) {
    let png = null; try { if (chart) png = (await CH.png(chart, 1000)).png; } catch (e) { console.warn(e); }
    S.st.report_items.push({ id: U.uid(), label: label, note: note || '', phase: phase || 'C', table: table ? { cols: table.cols, rows: table.rows.slice(0, 30) } : null, chart: chart || null, png: png });
    S.logDecision(phase || 'C', 'Added to the report', label); U.toast(t('Added to the report (phase {p}).', { p: phase || 'C' }), 'ok');
  };

  SCREENS.biblio = function (sub, id) {
    if (sub === 'a' && id) return analysisScreen(decodeURIComponent(id));
    if (root.BIB_PRESET) { src = root.BIB_PRESET.source; oa.mode = root.BIB_PRESET.mode; root.BIB_PRESET = null; }
    const b = S.st.biblio;
    const status = !b.M ? W.alert('', 'info', h('b', t('Import your data.')), ' ', t('Export records from Scopus (CSV, all fields including cited references) or Web of Science (Plain text, "Full record and cited references"), then add them here. You can also fetch records from OpenAlex, start from the article\'s own reference list, or try the sample dataset.')) :
      W.alert('ok', 'check', t('{n} records in use (of {m} imported, {d} duplicates removed). Years {a}-{z}.', { n: I18N.num(b.M.n), m: I18N.num(b.M_all.n), d: b.dup, a: yr(b.M, Math.min), z: yr(b.M, Math.max) }),
        b.source === 'refs' ? h('p.small', { style: { margin: '4px 0 0' } }, t('Note: the article\'s reference list has no keywords, citations or affiliations, so only some analyses can run.')) : null,
        b.source === 'openalex' ? h('p.small', { style: { margin: '4px 0 0' } }, t('Source: OpenAlex (CC0), fetched live. Cited references are OpenAlex work ids, so co-citation and historiograph use those ids; cite OpenAlex (Priem et al., 2022) in your methods.')) : null);
    const srcSeg = W.radio([{ value: 'files', label: t('Database export files') }, { value: 'openalex', label: t('OpenAlex (fetch live, free)') }, { value: 'refs', label: t("The article's own reference list") }, { value: 'sample', label: t("Sample dataset (bibliometrix 'management')") }],
      src, v => { src = v; rerender(); });
    let srcBody;
    if (src === 'files') {
      const list = h('ul.small', pendingFiles.map(f => h('li', f.name)));
      srcBody = h('div', h('p.hint', t('Web of Science: Plain text, "Full Record and Cited References" (.txt). Scopus: CSV with all information. Also the "Dataset for Biblioshiny (.xlsx)" from ANCHOR Studio. Several files are merged; duplicates are removed.')),
        h('button.btn', { onclick: async () => { const fl = await U.pickFile('.txt,.csv,.xlsx,.ciw,text/plain,text/csv', true); if (fl.length) { pendingFiles = pendingFiles.concat(fl); rerender(); } } }, U.icon('upload'), t('Choose export file(s)')),
        pendingFiles.length ? h('div', list, h('button.btn.ghost.sm', { onclick: () => { pendingFiles = []; rerender(); } }, t('Clear the list'))) : null);
    } else if (src === 'openalex') {
      srcBody = h('div', W.radio([{ value: 'search', label: t('Search query') }, { value: 'citing', label: t('Works citing the focal article') }, { value: 'refs', label: t("The focal article's references") }, { value: 'both', label: t('Citing works + references') }], oa.mode, v => { oa.mode = v; rerender(); }),
        oa.mode === 'search' ? W.field(t('Search (titles, abstracts, full text index)'), W.text(oa.query, v => { oa.query = v; })) : h('p.hint', t('Uses the DOI on the Start page: {d}', { d: S.st.article.doi || '—' })),
        h('div.row', h('div.grow', W.field(t('From'), W.text(oa.from, v => { oa.from = v; }, { type: 'number' }))), h('div.grow', W.field(t('To'), W.text(oa.to, v => { oa.to = v; }, { type: 'number' })))),
        h('label.lab', t('Document types')), W.checks(['article', 'review', 'book-chapter', 'preprint'].map(x => ({ value: x, label: t(x) })), oa.types, v => { oa.types = v; }),
        h('div.row', h('div.grow', W.field(t('Language'), W.select([['', 'Any'], ['en', 'English'], ['de', 'German'], ['ar', 'Arabic'], ['fr', 'French']].map(x => ({ value: x[0], label: t(x[1]) })), oa.lang, v => { oa.lang = v; }))),
          h('div.grow', W.field(t('Max records'), W.text(oa.max, v => { oa.max = v; }, { type: 'number' })))),
        h('p.hint', t('Free and live (OpenAlex, CC0). With no API key the daily free allowance is small; a free key (Settings) covers several thousand records a day.')));
    } else if (src === 'refs') srcBody = h('p.hint', t('{n} references were read from the article on the Start page.', { n: (S.st.article.references || []).length }));
    else srcBody = h('p.hint', t('898 Web of Science records on management research, from the bibliometrixData R package (GPL-3). For trying the analyses only.'));
    const dataCard = W.card(t('Data'), srcSeg, h('div', { style: { margin: '10px 0' } }, srcBody), h('div.btns', h('button.btn.primary', { onclick: doImport }, U.icon(src === 'openalex' ? 'download' : 'upload'), src === 'openalex' ? t('Fetch') : t('Import'))));

    const out = h('div', status, dataCard);
    if (b.M) {
      out.appendChild(filterCard());
      if (b.log) out.appendChild(W.card(t('Sources of the records'), W.table(['file', 'database', 'records'], b.log.map(r => [r.file, r.database, r.records]))));
      out.appendChild(retractionCard());
      // the analyses, by group
      const groups = {}; Object.keys(BX.ANALYSES).forEach(id => { const a = BX.ANALYSES[id]; (groups[a.group] = groups[a.group] || []).push([id, a]); });
      out.appendChild(h('div.sect', h('h2', t('Analyses'))));
      GROUP_ORDER.filter(g => groups[g]).forEach(g => out.appendChild(h('div', h('h4', t(g)), h('div.list', groups[g].map(([id, a]) => h('a', { href: '#/biblio/a/' + id }, h('span.d', h('b', t(a.label)), a.slow ? h('span', t('may take a few seconds')) : null), U.icon('next', 'flip')))))));
      out.appendChild(h('p.hint', t('Not on the phone: thematic evolution and factorial analysis (MCA). Use ANCHOR Studio or Biblioshiny on a computer for those.')));
      out.appendChild(W.card(t('Records'), W.table(['AU', 'PY', 'TI', 'SO', 'TC', 'DT', 'DB'], Array.from({ length: Math.min(b.M.n, 100) }, (_, i) => ['AU', 'PY', 'TI', 'SO', 'TC', 'DT', 'DB'].map(k => b.M[k] ? b.M[k][i] : null)), { max: 100, tr: false }),
        h('div.btns', h('button.btn.sm', { onclick: exportXlsx }, U.icon('download'), t('Dataset for Biblioshiny (.xlsx)')))));
    }
    return out;
  };
  const yr = (M, f) => { const v = M.PY.filter(x => x !== null); return v.length ? f.apply(null, v) : '?'; };

  async function doImport() {
    const st = S.st;
    if (src === 'openalex') {
      if (!S.cfg().enabled) return U.toast(t('Switch on the internet features in Settings first.'), 'warn');
      const bz = U.busy(t('Fetching records from OpenAlex...'));
      try { const r = await O.corpus({ mode: oa.mode, query: oa.query, doi: st.article.doi, from: oa.from, to: oa.to, types: oa.types, lang: oa.lang, max: Math.min(5000, Math.max(50, parseInt(oa.max, 10) || 500)) }, (n, f) => bz.set(t('Fetching records from OpenAlex... {n} of {f}', { n: n, f: f })));
        setBiblio(r.M, r.log, r.dup, 'openalex');
        S.logDecision('N', 'Corpus fetched from OpenAlex', `mode ${oa.mode}; ${oa.mode === 'search' ? 'query: ' + oa.query : 'focal article'}; ${r.M.n} records (${r.found} found)${r.note ? '; ' + r.note : ''}`);
        bz.done(); U.toast(t('{n} records ready for analysis.', { n: r.M.n }) + (r.note ? ' ' + r.note : ''), 'ok', 9000); rerender(); }
      catch (e) { bz.done(); U.toast(e.message, 'error', 12000); }
      return;
    }
    const bz = U.busy(t('Importing...'));
    try {
      let M, log, dup = 0;
      if (src === 'sample') { const r = await fetch('data/sample_management.json'); const recs = await r.json(); M = BX.fromRecords(recs); log = [{ file: 'bibliometrixData::management', database: 'wos', records: M.n }]; }
      else if (src === 'refs') { const recs = ART.refsToRecords(st.article.references || []); if (!recs.length) throw new Error(t('No references could be read from the article. Upload database exports instead.'));
        M = BX.fromRecords(recs); log = [{ file: 'Article reference list', database: 'article', records: M.n }]; }
      else { if (!pendingFiles.length) throw new Error(t('Choose one or more export files first.'));
        const parts = []; log = [];
        for (const f of pendingFiles) { const r = await IMPORT.read(f); parts.push(r.M); log.push({ file: f.name, database: r.format === 'xlsx' ? 'bibliometrix' : r.format, records: r.M.n }); }
        M = IMPORT.merge(parts); dup = M._dup || 0; delete M._dup; pendingFiles = []; }
      setBiblio(M, log, dup, src); bz.done(); U.toast(t('{n} records ready for analysis.', { n: M.n }), 'ok'); rerender();
    } catch (e) { bz.done(); console.error(e); U.toast(e.message, 'error', 12000); }
  }
  function filterCard() {
    const b = S.st.biblio; const M = b.M_all; const yrs = M.PY.filter(x => x !== null);
    if (!filt) filt = { y0: Math.min.apply(null, yrs), y1: Math.max.apply(null, yrs), types: null, langs: null, tc: 0 };
    const types = BX.table(M.DT || []).map(x => x[0]); const langs = BX.table(M.LA || []).map(x => x[0]);
    return h('details.card', h('summary', U.icon('filter'), ' ', t('Filters')),
      h('div.row', h('div.grow', W.field(t('From year'), W.text(filt.y0, v => { filt.y0 = Number(v); }, { type: 'number' }))), h('div.grow', W.field(t('To year'), W.text(filt.y1, v => { filt.y1 = Number(v); }, { type: 'number' })))),
      types.length ? h('div', h('label.lab', t('Document types')), W.checks(types.map(x => ({ value: x, label: x })), filt.types || types, v => { filt.types = v; })) : null,
      langs.length > 1 ? h('div', h('label.lab', t('Languages')), W.checks(langs.map(x => ({ value: x, label: x })), filt.langs || langs, v => { filt.langs = v; })) : null,
      W.field(t('Minimum citations'), W.text(filt.tc, v => { filt.tc = Number(v) || 0; }, { type: 'number' })),
      h('div.btns', h('button.btn.sm', { onclick: () => { const keep = [];
        for (let i = 0; i < M.n; i++) { const py = M.PY[i]; if (py === null || py < filt.y0 || py > filt.y1) continue; if (filt.types && M.DT && !filt.types.map(x => String(x).toUpperCase()).includes(String(M.DT[i]).toUpperCase())) continue;
          if (filt.langs && M.LA && !filt.langs.map(x => String(x).toUpperCase()).includes(String(M.LA[i]).toUpperCase())) continue; if (filt.tc > 0 && !(M.TC[i] >= filt.tc)) continue; keep.push(i); }
        b.M = BX.subset(M, keep); b.changed = true; S.bibReady(); S.changed('biblio'); U.toast(t('{n} of {m} records kept.', { n: keep.length, m: M.n }), 'ok'); rerender(); } }, U.icon('filter'), t('Apply filters'))));
  }
  function retractionCard() {
    const b = S.st.biblio; const M = b.M; const d = dsCheck; const rr = b.retracted_removed || []; let body;
    const gone = new Set(rr.map(x => x.doi)); const fl = d ? d.flagged.filter(f => !gone.has(O.norm(f.doi))) : [];
    const removed = rr.length ? W.alert('warn', 'alert', h('b', t('{n} retracted record(s) excluded from the analyses ({d}).', { n: rr.length, d: rr[0].removed_at })), ' ',
      t('They are counted in the PRISMA flow and listed in the decision log. Figures added to the report before this were made with them: re-run and re-add those figures.'),
      h('ul', rr.map(x => h('li', `${x.record} - doi:${x.doi}`)))) : null;
    if (!d) body = h('p.hint', t('Checks every record with a DOI against OpenAlex\'s retraction flag. Only DOIs are sent.'));
    else if (!fl.length) body = W.alert('ok', 'check', rr.length ? t('Retraction check {d}: {a} of {b} records have a DOI; {c} found in OpenAlex; no retracted records remain.', { d: d.checked_at, a: d.n_doi, b: d.n_records, c: d.n_found })
      : t('Retraction check {d}: {a} of {b} records have a DOI; {c} found in OpenAlex; none retracted.', { d: d.checked_at, a: d.n_doi, b: d.n_records, c: d.n_found }));
    else body = W.alert('bad', 'alert', h('b', t('{n} retracted record(s) found ({d}).', { n: fl.length, d: d.checked_at })), ' ',
      t('Decide whether to exclude them. Excluding removes them from every analysis, counts them in the PRISMA flow and records the decision.'),
      h('ul', fl.map(f => h('li', `${f.record} - ${f.title} (doi:${f.doi})`))),
      h('button.btn.sm.danger', { onclick: () => excludeRetracted(fl) }, U.icon('alert'), t('Exclude the {n} retracted record(s)', { n: fl.length })));
    return W.card(t('Retractions'), h('div', body, removed), h('button.btn.sm', { onclick: async () => { if (!S.cfg().enabled) return U.toast(t('Switch on the internet features in Settings first.'), 'warn');
      const bz = U.busy(t('Checking the records for retractions online...')); try { dsCheck = await O.datasetCheck(M, (a, n) => bz.set(t('Checking {a} of {n} DOIs...', { a: a, n: n }))); S.st.online_ds_mobile = dsCheck; } catch (e) { U.toast(e.message, 'error'); } finally { bz.done(); rerender(); } } }, U.icon('alert'), t('Check records for retractions (online)')));
  }
  // removes the retracted records from the imported data (so filters cannot bring them back), counts them for PRISMA and logs the decision
  function excludeRetracted(fl) {
    const b = S.st.biblio; const dois = new Set(fl.map(f => O.norm(f.doi)).filter(Boolean));
    const keepIdx = M => { const k = []; for (let i = 0; i < M.n; i++) if (!dois.has(O.norm((M.DI || [])[i] || ''))) k.push(i); return k; };
    const kAll = keepIdx(b.M_all), kUse = keepIdx(b.M); const n = b.M_all.n - kAll.length;
    if (!n) return U.toast(t('These records are no longer in the dataset.'), 'info');
    const at = U.now(); b.retracted_removed = (b.retracted_removed || []).concat(fl.filter(f => dois.has(O.norm(f.doi))).map(f => ({ record: f.record || f.doi, doi: O.norm(f.doi), notice: f.notice || '', removed_at: at })));
    b.M_all = BX.subset(b.M_all, kAll); b.M = BX.subset(b.M, kUse); b.changed = true; S.bibReady(); S.changed('biblio');
    S.logDecision('N', `${n} retracted record(s) excluded from the bibliometric dataset`, Array.from(dois).map(x => 'doi:' + x).join('; '));
    U.toast(t('{n} retracted record(s) excluded. Re-run your analyses; figures already added to the report were made before this change.', { n: n }), 'warn'); rerender();
  }
  async function exportXlsx() {
    const M = S.st.biblio.M; const keys = Object.keys(M).filter(k => k !== 'n' && Array.isArray(M[k]) && M[k].length === M.n);
    const rows = Array.from({ length: M.n }, (_, i) => { const o = {}; keys.forEach(k => { o[k] = M[k][i]; }); return o; });
    const ws = XLSX.utils.json_to_sheet(rows, { header: keys }); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    await U.save('ANCHOR_bibliometrix_' + U.today() + '.xlsx', new Uint8Array(out), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  // ---------- one analysis (in a Web Worker when the page allows one; on the main thread otherwise)
  let worker = null; let mKey = 0; let lastM = null;
  function runInWorker(id, M, o) {
    if (M !== lastM) { lastM = M; mKey++; }
    const local = () => new Promise((res, rej) => setTimeout(() => { try { if (!S.st.biblio.R) S.bibReady(); res(BX.run(id, M, S.st.biblio.R, o)); } catch (e) { rej(e); } }, 30));
    try { if (!worker) worker = new Worker('js/analysis_worker.js'); } catch (e) { return local(); }
    return new Promise((res, rej) => { const tm = setTimeout(() => { worker.terminate(); worker = null; rej(new Error(t('The analysis took too long on this device. Use fewer records (filters) and try again.'))); }, 180000);
      worker.onmessage = e => { clearTimeout(tm); if (e.data.ok) res(e.data.res); else rej(new Error(e.data.error)); };
      worker.onerror = e => { clearTimeout(tm); worker = null; e.preventDefault(); local().then(res, rej); };
      worker.postMessage({ id: id, M: M, opts: JSON.parse(JSON.stringify(o)), key: mKey }); });
  }
  const lastRun = {};
  function analysisScreen(id) {
    const a = BX.ANALYSES[id]; if (!a) return W.alert('bad', 'alert', t('Unknown analysis.'));
    const b = S.st.biblio; const o = lastRun[id] ? lastRun[id].opts : { field: 'DE', nnodes: 40, level: 'authors', clevel: 'references', tf: ['AU', 'DE', 'SO'] };
    const head = h('div', h('a.btn.ghost.sm', { href: '#/biblio' }, U.icon('back', 'flip'), t('All analyses')), h('h2', t(a.label)), h('p.hint', t(a.group)));
    if (!b.M) return h('div', head, W.alert('', 'info', t('Import data first.'), ' ', h('a', { href: '#/biblio' }, t('Bibliometrics > Data'))));
    const opts = h('div');
    const fieldSel = () => W.field(t('Field'), W.select([['DE', 'Author keywords'], ['ID', 'Keywords Plus'], ['TI', 'Titles'], ['AB', 'Abstracts']].map(x => ({ value: x[0], label: t(x[1]) })), o.field, v => { o.field = v; }));
    (a.opts || []).forEach(k => {
      if (k === 'field') opts.appendChild(fieldSel());
      if (k === 'nnodes') opts.appendChild(W.field(t('Number of nodes'), W.select([10, 20, 30, 40, 50, 60, 80, 100].map(n => ({ value: String(n), label: String(n) })), String(o.nnodes), v => { o.nnodes = Number(v); })));
      if (k === 'level') opts.appendChild(W.field(t('Level'), W.select([['authors', 'Authors'], ['universities', 'Institutions'], ['countries', 'Countries']].map(x => ({ value: x[0], label: t(x[1]) })), o.level, v => { o.level = v; })));
      if (k === 'clevel') opts.appendChild(W.field(t('Unit'), W.select([['references', 'Documents'], ['sources', 'Sources'], ['authors', 'Authors']].map(x => ({ value: x[0], label: t(x[1]) })), o.clevel, v => { o.clevel = v; })));
      if (k === 'tf') { const F = [['AU', 'Authors'], ['DE', 'Keywords'], ['SO', 'Sources'], ['AU_CO', 'Countries'], ['CR_SO', 'Cited sources']];
        ['Left field', 'Middle field', 'Right field'].forEach((lab, j) => opts.appendChild(W.field(t(lab), W.select(F.map(x => ({ value: x[0], label: t(x[1]) })), o.tf[j], v => { o.tf[j] = v; })))); }
    });
    const res = h('div');
    const draw = () => { res.innerHTML = ''; const r = lastRun[id]; if (!r) return; if (r.error) { res.appendChild(W.alert('warn', 'alert', r.error)); return; }
      const x = r.res; if (x.chart) res.appendChild(W.card(null, CH.render(x.chart)));
      if (x.note) res.appendChild(h('p.hint', t(x.note)));
      if (x.table && x.table.rows.length) res.appendChild(W.table(x.table.cols, x.table.rows, { max: 200, tr: false }));
      res.appendChild(h('div.btns',
        h('button.btn.primary.sm', { onclick: async () => { const bz = U.busy(t('Adding to the report...')); try { await root.addReportItem(t(a.label) === a.label ? a.label : a.label, x.chart, x.table, 'C', x.note || ''); } finally { bz.done(); } } }, U.icon('plus'), t('Add to report')),
        x.table ? h('button.btn.sm', { onclick: () => U.save(id + '.csv', U.csv([x.table.cols].concat(x.table.rows)), 'text/csv') }, U.icon('download'), t('Table (CSV)')) : null,
        x.chart ? h('button.btn.sm', { onclick: async () => { const p = await CH.png(x.chart, 1200); U.save(id + '.png', p.png, 'image/png'); } }, U.icon('download'), t('Figure (PNG)')) : null,
        x.chart ? h('button.btn.sm', { onclick: () => U.save(id + '.svg', CH.svg(x.chart, 1000, CH.PAL.light), 'image/svg+xml') }, U.icon('download'), t('Figure (SVG)')) : null)); };
    const run = () => { const bz = U.busy(t('Running {a}...', { a: t(a.label) }));
      if (OA_UNSUPPORTED.includes(id) && b.M.DB && b.M.DB.every(d => d === null || String(d).toUpperCase() === 'OPENALEX')) { bz.done(); lastRun[id] = { opts: o, error: t('This analysis needs cited references written out with source names and years, which OpenAlex gives only as work ids. Use a Web of Science or Scopus export for it; all other analyses run on OpenAlex records.') }; return draw(); }
      runInWorker(id, b.M, o).then(res => { lastRun[id] = { opts: JSON.parse(JSON.stringify(o)), res: res }; }, err => { lastRun[id] = { opts: o, error: err.message }; }).then(() => { bz.done(); draw(); }); };
    draw();
    return h('div', head, (a.opts || []).length ? W.card(t('Options'), opts) : null, h('div.btns', h('button.btn.primary', { onclick: run }, U.icon('play'), t('Run'))), res);
  }
})(window);
