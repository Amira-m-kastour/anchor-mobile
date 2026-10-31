/* ANCHOR Mobile - report and disclosure (ports of the desktop app's report.R, export.R and lessons.R):
   HTML report, Word (.docx) report, LaTeX package (.zip) for Overleaf, references (.bib), AI-use disclosure, and the
   decision and prompt logs. The published article PDF is never put in any of these files. */
(function (root) {
  'use strict';
  const C = root.ANCHOR_CONTENT;
  const RP = {};
  let RL = 'en';                                   // report language: English (default) or the app's language
  const r = (s, v) => (RL === 'en' ? s.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : m)) : root.t(s, v));
  RP.setLang = l => { RL = l || 'en'; };
  RP.lang = () => RL;
  const e = s => U.esc(s);
  const nz = U.nz;

  // ---------- markdown (escaped first, so drafts from an AI model cannot inject markup)
  function inline(s) {
    return e(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  function mdBlocks(md) {   // -> [{t:'h',level,text}|{t:'p',text}|{t:'ul'|'ol',items}|{t:'table',head,rows}|{t:'pre',text}|{t:'quote',text}]
    const lines = String(md || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    while (i < lines.length) { const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { out.push({ t: 'h', level: m[1].length, text: m[2].replace(/\s*#+\s*$/, '') }); i++; continue; }
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push({ t: 'pre', text: buf.join('\n') }); continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) { const cells = x => x.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim());
        const head = cells(l); const rows = []; i += 2; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++])); out.push({ t: 'table', head: head, rows: rows }); continue; }
      if (/^\s*([-*+])\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*([-*+])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, '')); out.push({ t: 'ul', items: items }); continue; }
      if (/^\s*\d+[.)]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); out.push({ t: 'ol', items: items }); continue; }
      if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push({ t: 'quote', text: buf.join(' ') }); continue; }
      const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>)/.test(lines[i]) && !(/^\s*\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) buf.push(lines[i++]);
      out.push({ t: 'p', text: buf.join(' ') }); }
    // shift headings so the highest becomes level 3 inside a phase section
    const hs = out.filter(b => b.t === 'h').map(b => b.level); if (hs.length) { const d = 3 - Math.min.apply(null, hs); out.forEach(b => { if (b.t === 'h') b.level = Math.max(3, Math.min(6, b.level + d)); }); }
    return out;
  }
  RP.mdHtml = function (md) {
    md = AI.stripQ(md); if (!String(md).trim()) return '<p><i>' + e(r('Not completed.')) + '</i></p>';
    return mdBlocks(md).map(b => b.t === 'h' ? `<h${b.level}>${inline(b.text)}</h${b.level}>` : b.t === 'p' ? `<p>${inline(b.text)}</p>` : b.t === 'pre' ? `<pre>${e(b.text)}</pre>` : b.t === 'quote' ? `<blockquote>${inline(b.text)}</blockquote>`
      : b.t === 'table' ? `<table><tr>${b.head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>${b.rows.map(rw => `<tr>${rw.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`
      : `<${b.t}>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</${b.t}>`).join('\n');
  };
  RP.blocks = mdBlocks;

  // ---------- shared pieces
  RP.disclosure = function (st) {
    const s = st.setup; const name = (s.S_name || '').trim() || (st.prereq.name || '').trim() || '[your name]';
    const toolName = m => m === 'api' ? `Claude (${st.settings.api_model || 'model not recorded'}), Anthropic, accessed through the Anthropic API` : m === 'prompt' ? 'Claude (claude.ai), Anthropic, used through copy-and-paste prompts'
      : m === 'ollama' ? `a local language model (${st.settings.ollama_model || 'model not recorded'}) served by Ollama` : null;
    const modes = Array.from(new Set(st.prompts.map(p => p.mode))); const tools = modes.map(toolName).filter(Boolean); const tool = tools.length ? tools.join('; and ') : null;
    const used = st.prompts.length > 0 && !!tool;
    const ds = st.prompts.map(p => p.time.slice(0, 10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
    const fd = d => { const x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); };
    const when = !ds.length ? 'on ' + fd(U.today()) : ds[0] === ds[ds.length - 1] ? 'on ' + fd(ds[0]) : 'between ' + fd(ds[0]) + ' and ' + fd(ds[ds.length - 1]);
    const onlyFind = used && st.prompts.every(p => p.phase === 'Find'); const anyFind = st.prompts.some(p => p.phase === 'Find');
    const phases = Array.from(new Set(st.prompts.map(p => p.phase))).filter(p => p !== 'Find');
    const lines = ['AI-USE AND METHODS DISCLOSURE', '',
      `${name} applied the ANCHOR framework (Kastour, 2026) to ${String(st.article.citation || '[focal article]').replace(/\.\s*$/, '')} using ANCHOR Studio ${S.APP_VERSION} (ANCHOR Mobile ${S.MOBILE_VERSION}).`,
      `Bibliometric analyses were run with the bibliometrix R package (Aria & Cuccurullo, 2017)${st.biblio.M ? ` on ${st.biblio.M.n} records` : ''}${st.biblio.M ? ', using the ANCHOR Mobile port of its functions' : ''}.`,
      onlyFind ? `Generative AI (${tool}) was used ${when} only to summarise the abstracts of candidate articles while the focal article was chosen; the choice was the author's, and no text of the review was drafted with AI.`
        : used ? `Generative AI (${tool}) was used ${when} to draft parts of phases ${phases.join(', ')}. Every draft was reviewed, edited and approved by the author at a decision gate; all figures were checked against the primary source.` : 'No generative AI was used to draft the text.',
      used && anyFind && !onlyFind ? "AI also summarised the abstracts of candidate articles while the focal article was chosen; the choice was the author's." : null,
      `${name} takes full responsibility for the content.`, '', 'References',
      'Aria, M., & Cuccurullo, C. (2017). bibliometrix: An R-tool for comprehensive science mapping analysis. Journal of Informetrics, 11(4), 959-975. https://doi.org/10.1016/j.joi.2017.08.007',
      'Kastour, A. M. (2026). ANCHOR: A replicable framework for AI-assisted article-anchored literature reviews. Developed with Claude (Opus 5.5), Anthropic.',
      used && modes.some(m => m === 'api' || m === 'prompt') ? `Anthropic. (${new Date().getFullYear()}). Claude [Large language model]. https://claude.ai` : null,
      nz(st.article.citation) ? st.article.citation : null];
    return lines.filter(x => x !== null).join('\n');
  };
  RP.onlineNote = st => st.online && st.online.online ? `References verified live at Crossref on ${st.online.checked_at}; new-reading suggestions from OpenAlex.`
    : `References as built into ANCHOR Studio ${S.APP_VERSION} (checked ${C.lessons_asof}); not re-checked online for this report.`;
  function lessonsData(id, st) { const L = C.lessons[id]; const ph = st.phases[id];
    return { lessons: L.lessons, wiifm: L.wiifm, refs: L.refs.map(k => Object.assign({ key: k }, O.refLive(k, st))), acc: ph.accepted || [], my_lessons: ph.my_lessons || '', my_wiifm: ph.my_wiifm || '' }; }
  const flagged = x => ['retracted', 'concern', 'corrected'].includes(x.status);
  function findReport(st) {
    const f = st.finder; if (!f || !f.chosen || !f.shortlist || !f.shortlist.length) return null; const sh = f.shortlist;
    sh.forEach(x => { if (x.fit === undefined || x.fit === null) x.fit = O.fitScore(x, (f.ticks || {})[x.id], sh); });
    const ch = sh.find(x => x.id === f.chosen); const sortLab = (C.find_sorts.find(x => x.value === (f.sort || 'relevance')) || {}).label || 'Relevance';
    return { text: `The focal article was chosen on ${f.chosen_at || ''} from an OpenAlex search for "${f.query || ''}" (${Number(f.found || 0).toLocaleString('en-GB')} matches; filters: ${f.filters || 'none'}; sorted by ${sortLab}), comparing ${sh.length} shortlisted candidate${sh.length === 1 ? '' : 's'}. Chosen: ${ch ? `${ch.title} (${ch.year})` : f.chosen}.${f.reason ? ' Reason given: ' + f.reason : ''}`,
      table: { cols: ['Article', 'Journal', 'Citations', 'Per year', 'FWCI', 'Open copy', 'Fit (guide)', 'Chosen'], rows: sh.map(x => [`${x.title} (${x.year})`, x.journal, x.cites, x.per_year, x.fwci === null || x.fwci === undefined ? '-' : Math.round(x.fwci * 100) / 100,
        x.pdf_url || x.oa_url ? (x.version ? (C.version_label[x.version] || x.version) : 'yes') : 'none', x.fit, x.id === f.chosen ? 'yes' : '']) },
      note: 'Fit scores combine the researcher\'s own ticks (60%) with fetched signals (40%) and are a guide only. No PDF is included in this report.' };
  }
  RP.findReport = findReport;
  function prereqTables(st) {
    const p = st.prereq; const v = x => (x === null || x === undefined || (Array.isArray(x) ? !x.length : !String(x).trim())) ? '-' : Array.isArray(x) ? x.join('; ') : String(x);
    const lab = (list, vals) => list.filter(x => (vals || []).includes(x.value)).map(x => x.label);
    const reg = cc => { try { return cc ? new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) : ''; } catch (err) { return cc; } };
    const out = {};
    out.Researcher = [['Name', v(p.name || st.setup.S_name)], ['ORCID iD', p.orcid ? 'https://orcid.org/' + p.orcid + (p.orcid_name ? ` (${p.orcid_name})` : '') : '-'], ['Role and programme', v([p.role, p.programme].filter(Boolean).join(', '))],
      ['Supervisor or reviewer', v(p.supervisor)], ['Skills prepared', v(lab(C.skills, p.skills))], ['Time plan', v(p.timeplan)]];
    out['Academic affiliation'] = [['Institution', v(p.institution || st.setup.S_inst)], ['ROR identifier', v(p.ror_id)], ['Faculty or department', v(p.faculty)], ["Institution's country", v(reg(p.inst_country || p.country))],
      ['Region chosen on this page', v(p.country ? reg(p.country) + (p.country_how ? ` (${p.country_how})` : '') : '')], ['Library access route', v(p.access_route)], ['Library link for articles', v(p.resolver)],
      ['Institutional rules read', v(lab(C.rules, p.rules))], ['Ethics', v(lab(C.ethics, [p.ethics]))]];
    const dbs = C.db_catalog.filter(d => (p.dbs || []).includes(d.id)); const ra = Array.from(new Set(dbs.map(d => d.rater).filter(Boolean)));
    out['Databases available'] = (dbs.length ? dbs.map(d => [d.name, d.kind, d.licence, d.route]) : [['None recorded', '-', '-', '-']]).concat([['ESG rating families available', 'ESG ratings', '-', ra.length ? ra.join(', ') : 'none recorded']]);
    out.Licensing = [['ANCHOR Studio', 'GPL-3 (bundled software under their own licences, see NOTICE)'], ['Literature metadata', 'Crossref and OpenAlex metadata (CC0); ROR (CC0); ORCID public data'],
      ['Report licence', v(lab(C.output_licences, [p.output_licence]))], ['Code licence', v(lab(C.code_licences, [p.code_licence]))],
      ['Sharing rules applied', 'Licensed data and the published article PDF are never put in shared files; open data is shared with its citation.']];
    out.Software = [['ANCHOR Mobile', 'ok', 'ANCHOR Mobile ' + S.MOBILE_VERSION + ' (project format of ANCHOR Studio ' + S.APP_VERSION + ')'], ['Bibliometrics', 'ok', 'bibliometrix 4.3.1 functions ported to JavaScript'],
      ['Internet features', S.st.settings.online === false ? 'off' : st.online ? (st.online.online ? 'ok' : 'offline') : 'not checked', 'Crossref and OpenAlex'], ['AI drafting mode', 'ok', st.settings.mode + (st.settings.mode === 'api' ? ` (${st.settings.api_model})` : '')]];
    return { Researcher: { cols: ['Item', 'Value'], rows: out.Researcher }, 'Academic affiliation': { cols: ['Item', 'Value'], rows: out['Academic affiliation'] },
      'Databases available': { cols: ['Database', 'Kind', 'Licence', 'Route'], rows: out['Databases available'] }, Licensing: { cols: ['Item', 'Value'], rows: out.Licensing }, Software: { cols: ['Item', 'Status', 'Detail'], rows: out.Software } };
  }
  RP.prereqTables = prereqTables;
  const dataAvailability = st => 'No datasets were analysed in phase O' + (st.app_version_saved ? ' on this device; datasets analysed in ANCHOR Studio are listed in its report.' : '.');
  const itemsFor = (st, ph) => st.report_items.filter(it => (it.phase || 'C') === ph);
  const pngUri = b => 'data:image/png;base64,' + U.b64(b);

  // ---------- HTML report
  RP.html = function (st) {
    const a = st.article; const s = st.setup; const rtl = RL === 'ar';
    const css = "body{font-family:'IBM Plex Sans','IBM Plex Sans Arabic',Arial,sans-serif;color:#14213D;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.55;background:#fff}" +
      "h1,h2,h3{font-family:'Source Serif 4',Georgia,serif}h1{font-size:30px;margin-bottom:4px}h2{border-bottom:2px solid #14213D;padding-bottom:4px;margin-top:40px}" +
      ".eye{color:#B4561A;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:600}table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}" +
      "td,th{border-bottom:1px solid #D5D9DF;padding:5px 8px;text-align:start;vertical-align:top}th{background:#ECE8DE}.qa td:first-child{width:45%;color:#3D4A5C}" +
      ".status{display:inline-block;padding:2px 10px;border-radius:99px;background:#E2F1E7;color:#2F7A4B;font-size:12px;font-weight:600}.pending{background:#F6ECDC;color:#965E0F}" +
      "img{max-width:100%;border:1px solid #D5D9DF}pre{white-space:pre-wrap;background:#F4F6F5;padding:12px;font-size:13px}.fig{margin:18px 0}.cap{font-size:13px;color:#5B6675}" +
      ".lessons{background:#F6F3EA;border-inline-start:4px solid #B4561A;padding:4px 16px 8px;margin:18px 0}.refs{font-size:13px}.brandfoot{margin-top:40px;padding-top:10px;border-top:1px solid #D5D9DF;font-size:12px;color:#5B6675}" +
      "@page{size:A4;margin:18mm 16mm 20mm}@media print{body{margin:0 auto;max-width:none;padding:0}h1,h2,h3{break-after:avoid}.fig,img,tr,pre,.qa{break-inside:avoid}}";
    const tbl = (cols, rows, n) => `<table><tr>${cols.map(c => `<th>${e(c)}</th>`).join('')}</tr>${rows.slice(0, n || 200).map(rw => `<tr>${rw.map(c => `<td>${e(c === null || c === undefined ? '' : c)}</td>`).join('')}</tr>`).join('')}</table>`;
    const P = [];
    P.push(`<!doctype html><html lang="${RL}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANCHOR review - ${e(a.title || '')}</title><style>${css}</style></head><body>`);
    P.push(`<p class="eye">${e(r('ANCHOR review report'))}</p><h1>${e(a.title || r('Untitled review'))}</h1>`);
    P.push(`<p>${e(s.S_name || S.name())}${s.S_inst ? ' \u00b7 ' + e(s.S_inst) : ''}<br>${e(r('Generated {d} with {b}', { d: U.now(), b: S.APP_BRAND + ' ' + S.APP_VERSION + ' (ANCHOR Mobile ' + S.MOBILE_VERSION + ')' }))}</p>`);
    P.push(`<p><b>${e(r('Focal article:'))}</b> ${e(a.citation || '')}</p>`);
    const f = st.online && st.online.focal; if (f && f.found && f.doi === O.norm(a.doi) && f.status !== 'ok') P.push(`<p style="color:#B3261E"><b>${e(r('Warning:'))}</b> ${e(r('the focal article has a published {n} (checked {d}).', { n: O.NOTICE_NAME[f.status], d: f.checked_at }))}</p>`);
    P.push(`<p class="cap">${e(RP.onlineNote(st))}</p>`);
    P.push(`<h2>${e(r('Progress and decisions'))}</h2><table><tr><th>${e(r('Phase'))}</th><th>${e(r('Status'))}</th><th>${e(r('Approved'))}</th></tr>` +
      C.phases.map(p => { const ph = st.phases[p.id]; return `<tr><td>${p.id} \u00b7 ${e(r(p.name))}</td><td><span class="status ${ph.status === 'approved' ? '' : 'pending'}">${e(r(ph.status))}</span></td><td>${e(ph.approved_at || '-')}</td></tr>`; }).join('') + '</table>');
    for (const p of C.phases) { const ph = st.phases[p.id];
      P.push(`<h2>${p.id} \u00b7 ${e(r(p.name))}</h2><p><i>${e(r(p.question))}</i></p>`, RP.mdHtml(ph.draft));
      if (p.questions.length) P.push(`<h3>${e(r("Researcher's decisions"))}</h3><table class="qa">${p.questions.map(q => { const v = ph.answers[q.id]; return `<tr><td>${e(r(q.label))}</td><td>${e(Array.isArray(v) ? v.map(x => r(x)).join('; ') : v ? r(v) : '-')}</td></tr>`; }).join('')}</table>`);
      if (ph.ai_q.length) P.push(`<h3>${e(r('Questions raised and answered'))}</h3><table>${ph.ai_q.map((q, k) => `<tr><td>${e(q)}</td><td>${e(ph.ai_a[k] || '')}</td></tr>`).join('')}</table>`);
      if (nz(ph.notes)) P.push(`<h3>${e(r('Notes'))}</h3><p>${e(ph.notes)}</p>`);
      if (p.id === 'N') { const pr = P_prisma(st); if (pr) P.push(`<h3>${e(r('PRISMA 2020 flow'))}</h3><div style="max-width:560px">` + prRows(pr).map(x => `<div style="border:1px solid #14213D;border-radius:6px;padding:8px 10px;margin:6px 0"><b>${e(r(x[0]))}</b><br>n = ${pv(pr[x[1]])}</div>`).join('') + '</div>');
        const f = dsFind(st); if (f) P.push(`<p><b>${e(f.text)}</b></p>` + (f.rows.length ? tbl(['Record', 'DOI', 'Notice', 'Status'], f.rows) : '')); }
      if (p.id === 'A') { const fr = findReport(st); if (fr) P.push(`<h3>${e(r('How the focal article was chosen'))}</h3><p>${e(fr.text)}</p>`, tbl(fr.table.cols, fr.table.rows), `<p class="cap">${e(fr.note)}</p>`); }
      if (p.id === 'R') P.push(`<h3>${e(r('Data availability statement'))}</h3><p>${e(dataAvailability(st))}</p>`);
      const its = itemsFor(st, p.id); if (['C', 'H', 'O'].includes(p.id) && its.length) { P.push(`<h3>${e(r(p.id === 'C' ? 'Bibliometric figures and tables' : p.id === 'H' ? 'Research-front trend' : 'Analysis results'))}</h3>`);
        its.forEach(it => P.push('<div class="fig">' + (it.png ? `<img src="${pngUri(it.png)}" alt="${e(it.label)}">` : '') + `<p class="cap"><b>${e(it.label)}.</b> ${e(it.note || '')}</p>` + (it.table ? tbl(it.table.cols, it.table.rows, 15) : '') + '</div>')); }
      const L = lessonsData(p.id, st);
      P.push(`<div class="lessons"><h3>${e(r("Lessons learned & what's in it for me"))}</h3><ul>${L.lessons.map(x => `<li>${e(r(x))}</li>`).join('')}</ul><p><b>${e(r("What's in it for me:"))}</b> ${e(r(L.wiifm))}</p>` +
        (L.my_lessons ? `<p><b>${e(r('My lessons learned:'))}</b> ${e(L.my_lessons)}</p>` : '') + (L.my_wiifm ? `<p><b>${e(r("What's in it for me (my view):"))}</b> ${e(L.my_wiifm)}</p>` : '') +
        `<p class="cap"><b>${e(r('References'))}</b></p><ol class="refs">${L.refs.concat(L.acc).map(x => `<li>${e(O.refApa(x))}${flagged(x) ? ` <b style="color:#B3261E">[${e(O.statusLabel(x))}]</b>` : ''}</li>`).join('')}</ol></div>`);
    }
    const pt = prereqTables(st);
    P.push(`<h2>${e(r('Appendix: researcher, resources and licences'))}</h2><p class="cap">${e(r("Recorded on the Before you start page. Licence summaries are short and not legal advice; follow each provider's terms."))}</p>`);
    Object.keys(pt).forEach(k => P.push(`<h3>${e(r(k))}</h3>`, tbl(pt[k].cols, pt[k].rows)));
    P.push(`<h2>${e(r('Decision log'))}</h2>`, st.decisions.length ? tbl(['Time', 'Phase', 'Decision', 'Note'], st.decisions.map(d => [d.time, d.phase, d.decision, d.note]), 2000) : `<p>${e(r('No decisions yet.'))}</p>`);
    P.push(`<h2>${e(r('AI-use disclosure'))}</h2><pre>${e(RP.disclosure(st))}</pre>`);
    P.push(`<h2>${e(r('Prompt log'))}</h2>`, st.prompts.length ? st.prompts.map(x => `<h3>${e(x.time)} \u00b7 ${e(r('phase'))} ${e(x.phase)} \u00b7 ${e(x.mode)}</h3><pre>${e(x.prompt.slice(0, 4000))}</pre>`).join('') : `<p>${e(r('No prompts were used.'))}</p>`);
    P.push(`<p class="brandfoot">${e(r('Generated with'))} ${e(S.APP_BRAND)} ${S.APP_VERSION} &middot; ${e(S.APP_TAGLINE)}</p></body></html>`);
    return P.join('\n');
  };
  const P_prisma = st => root.P.prisma(st);
  const pv = x => (x === undefined || x === null || (typeof x === 'number' && isNaN(x))) ? 'pending' : x;
  const PRISMA_ROWS = [['Records identified from databases', 'identified'], ['Duplicates removed', 'duplicates'], ['Retracted records removed (retraction check)', 'retracted'], ['Records removed by filters (year, type, language)', 'filtered'], ['Records screened (title/abstract)', 'screened'],
    ['Records excluded at screening', 'excluded_screen'], ['Reports assessed for eligibility', 'assessed'], ['Reports excluded (with reasons)', 'excluded_full'], ['Studies included in the review', 'included']];
  const prRows = pr => PRISMA_ROWS.filter(x => x[1] !== 'retracted' || pr.retracted > 0);
  // the retraction check and any retracted records the researcher excluded (same wording as the desktop report)
  const dsFind = st => {
    const d = st.online_ds_mobile; const rr = (st.biblio && st.biblio.retracted_removed) || []; if (!d && !rr.length) return null;
    const gone = new Set(rr.map(x => x.doi)); const fl = d ? d.flagged.filter(x => !gone.has(root.O.norm(x.doi))) : []; const txt = [];
    if (rr.length) txt.push(`${rr.length} retracted record(s) were excluded from the bibliometric analyses (${rr[0].removed_at}) and are counted in the PRISMA flow.`);
    if (d) txt.push(!fl.length ? `Retraction check of the bibliometric dataset (${d.checked_at}): ${d.n_doi} of ${d.n_records} records have a DOI; ${rr.length ? 'no retracted record remains' : 'none is retracted'} according to OpenAlex.`
      : `Retraction check of the bibliometric dataset (${d.checked_at}): ${fl.length} retracted record(s) found among ${d.n_doi} records with a DOI and kept in the analyses.`);
    return { text: txt.join(' '), rows: rr.map(x => [x.record, x.doi, x.notice, 'excluded']).concat(fl.map(x => [x.record, x.doi, x.notice, 'kept'])) };
  };

  // ---------- Word (.docx), written as WordprocessingML
  const xe = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function runs(text, o) { o = o || {}; const rp = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.sz ? `<w:sz w:val="${o.sz}"/>` : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (RL === 'ar' ? '<w:rtl/>' : '');
    // **bold** inside the text
    return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(part => { const bold = /^\*\*[^*]+\*\*$/.test(part); const tx = bold ? part.slice(2, -2) : part;
      return `<w:r><w:rPr>${rp}${bold && !o.b ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${xe(tx)}</w:t></w:r>`; }).join(''); }
  const para = (text, style, o) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${RL === 'ar' ? '<w:bidi/>' : ''}</w:pPr>${runs(text, o)}</w:p>`;
  function wtable(cols, rows, n) {
    const cell = (v, head) => `<w:tc><w:tcPr><w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="D5D9DF"/></w:tcBorders>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="ECE8DE"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/>${RL === 'ar' ? '<w:bidi/>' : ''}</w:pPr>${runs(v === null || v === undefined ? '' : String(v), { b: head, sz: 18 })}</w:p></w:tc>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${RL === 'ar' ? '<w:bidiVisual/>' : ''}<w:tblBorders><w:top w:val="single" w:sz="8" w:color="14213D"/><w:bottom w:val="single" w:sz="8" w:color="14213D"/></w:tblBorders></w:tblPr>` +
      `<w:tr>${cols.map(c => cell(c, true)).join('')}</w:tr>${rows.slice(0, n || 200).map(rw => `<w:tr>${rw.map(c => cell(c, false)).join('')}</w:tr>`).join('')}</w:tbl>` + para('');
  }
  RP.docx = async function (st) {
    const zip = new root.JSZip(); const body = []; const media = []; const a = st.article;
    const img = (png, label) => { const id = 'rImg' + (media.length + 1); const name = 'image' + (media.length + 1) + '.png'; media.push({ id: id, name: name, png: png });
      const dim = pngSize(png); const cx = 5760000, cy = Math.round(cx * dim.h / dim.w);
      return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${media.length}" name="${xe(label)}" descr="${xe(label)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${media.length}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`; };
    const md = txt => { const bl = mdBlocks(AI.stripQ(txt || '')); if (!bl.length) return para(r('Not completed.'), null, { i: true });
      return bl.map(b => b.t === 'h' ? para(b.text, b.level <= 3 ? 'Heading2' : 'Heading3') : b.t === 'p' || b.t === 'quote' ? para(b.text) : b.t === 'pre' ? b.text.split('\n').map(l => para(l, null, { sz: 18 })).join('')
        : b.t === 'table' ? wtable(b.head, b.rows) : b.items.map((x, k) => para((b.t === 'ol' ? (k + 1) + '. ' : '\u2022 ') + x)).join('')).join(''); };
    body.push(para(r('ANCHOR review report'), 'Title'), para(a.title || ''), para(`${st.setup.S_name || S.name()} \u00b7 ${r('generated')} ${U.today()} ${r('with')} ${S.APP_BRAND} ${S.APP_VERSION}`), para(r('Focal article:') + ' ' + (a.citation || '')), para(RP.onlineNote(st), null, { sz: 18, color: '5B6675' }));
    for (const p of C.phases) { const ph = st.phases[p.id];
      body.push(para(`${p.id} \u00b7 ${r(p.name)} (${r(ph.status)})`, 'Heading1'), para(r(p.question), null, { i: true }), md(ph.draft));
      if (p.questions.length) { body.push(para(r("Researcher's decisions"), 'Heading2')); p.questions.forEach(q => { const v = ph.answers[q.id]; body.push(para(`${r(q.label)}: ${Array.isArray(v) ? v.map(x => r(x)).join('; ') : v ? r(v) : '-'}`)); }); }
      if (ph.ai_q.length) { body.push(para(r('Questions raised and answered'), 'Heading2'), wtable(['Question', 'Answer'], ph.ai_q.map((q, k) => [q, ph.ai_a[k] || '']))); }
      if (nz(ph.notes)) body.push(para(r('Notes'), 'Heading2'), para(ph.notes));
      if (p.id === 'A') { const fr = findReport(st); if (fr) body.push(para(r('How the focal article was chosen'), 'Heading2'), para(fr.text), wtable(fr.table.cols, fr.table.rows), para(fr.note, null, { sz: 18 })); }
      if (p.id === 'N') { const pr = P_prisma(st); if (pr) body.push(para(r('PRISMA 2020 flow'), 'Heading2'), wtable(['Stage', 'n'], prRows(pr).map(x => [x[0], pv(pr[x[1]])]))); const f = dsFind(st); if (f) { body.push(para(f.text, null, { b: true })); if (f.rows.length) body.push(wtable(['Record', 'DOI', 'Notice', 'Status'], f.rows)); } }
      if (p.id === 'R') body.push(para(r('Data availability statement'), 'Heading2'), para(dataAvailability(st)));
      if (['C', 'H', 'O'].includes(p.id)) itemsFor(st, p.id).forEach(it => { body.push(para(it.label, 'Heading2')); if (it.png) body.push(img(it.png, it.label)); if (it.note) body.push(para(it.note, null, { sz: 18, color: '5B6675' })); if (it.table) body.push(wtable(it.table.cols, it.table.rows, 15)); });
      const L = lessonsData(p.id, st);
      body.push(para(r("Lessons learned & what's in it for me"), 'Heading2'), L.lessons.map(x => para('\u2022 ' + r(x))).join(''), para(r("What's in it for me:") + ' ' + r(L.wiifm)),
        L.my_lessons ? para(r('My lessons learned:') + ' ' + L.my_lessons) : '', L.my_wiifm ? para(r("What's in it for me (my view):") + ' ' + L.my_wiifm) : '', para(r('References'), 'Heading3'),
        L.refs.concat(L.acc).map(x => para(O.refApa(x) + (flagged(x) ? ` [${O.statusLabel(x)}]` : ''), null, { sz: 18 })).join(''));
    }
    body.push(para(r('Appendix: researcher, resources and licences'), 'Heading1'), para(r("Recorded on the Before you start page. Licence summaries are short and not legal advice; follow each provider's terms.")));
    const pt = prereqTables(st); Object.keys(pt).forEach(k => body.push(para(r(k), 'Heading2'), wtable(pt[k].cols, pt[k].rows)));
    body.push(para(r('Decision log'), 'Heading1'), st.decisions.length ? wtable(['Time', 'Phase', 'Decision', 'Note'], st.decisions.map(d => [d.time, d.phase, d.decision, d.note]), 2000) : para(r('No decisions yet.')));
    body.push(para(r('AI-use disclosure'), 'Heading1'), RP.disclosure(st).split('\n').filter(Boolean).map(l => para(l)).join(''));
    body.push(para(r('Prompt log'), 'Heading1'), st.prompts.length ? st.prompts.map(x => para(`${x.time} \u00b7 ${r('phase')} ${x.phase} \u00b7 ${x.mode}`, 'Heading3') + x.prompt.slice(0, 4000).split('\n').map(l => para(l, null, { sz: 16 })).join('')).join('') : para(r('No prompts were used.')));
    body.push(para(''), para(`${r('Generated with')} ${S.APP_BRAND} ${S.APP_VERSION} \u00b7 ${S.APP_TAGLINE}`, null, { sz: 18, color: '5B6675' }));
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rFoot"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>${RL === 'ar' ? '<w:bidi/>' : ''}</w:sectPr></w:body></w:document>`;
    const font = RL === 'ar' ? 'Arial' : 'Calibri';
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="Arial"/><w:sz w:val="22"/><w:color w:val="14213D"/><w:lang w:val="${RL === 'de' ? 'de-DE' : 'en-GB'}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="48"/></w:rPr></w:style>` +
      [1, 2, 3].map(k => `<w:style w:type="paragraph" w:styleId="Heading${k}"><w:name w:val="heading ${k}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${[0, 360, 240, 200][k]}" w:after="120"/><w:outlineLvl w:val="${k - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="${[0, 34, 28, 24][k]}"/>${k === 1 ? '<w:color w:val="14213D"/>' : '<w:color w:val="B4561A"/>'}</w:rPr></w:style>`).join('') + '</w:styles>';
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="5B6675"/></w:rPr><w:t>${xe(S.APP_BRAND)}</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe('ANCHOR review - ' + (a.title || ''))}</dc:title><dc:creator>${xe(st.setup.S_name || S.name())}</dc:creator><cp:lastModifiedBy>${xe(S.APP_BRAND)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
    zip.file('word/document.xml', doc); zip.file('word/styles.xml', styles); zip.file('word/footer1.xml', footer);
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rFoot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      media.map(m => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('') + '</Relationships>');
    media.forEach(m => zip.file('word/media/' + m.name, m.png));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  };
  function pngSize(b) { if (b && b.length > 24 && b[0] === 0x89) { const dv = new DataView(b.buffer, b.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20) }; } return { w: 1500, h: 930 }; }

  // ---------- BibTeX
  const bibEsc = x => String(x === null || x === undefined ? '' : x).replace(/[{}]/g, '').replace(/\\/g, '').replace(/([&%$#_])/g, '\\$1');
  const accKey = doi => 'acc' + String(doi).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  function refBib(key, rf) {
    let a = String(rf.au || '').replace(/\.\.\.\s*/g, '').split(/(?<=\.),\s*(?:&\s*)?|,\s*&\s*/).map(s => s.trim()).filter(Boolean).map(bibEsc).map(x => x.indexOf(',') >= 0 ? x : '{' + x + '}');
    if (/\.\.\./.test(rf.au || '')) a.push('others');
    const f = [['author', a.join(' and ')], ['year', rf.year], ['title', '{' + bibEsc(rf.title) + '}'], ['journal', bibEsc(rf.journal)], ['volume', rf.vol], ['number', rf.iss], ['pages', String(rf.pages || '').replace(/-/g, '--')], ['doi', rf.doi]].filter(x => x[1] !== null && x[1] !== undefined && String(x[1]) !== '');
    return '@article{' + key + ',\n' + f.map(x => `  ${x[0]} = {${x[1]}}`).join(',\n') + '\n}';
  }
  const titleCase = s => (root.BX && root.BX.titleCase) ? root.BX.titleCase(String(s).toLowerCase()) : String(s);
  function bibAuthors(au) { const a = String(au || '').split(';').map(s => s.trim()).filter(Boolean);
    return a.map(x => { const p = x.split(' '); if (p.length < 2) return titleCase(x); const ini = p[p.length - 1]; const sur = p.slice(0, -1).join(' '); if (!/^[A-Z]{1,4}$/.test(ini)) return titleCase(x);
      return titleCase(sur) + ', ' + ini.split('').map(c => c + '.').join(' '); }).join(' and '); }
  RP.bib = function (st) {
    const a = st.article; const m = /^(.+?) \((\d{4})[a-z]?\)\. (.+?)\. ([^.]+?), (\d+)(?:\((\d+)\))?, ([0-9A-Za-z-]+)\.?/.exec(a.citation || '');
    const focal = m ? `@article{focal,\n  author = {${bibEsc(m[1].split(/(?<=\.),\s*(?:&\s*)?|\s+&\s+/).map(s => s.trim()).join(' and '))}},\n  year = {${m[2]}},\n  title = {{${bibEsc(a.title || m[3])}}},\n  journal = {${bibEsc(m[4])}},\n  volume = {${m[5]}},\n  number = {${m[6] || ''}},\n  pages = {${m[7].replace(/-/g, '--')}},\n  doi = {${bibEsc(a.doi)}}\n}`
      : `@misc{focal,\n  title = {{${bibEsc(a.title)}}},\n  note = {${bibEsc(a.citation)}},\n  doi = {${bibEsc(a.doi)}}\n}`;
    const fixed = [focal, '@article{aria2017,\n  author = {Aria, Massimo and Cuccurullo, Corrado},\n  year = {2017},\n  title = {bibliometrix: An {R}-tool for comprehensive science mapping analysis},\n  journal = {Journal of Informetrics},\n  volume = {11},\n  number = {4},\n  pages = {959--975},\n  doi = {10.1016/j.joi.2017.08.007}\n}',
      '@misc{kastour2026,\n  author = {Kastour, Amira Mamdouh},\n  year = {2026},\n  title = {{ANCHOR}: A replicable framework for {AI}-assisted article-anchored literature reviews},\n  note = {ANCHOR Studio software}\n}'];
    Object.keys(C.refs).filter(k => k !== 'aria2017').forEach(k => fixed.push(refBib(k, O.refLive(k, st))));
    const seen = new Set(); S.PHASE_IDS.forEach(id => (st.phases[id].accepted || []).forEach(rf => { if (seen.has(rf.doi)) return; seen.add(rf.doi); fixed.push(refBib(accKey(rf.doi), rf)); }));
    const M = st.biblio.M; const recs = [];
    if (M && M.n) { const g = f => M[f] || new Array(M.n).fill(null); const AU = g('AU'), TI = g('TI'), SO = g('SO'), PY = g('PY'), VL = g('VL'), DI = g('DI'), DT = g('DT').map(x => String(x || '').toUpperCase()), BP = g('BP'), EP = g('EP'), PP = g('PP');
      const used = new Map();
      for (let i = 0; i < M.n; i++) {
        const first = (String(AU[i] || '').split(/[ ,;]/)[0] || '').replace(/[^A-Za-z]/g, '').toLowerCase() || 'anon';
        const w = ((String(TI[i] || '').split(' ').filter(z => z.length > 3)[0]) || '').replace(/[^A-Za-z]/g, '').toLowerCase();
        let key = first + (PY[i] === null ? '' : PY[i]) + w; const c = used.get(key) || 0; used.set(key, c + 1); if (c) key += '_' + c;
        const pages = BP[i] ? BP[i] + (EP[i] ? '--' + EP[i] : '') : (PP[i] || '');
        const type = /CONFERENCE|PROCEEDINGS/.test(DT[i]) ? 'inproceedings' : /BOOK CHAPTER/.test(DT[i]) ? 'incollection' : DT[i] === 'BOOK' ? 'book' : 'article';
        const venue = type === 'article' ? 'journal' : type === 'book' ? 'publisher' : 'booktitle';
        const sc = s => { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
        const f = [['author', bibAuthors(AU[i])], ['year', PY[i]], ['title', TI[i] ? '{' + bibEsc(sc(TI[i])) + '}' : null], [venue, SO[i] ? bibEsc(titleCase(SO[i])) : null], ['volume', VL[i]], ['pages', pages], ['doi', DI[i] ? bibEsc(DI[i]) : null]]
          .filter(x => x[1] !== null && x[1] !== undefined && String(x[1]) !== '');
        recs.push('@' + type + '{' + key + ',\n' + f.map(x => `  ${x[0]} = {${x[1]}}`).join(',\n') + '\n}'); } }
    return [`% ${S.APP_BRAND} ${S.APP_VERSION} - references.`, '% focal, the stage references and any references you added are cited in the report;',
      `% the other ${recs.length} entries are the bibliometric records (titles converted from capitals to sentence case: check acronyms).`, ''].concat(fixed, [''], recs).join('\n');
  };

  // ---------- LaTeX package for Overleaf
  const texEsc = x => String(x === null || x === undefined ? '' : x).replace(/\\/g, '\u0001').replace(/([&%$#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}').replace(/>/g, '\\textgreater{}').replace(/\u0001/g, '\\textbackslash{}');
  const texInline = s => texEsc(s).replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1\\emph{$2}').replace(/`([^`]+)`/g, '\\texttt{$1}');
  function texTable(cols, rows, n, size) { rows = rows.slice(0, n || 15); if (!cols.length || !rows.length) return '';
    const num = cols.map((c, j) => rows.every(rw => rw[j] === null || rw[j] === undefined || typeof rw[j] === 'number'));
    return [`{${size || '\\small'}\\begin{tabularx}{\\linewidth}{${num.map(x => (x ? 'r' : 'X')).join('')}}\\toprule`, cols.map(c => `\\textbf{${texEsc(c)}}`).join(' & ') + '\\\\\\midrule',
      rows.map(rw => rw.map(v => texEsc(v === null || v === undefined ? '' : String(v).trim())).join(' & ') + '\\\\').join('\n'), '\\bottomrule\\end{tabularx}}'].join('\n'); }
  function mdTex(md) { const bl = mdBlocks(AI.stripQ(md || '')); if (!bl.length) return '\\emph{Not completed.}\n';
    return bl.map(b => b.t === 'h' ? (b.level <= 3 ? `\\subsection{${texInline(b.text)}}` : `\\subsubsection{${texInline(b.text)}}`) : b.t === 'p' ? texInline(b.text) + '\n' : b.t === 'quote' ? `\\begin{quote}${texInline(b.text)}\\end{quote}`
      : b.t === 'pre' ? '\\begin{verbatim}\n' + b.text.replace(/\\end\{verbatim\}/g, '') + '\n\\end{verbatim}' : b.t === 'table' ? texTable(b.head, b.rows.map(rw => rw.map(c => c.replace(/\*\*|__|`/g, ''))), 200)
      : `\\begin{${b.t === 'ol' ? 'enumerate' : 'itemize'}}\n${b.items.map(x => '\\item ' + texInline(x)).join('\n')}\n\\end{${b.t === 'ol' ? 'enumerate' : 'itemize'}}`).join('\n'); }
  RP.latexZip = async function (st) {
    const zip = new root.JSZip(); const dir = 'ANCHOR_' + U.safeName(st.article.title) + '/'; const a = st.article; const s = st.setup;
    const figNames = st.report_items.map((it, k) => { if (!it.png) return null; const nm = `fig${String(k + 1).padStart(2, '0')}_${U.safeName(it.label, 30)}.png`; zip.file(dir + 'figures/' + nm, it.png); return nm; });
    const L = ['% ANCHOR Studio - review content. \\input{content} from main.tex or from your journal template.', '% Needs: graphicx, booktabs, tabularx, float, hyperref (see README.txt).', '',
      `\\noindent\\textbf{Focal article:} ${texEsc(a.citation)}~\\cite{focal}`, '', `{\\small\\emph{${texEsc(RP.onlineNote(st))}}}`, '', '\\section*{Progress and decisions}',
      texTable(['Phase', 'Status', 'Approved'], C.phases.map(p => [p.id + ' ' + p.name, st.phases[p.id].status, st.phases[p.id].approved_at || '--'])), ''];
    for (const p of C.phases) { const ph = st.phases[p.id];
      L.push(`\\section{${p.id}: ${texEsc(p.name)}}`, `\\emph{${texEsc(p.question)}}\n`, mdTex(ph.draft));
      if (p.questions.length) L.push("\\subsection*{Researcher's decisions}", texTable(['Question', 'Answer'], p.questions.map(q => [q.label, Array.isArray(ph.answers[q.id]) ? ph.answers[q.id].join('; ') : ph.answers[q.id] || '-']), 50));
      if (nz(ph.notes)) L.push('\\subsection*{Notes}', texEsc(ph.notes));
      const Ld = lessonsData(p.id, st); const keys = Ld.refs.map(x => x.key).concat(Ld.acc.map(x => accKey(x.doi)));
      L.push("\\subsection*{Lessons learned \\& what's in it for me}", '\\begin{itemize}', Ld.lessons.map(x => '\\item ' + texEsc(x)).join('\n'), '\\end{itemize}', `\\textbf{What's in it for me:} ${texEsc(Ld.wiifm)}\n`,
        Ld.my_lessons ? `\\textbf{My lessons learned:} ${texEsc(Ld.my_lessons)}\n` : '', Ld.my_wiifm ? `\\textbf{What's in it for me (my view):} ${texEsc(Ld.my_wiifm)}\n` : '',
        `\\textbf{References:} \\cite{${keys.join(',')}}.` + Ld.refs.concat(Ld.acc).filter(flagged).map(x => ` \\textbf{${texEsc(x.title)}: ${texEsc(O.statusLabel(x))}.}`).join('') + '\n');
      if (p.id === 'N') { const pr = P_prisma(st); if (pr) L.push('\\subsection*{PRISMA 2020 flow}', texTable(['Stage', 'n'], prRows(pr).map(x => [x[0], String(pv(pr[x[1]]))]))); }
      if (p.id === 'A') { const fr = findReport(st); if (fr) L.push('\\subsection*{How the focal article was chosen}', texEsc(fr.text), '', texTable(fr.table.cols, fr.table.rows, 10, '\\footnotesize'), texEsc(fr.note), ''); }
      if (p.id === 'R') L.push('\\subsection*{Data availability statement}', texEsc(dataAvailability(st)), '');
      if (['C', 'H', 'O'].includes(p.id) && itemsFor(st, p.id).length) { L.push(p.id === 'C' ? '\\subsection*{Bibliometric figures and tables}' : p.id === 'H' ? '\\subsection*{Research-front trend}' : '\\subsection*{Analysis results}');
        st.report_items.forEach((it, k) => { if ((it.phase || 'C') !== p.id) return;
          if (figNames[k]) L.push('\\begin{figure}[H]\\centering', `\\includegraphics[width=\\linewidth]{figures/${figNames[k]}}`, `\\caption{${texEsc(it.label)}.${it.note ? ' ' + texEsc(it.note) : ''}}`, '\\end{figure}');
          else L.push(`\\paragraph{${texEsc(it.label)}.} ${texEsc(it.note)}`);
          if (it.table) L.push(texTable(it.table.cols, it.table.rows, 15, '\\footnotesize'), ''); }); }
    }
    const pt = prereqTables(st);
    L.push('\\section*{Appendix: researcher, resources and licences}', "{\\small Recorded on the Before you start page. Licence summaries are short and not legal advice; follow each provider's terms.}", '');
    Object.keys(pt).forEach(k => L.push(`\\subsection*{${texEsc(k)}}`, texTable(pt[k].cols, pt[k].rows, 200, '\\footnotesize')));
    L.push('\\section*{Decision log}', st.decisions.length ? texTable(['time', 'phase', 'decision', 'note'], st.decisions.map(d => [d.time, d.phase, d.decision, d.note]), 500, '\\footnotesize') : 'No decisions yet.',
      '\\section*{AI-use disclosure}', '\\begin{quote}\\small', RP.disclosure(st).split('\n').map(texEsc).join('\\\\\n'), '\\end{quote}',
      'Bibliometric analyses: bibliometrix~\\cite{aria2017}; framework: ANCHOR~\\cite{kastour2026}.', '', '\\section*{Prompt log}',
      st.prompts.length ? st.prompts.map(x => `\\subsection*{${texEsc(x.time)}, phase ${texEsc(x.phase)}, ${texEsc(x.mode)}}\n{\\footnotesize\n${x.prompt.slice(0, 4000).split('\n').map(texEsc).join('\\\\\n')}\n}`).join('\n') : 'No prompts were used.');
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const main = ['% !TEX program = xelatex', '% ANCHOR Studio report. Compile with XeLaTeX or LuaLaTeX (Overleaf: picked automatically from latexmkrc).', '\\documentclass[11pt,a4paper]{article}', '\\usepackage{iftex}',
      '\\ifPDFTeX', '  \\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\\usepackage{textcomp}\\IfFileExists{lmodern.sty}{\\usepackage{lmodern}}{}', '\\else', '  \\usepackage{fontspec}',
      '  \\IfFontExistsTF{Libertinus Serif}{\\setmainfont{Libertinus Serif}}{\\IfFontExistsTF{Noto Serif}{\\setmainfont{Noto Serif}}{}}',
      st.prompts.concat([{ prompt: JSON.stringify(st.phases) }]).some(x => /[\u0600-\u06FF]/.test(x.prompt)) ? '  \\IfFontExistsTF{Amiri}{\\newfontfamily\\arabicfont[Script=Arabic]{Amiri}}{\\IfFontExistsTF{Noto Naskh Arabic}{\\newfontfamily\\arabicfont[Script=Arabic]{Noto Naskh Arabic}}{}}' : '%',
      '\\fi', '\\usepackage[margin=2.5cm]{geometry}', '\\usepackage{graphicx,booktabs,tabularx,float,xcolor}', '\\usepackage[hidelinks]{hyperref}',
      '\\setlength{\\parindent}{0pt}\\setlength{\\parskip}{0.5em}', `\\title{${texEsc(a.title || 'ANCHOR review')}}`, `\\author{${texEsc(s.S_name || S.name())}${s.S_inst ? '\\\\\\small ' + texEsc(s.S_inst) : ''}}`,
      `\\date{Generated ${date} with ${texEsc(S.APP_BRAND)} ${S.APP_VERSION}}`,
      `\\IfFileExists{fancyhdr.sty}{\\usepackage{fancyhdr}\\pagestyle{fancy}\\fancyhf{}\\renewcommand{\\headrulewidth}{0pt}\\fancyfoot[L]{\\footnotesize ${texEsc(S.APP_BRAND)}}\\fancyfoot[R]{\\footnotesize\\thepage}\\fancypagestyle{plain}{\\fancyhf{}\\fancyfoot[L]{\\footnotesize ${texEsc(S.APP_BRAND)}}\\fancyfoot[R]{\\footnotesize\\thepage}\\renewcommand{\\headrulewidth}{0pt}}}{}`,
      '\\begin{document}', '\\maketitle', '\\input{content}', '', '\\bibliographystyle{apalike}', '\\bibliography{references}', '\\end{document}'].join('\n');
    zip.file(dir + 'main.tex', main); zip.file(dir + 'content.tex', L.join('\n')); zip.file(dir + 'references.bib', RP.bib(st));
    zip.file(dir + 'latexmkrc', '# XeLaTeX (Overleaf and latexmk read this file)\n$pdf_mode = 5;\n$bibtex_use = 2;\n');
    zip.file(dir + 'README.txt', [`${S.APP_BRAND} ${S.APP_VERSION} - LaTeX package (made with ANCHOR Mobile)`, '', 'main.tex         complete document (title, \\input{content}, references)',
      'content.tex      the review itself, with no preamble - put it into any journal template', 'references.bib   focal article, bibliometrix, ANCHOR, plus every bibliometric record',
      'figures/         report figures (PNG)', 'latexmkrc        tells Overleaf and latexmk to use XeLaTeX', '', 'OVERLEAF: New Project > Upload Project > choose this .zip. It compiles with XeLaTeX automatically.', '',
      'LOCAL TeX (TeX Live, MiKTeX, MacTeX): latexmk main.tex   (or: xelatex main, bibtex main, xelatex main, xelatex main)', '',
      'JOURNAL TEMPLATE: copy content.tex, figures/ and references.bib next to the template\'s main file, add', '  \\usepackage{graphicx,booktabs,tabularx,float,hyperref}',
      'to its preamble, put \\input{content} where the text goes, and use the template\'s own \\bibliography command.'].join('\n'));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  };
  root.RP = RP;
})(window);
