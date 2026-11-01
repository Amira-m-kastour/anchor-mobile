/* ANCHOR Mobile - Proposal / thesis tab: the model, the checks and the exports (Word on your template, HTML to print as PDF,
   LaTeX package). A port of ANCHOR Studio's R/proposal.R and R/proposal_out.R; the proposal is stored in the project in the
   same shape, so it opens in either app. Decisions (Proposal and Thesis Tab Audit, 31 Oct 2026): proposal first; any Word
   template plus one preset; AI use marked everywhere (the tab drafts nothing); attachments up to 20 MB; citation style from the
   preset or your choice; language per document; the same tab on the phone. */
(function (root) {
  'use strict';
  const PR = {}; const S = root.S, U = root.U, O = root.O, AI = root.AI;
  const PW = l => (root.ANCHOR_PROP_WORDS || {})[l] || (root.ANCHOR_PROP_WORDS || {}).en;
  PR.MAX = 20 * 1024 * 1024;
  PR.PHASES = ['A', 'N', 'C', 'H', 'O', 'R'];
  const LAYOUT = { font: 'Times New Roman', size: 12, line: 1.5, margins: { l: 2.5, r: 2.5, t: 2.5, b: 2.5 } };
  PR.PRESETS = {
    general: { name: 'Research proposal (general outline)', cite: 'apa', toc: true, page_limit: null, layout: LAYOUT,
      sections: [['intro', ['A', 'H']], ['rq', ['H']], ['state', ['N', 'C']], ['method', ['O']], ['timeline'], ['resources'], ['ethics'], ['contribution'], ['appendix']] },
    fernuni_expose: { name: 'FernUniversit\u00e4t in Hagen, Expos\u00e9 (Politikwissenschaft I guide)', cite: 'apa', toc: false, page_limit: 8, layout: LAYOUT,
      source: 'https://www.fernuni-hagen.de/KSW/bapo/studieninhalte/2014ws/pdf/leitfaden-expose.pdf',
      sections: [['intro', ['H', 'A']], ['concepts', ['C']], ['state', ['N', 'C']], ['outline']] }
  };
  PR.KINDS = ['intro', 'rq', 'concepts', 'state', 'method', 'outline', 'timeline', 'resources', 'ethics', 'contribution', 'text', 'appendix'];
  let seq = 0; const pid = () => 's' + Date.now() + (100 + (seq++ % 900));
  PR.section = (kind, lang, links) => ({ id: pid(), kind: kind, title: (PW(lang).kinds || {})[kind] || kind, links: links || [], link_text: {}, text: '', figs: [] });

  // the text of a phase as it goes into a proposal: the draft without the model's questions
  PR.phaseText = (st, j) => AI.stripQ((st.phases[j] || {}).draft || '').trim();
  PR.linkNow = (s, st) => { s.link_text = {}; s.links.forEach(j => { s.link_text[j] = PR.phaseText(st, j); }); return s; };
  PR.stale = (s, st) => s.links.filter(j => (s.link_text[j] || '') !== PR.phaseText(st, j));
  PR.create = function (preset, lang, st) {
    const p = PR.PRESETS[preset] || PR.PRESETS.general;
    return { kind: 'proposal', preset: preset, lang: lang, cite_style: p.cite, toc: p.toc, page_limit: p.page_limit, word_limit: null, layout: JSON.parse(JSON.stringify(p.layout)),
      template: null, only_cited: true, title: st.article.title || '', subtitle: '', author: st.setup.S_name || (st.prereq && st.prereq.name) || '', programme: '', supervisor: '', place: '',
      sections: p.sections.map(x => PR.linkNow(PR.section(x[0], lang, (x[1] || []).slice()), st)), milestones: [], attachments: [], refs: [], created: U.now() };
  };
  // AI provenance of a phase's current text, from the versions of its draft (and the prompt log for older projects)
  PR.phaseAI = function (st, j) {
    const v = (st.draft_versions || []).filter(x => x.phase === j); const ai = v.filter(x => /^AI /.test(x.source)); const cur = (st.phases[j] || {}).draft || '';
    if (!ai.length) return (st.prompts || []).some(x => x.phase === j) ? { ai: true, unchanged: false, tool: '' } : { ai: false };
    const m = /\((.*)\)$/.exec(ai[ai.length - 1].source); return { ai: true, unchanged: ai.some(x => x.text === cur), tool: m ? m[1] : '' };
  };

  // ---------- words and citations
  const plainMd = x => String(x || '').replace(/\*\*|__|`/g, '');
  PR.countWords = x => plainMd(String(x || '').replace(/^\s*\|?[-:| ]+\|\s*$/gm, '')).replace(/[#|*>]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  PR.sectionText = (s, st) => s.links.map(j => PR.phaseText(st, j)).concat(String(s.text || '').trim() ? [s.text] : []).join('\n\n');
  PR.counts = (pr, st) => pr.sections.filter(s => s.kind !== 'appendix').map(s => ({ section: s.title, words: PR.countWords(PR.sectionText(s, st)) }));
  const firstSurname = a => { a = String(a || '').replace(/\s+et al\.?.*$/, '').trim(); a = a.split(/\s*(?:&|\band\b|\bund\b|,)\s*/)[0] || ''; const w = a.trim().split(/\s+/); return (w[w.length - 1] || '').toLowerCase(); };
  PR.citations = function (x) {
    x = plainMd(x); const out = [];
    (x.match(/\(([^()]*?\d{4}[a-z]?[^()]*?)\)/g) || []).forEach(g => g.replace(/^\(|\)$/g, '').split(';').forEach(part => {
      const m = /^\s*(?:(?:see|e\.g\.,?|cf\.|vgl\.)\s+)?([^,;()0-9]+?)\s*,?\s+(\d{4})[a-z]?\b/.exec(part); if (m) out.push([firstSurname(m[1]), m[2], part.trim()]); }));
    (x.match(/\b([A-Z][\p{L}'\-]+)(?: et al\.| (?:&|and|und) [A-Z][\p{L}'\-]+)? \((\d{4})[a-z]?\)/gu) || []).forEach(mm => { const p = /^(.+?) \((\d{4})/.exec(mm); out.push([firstSurname(p[1]), p[2], mm]); });
    const seen = new Set(); return out.filter(c => { const k = c.join('|'); if (seen.has(k) || !c[0] || ['table', 'figure', 'phase', 'section', 'eq', 'equation', 'model'].includes(c[0])) return false; seen.add(k); return true; })
      .map(c => ({ surname: c[0], year: c[1], text: c[2] }));
  };
  // every reference the proposal can cite: the anchor article, the accepted references of all phases, the built-in method
  // references of the linked phases and the ones you add here
  PR.refPool = function (pr, st) {
    const pool = []; const cit = st.article.citation || ''; const m = /^(.+?) \((\d{4})/.exec(cit);
    if (m) pool.push({ key: 'focal', au: m[1], year: m[2], text: cit, doi: st.article.doi || '' });
    const linked = new Set([].concat(...pr.sections.map(s => s.links)));
    PR.PHASES.forEach(j => { ((st.phases[j] || {}).accepted || []).forEach(r => pool.push(Object.assign({ key: 'acc_' + j }, r)));
      if (linked.has(j) && root.ANCHOR_CONTENT.lessons[j]) (root.ANCHOR_CONTENT.lessons[j].refs || []).forEach(k => pool.push(Object.assign({ key: k }, O.refLive(k, st)))); });
    (pr.refs || []).forEach(r => pool.push(Object.assign({ key: 'added' }, r)));
    pool.forEach(r => { r.surname = firstSurname(String(r.au || '').replace(/,.*$/, '')); r.year = String(r.year === undefined || r.year === null ? '' : r.year); });
    const seen = new Set(); return pool.filter(r => { const k = (String(r.doi || r.title || r.text || '') + ' ' + r.year).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  PR.checkCitations = function (pr, st) {
    const cites = PR.citations(pr.sections.map(s => PR.sectionText(s, st)).join('\n')); const pool = PR.refPool(pr, st);
    const keys = pool.map(r => r.surname + ' ' + r.year); const ck = new Set(cites.map(c => c.surname + ' ' + c.year));
    return { citations: cites, missing: cites.filter(c => !keys.includes(c.surname + ' ' + c.year)), refs: pool.filter((r, i) => ck.has(keys[i]) || r.key === 'added'), unused: pool.filter((r, i) => !ck.has(keys[i]) && r.key !== 'added') };
  };
  PR.formatRef = function (r, style) {
    if (r.text && !r.title) return r.text;                      // the anchor article, already in your chosen style
    if (style === 'harvard') { const au = String(r.au || '').replace(/,\s*&\s*/, ' and ');
      return `${au} (${r.year}) '${String(r.title || '').replace(/\.$/, '')}', ${r.journal || ''}${U.nz(r.vol) ? ', ' + r.vol : ''}${U.nz(r.iss) ? '(' + r.iss + ')' : ''}${U.nz(r.pages) ? ', pp. ' + String(r.pages).replace(/-/g, '\u2013') : ''}${U.nz(r.doi) ? '. doi:' + r.doi : ''}.`; }
    return O.refApa(r);
  };
  // what is still missing before export, as [key, {placeholders}] so the screen can translate it
  PR.checks = function (pr, st) {
    const out = [];
    if (!String(pr.title || '').trim()) out.push(['Give the proposal a title.', {}]);
    pr.sections.forEach(s => { if (s.kind === 'appendix') return;
      if (s.kind === 'timeline' && !pr.milestones.length) out.push(["Section '{s}': add at least one milestone.", { s: s.title }]);
      else if (s.kind !== 'timeline' && !PR.sectionText(s, st).trim()) out.push(["Section '{s}' is empty.", { s: s.title }]);
      s.links.forEach(j => { if ((st.phases[j] || {}).status !== 'approved') out.push(["Section '{s}' uses phase {p}, which is not approved.", { s: s.title, p: j }]); });
      PR.stale(s, st).forEach(j => out.push(["Section '{s}': phase {p} changed since you linked it.", { s: s.title, p: j }])); });
    const cc = PR.checkCitations(pr, st);
    if (cc.missing.length) out.push(['No reference found for: {r}.', { r: Array.from(new Set(cc.missing.map(c => c.text))).join('; ') }]);
    const w = PR.counts(pr, st).reduce((a, c) => a + c.words, 0); const lim = Number(pr.word_limit);
    if (lim > 0 && (w > lim * 1.1 || w < lim * 0.9)) out.push(['{n} words: outside {l} \u00b1 10%.', { n: w, l: lim }]);
    return out;
  };

  // ---------- images: the timeline as a chart, picture sizes
  PR.imgSize = function (b) {
    if (b && b.length > 24 && b[0] === 0x89) { const dv = new DataView(b.buffer, b.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20), ext: 'png' }; }
    if (b && b.length > 4 && b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length - 9) { if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1];
      if ((mk >= 0xc0 && mk <= 0xc3) || (mk >= 0xc5 && mk <= 0xc7) || (mk >= 0xc9 && mk <= 0xcb) || (mk >= 0xcd && mk <= 0xcf)) return { w: b[i + 7] * 256 + b[i + 8], h: b[i + 5] * 256 + b[i + 6], ext: 'jpeg' };
      i += 2 + b[i + 2] * 256 + b[i + 3]; } return { w: 1000, h: 620, ext: 'jpeg' }; }
    return { w: 1000, h: 620, ext: 'png' };
  };
  PR.ganttPng = async function (ms) {
    const d = ms.map(m => ({ task: m.milestone, s: Date.parse(m.start), e: Date.parse(m.end || m.start) })).filter(x => !isNaN(x.s)); if (!d.length) return null;
    d.forEach(x => { if (isNaN(x.e) || x.e < x.s) x.e = x.s; });
    const lo = Math.min(...d.map(x => x.s)), hi = Math.max(...d.map(x => x.e)), span = Math.max(hi - lo, 864e5 * 7);
    const W = 1280, L = 300, Rm = 40, rowH = 64, H = 70 + d.length * rowH, X = v => L + (v - lo) / span * (W - L - Rm);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const months = []; const t0 = new Date(lo); let m = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), 1)); while (m.getTime() <= lo + span) { if (m.getTime() >= lo) months.push(m.getTime()); m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif" font-size="22"><rect width="100%" height="100%" fill="#fff"/>` +
      months.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="10" y2="${H - 40}" stroke="#E5E5E5" stroke-width="2"/><text x="${X(t)}" y="${H - 10}" text-anchor="middle" fill="#555">${new Date(t).toISOString().slice(0, 7)}</text>`).join('') +
      d.map((x, i) => { const y = 40 + i * rowH; return `<line x1="${L - 10}" x2="${W - Rm}" y1="${y}" y2="${y}" stroke="#EEE" stroke-width="2"/><text x="${L - 20}" y="${y + 8}" text-anchor="end" fill="#444">${esc(x.task)}</text>` +
        (x.e > x.s ? `<rect x="${X(x.s)}" y="${y - 14}" width="${Math.max(4, X(x.e) - X(x.s))}" height="28" fill="#B4561A"/>` : `<path d="M${X(x.s)} ${y - 16}l16 16l-16 16l-16 -16z" fill="#14213D"/>`); }).join('') + '</svg>';
    return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(b => { if (!b) return res(null); b.arrayBuffer().then(a => res(new Uint8Array(a))); }, 'image/png'); }; img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  };

  // ---------- everything an export needs, in reading order (the same for Word, HTML and LaTeX)
  PR.parts = async function (st) {
    const pr = st.proposal; const W = PW(pr.lang || 'en'); const items = st.report_items || []; const att = pr.attachments || [];
    const fig = f => { if (f.startsWith('item:')) { const it = items.find(i => i.label === f.slice(5)); return it && it.png ? { raw: it.png, caption: [it.label, it.note].filter(Boolean).join('. ') } : null; }
      const a = att.find(x => x.id === f); return a && a.raw ? { raw: a.raw, caption: a.caption || a.name } : null; };
    const secs = []; let n = 0;
    for (const s of pr.sections) { if (s.kind === 'appendix') continue; n++;
      secs.push({ n: n, title: s.title, md: s.links.map(j => PR.phaseText(st, j)).concat(String(s.text || '').trim() ? [s.text] : []).join('\n\n'),
        figs: (s.figs || []).map(fig).filter(Boolean), milestones: s.kind === 'timeline' && pr.milestones.length ? pr.milestones : null,
        gantt: s.kind === 'timeline' && pr.milestones.length ? await PR.ganttPng(pr.milestones).catch(() => null) : null }); }
    const cc = PR.checkCitations(pr, st); const refs = pr.only_cited === false ? cc.refs.concat(cc.unused) : cc.refs;
    const rt = refs.map(r => PR.formatRef(r, pr.cite_style || 'apa')).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const app = pr.sections.filter(s => s.kind === 'appendix'); const apx = att.filter(a => a.role === 'appendix');
    const ai = []; n = 0;
    pr.sections.forEach(s => { if (s.kind === 'appendix') return; n++;
      s.links.forEach(j => { const a = PR.phaseAI(st, j); if (a.ai) ai.push(`${n} ${s.title} (phase ${j}): ${(a.unchanged ? W.ai_unchanged : W.ai_edited).replace('{tool}', a.tool || '?')}`); }); });
    const apptext = app.map(s => String(s.text || '').trim()).filter(Boolean).join('\n\n');
    return { pr: pr, W: W, sections: secs, refs: rt, appendix_text: apptext, appendix_files: apx.map(a => ({ name: a.name, caption: a.caption || '', raw: /\.(png|jpe?g)$/i.test(a.name) ? a.raw : null })),
      has_appendix: app.length > 0 && (apx.length > 0 || !!apptext), ai: ai, kind_label: pr.preset === 'fernuni_expose' ? W.doc_expose : W.doc_proposal,
      date: (d => `${U.pad(d.getDate())}.${U.pad(d.getMonth() + 1)}.${d.getFullYear()}`)(new Date()) };
  };
  const blocks = md => root.RP.blocks(md);
  const xe = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // ---------- Word: on your template (its styles, title page, headers and page set-up), or the preset's layout
  PR.docx = async function (st) {
    const P = await PR.parts(st); const pr = P.pr; const W = P.W; const lay = pr.layout || LAYOUT; const rtl = pr.lang === 'ar';
    const JSZip = root.JSZip; let tpl = null, styles = null, ids = {};
    if (pr.template && pr.template.raw) { tpl = await JSZip.loadAsync(pr.template.raw); styles = await tpl.file('word/styles.xml').async('string');
      // built-in style names stay English inside the file ("heading 1", "Title", "caption"), whatever the template's language
      const find = names => { for (const nm of names) { const m = new RegExp('<w:style [^>]*w:styleId="([^"]+)"[^>]*>\\s*<w:name w:val="' + nm + '"', 'i').exec(styles); if (m) return m[1]; } return null; };
      ids = { h1: find(['heading 1']), h2: find(['heading 2']), h3: find(['heading 3']), title: find(['Title']), cap: find(['caption']), li: find(['List Bullet']) };
      const h1 = /<w:style [^>]*>\s*<w:name w:val="heading 1"\/>[\s\S]*?<\/w:style>/i.exec(styles); ids.numbered = !!(h1 && /<w:numPr>/.test(h1[0])); }   // the template numbers its chapters itself
    const H = k => (tpl ? ids['h' + k] : 'Heading' + k);
    const media = []; let figN = 0;
    const run = (txt, o) => { o = o || {}; return String(txt).split('**').map((part, k) => part ? `<w:r><w:rPr>${(k % 2 || o.b) ? '<w:b/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${rtl ? '<w:rtl/>' : ''}</w:rPr><w:t xml:space="preserve">${xe(part.replace(/`/g, ''))}</w:t></w:r>` : '').join(''); };
    const para = (txt, style, o) => { o = o || {}; return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${rtl ? '<w:bidi/>' : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}${o.sp ? `<w:spacing w:before="${o.sp[0]}" w:after="${o.sp[1]}" w:line="240" w:lineRule="auto"/>` : ''}</w:pPr>${run(txt, o)}</w:p>`; };
    const tbl = (head, rows) => `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${rtl ? '<w:bidiVisual/>' : ''}<w:tblBorders>${['top', 'bottom', 'insideH'].map(b => `<w:${b} w:val="single" w:sz="4" w:color="888888"/>`).join('')}</w:tblBorders></w:tblPr>` +
      [head].concat(rows).map((r, i) => `<w:tr>${r.map(c => `<w:tc><w:tcPr/>${para(String(c === null || c === undefined ? '' : c), null, { b: i === 0, sz: 20 })}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>';
    const img = (raw, caption) => { const sz = PR.imgSize(raw); const id = 'rPImg' + (media.length + 1); const name = 'pimg' + (media.length + 1) + '.' + (sz.ext === 'jpeg' ? 'jpeg' : 'png');
      media.push({ id: id, name: name, raw: raw, ext: sz.ext }); figN++; const cx = Math.round(Math.min(6, sz.w / 150) * 914400), cy = Math.round(cx * sz.h / sz.w);
      return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${900 + media.length}" name="${xe(name)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${900 + media.length}" name="${xe(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` +
        para(`${W.figure} ${figN}: ${caption}`, tpl ? ids.cap : 'Caption'); };
    const md = (x) => blocks(x).map(b => b.t === 'h' ? para(b.text, H(Math.min(1 + b.level, 3))) : b.t === 'table' ? tbl(b.head, b.rows) : (b.t === 'ul' || b.t === 'ol') ? b.items.map((it, k) => para((b.t === 'ol' ? (k + 1) + '. ' : '\u2022 ') + it)).join('') : para(b.text)).join('');
    const body = [];
    let tplBody = '', tplSect = '';
    if (tpl) { const dx = await tpl.file('word/document.xml').async('string'); const m = /<w:body>([\s\S]*)<\/w:body>/.exec(dx); let b = m ? m[1] : '';
      const sp = /<w:sectPr[\s\S]*<\/w:sectPr>\s*$/.exec(b); if (sp) { tplSect = sp[0]; b = b.slice(0, sp.index); }
      if (/<w:t[ >]/.test(b) && b.replace(/<[^>]+>/g, '').trim()) tplBody = b; }      // the template's own title page, kept as it is
    if (!tplBody) {
      const tp = (txt, o) => para(txt, null, Object.assign({ jc: 'center', sp: [0, 160] }, o || {}));
      body.push(tp('', { sp: [2400, 0] }), tp(pr.title || 'Untitled', { b: true, sz: 40 }), pr.subtitle ? tp(pr.subtitle) : '', tp(P.kind_label, { sp: [240, 240] }));
      ['author', 'programme', 'supervisor'].forEach(k => { if (String(pr[k] || '').trim()) body.push(tp(`${W[k]}: ${pr[k]}`)); });
      body.push(tp([pr.place, P.date].filter(Boolean).join(', '), { sp: [480, 0] }), '<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
    if (pr.toc) body.push(para(W.contents, H(1)), '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>…</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>', '<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    P.sections.forEach(s => { body.push(para(ids.numbered ? s.title : `${s.n} ${s.title}`, H(1)), md(s.md));
      if (s.milestones) { body.push(tbl([W.milestone, W.start, W.end], s.milestones.map(m => [m.milestone, m.start, m.end]))); if (s.gantt) body.push(img(s.gantt, W.kinds.timeline)); }
      s.figs.forEach(f => body.push(img(f.raw, f.caption))); });
    if (P.refs.length) body.push(para(W.references, H(1)), P.refs.map(r => para(r)).join(''));
    if (P.has_appendix) { body.push(para(W.appendix, H(1)), P.appendix_text ? md(P.appendix_text) : '');
      P.appendix_files.forEach(a => body.push(a.raw ? img(a.raw, a.caption || a.name) : para(`${W.attached}: ${a.name}${a.caption ? ' \u2013 ' + a.caption : ''}`))); }
    body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>', para(W.ai_statement, H(1)), para(P.ai.length ? W.ai_intro : W.ai_none), P.ai.map(l => para('\u2022 ' + l)).join(''),
      para(W.declaration, H(1)), para(W.declaration_text), para(`${W.place_date}: ______________________    ${W.signature}: ______________________`, null, { sp: [480, 0] }));
    const cm = x => Math.round(x / 2.54 * 1440);
    const sect = tplSect || `<w:sectPr>${rtl ? '<w:bidi/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${cm(lay.margins.t)}" w:right="${cm(lay.margins.r)}" w:bottom="${cm(lay.margins.b)}" w:left="${cm(lay.margins.l)}" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`;
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${tplBody}${body.join('')}${sect}</w:body></w:document>`;
    const z = tpl || new JSZip();
    if (!tpl) {
      const font = pr.lang === 'ar' ? 'Arial' : lay.font; const sz = Math.round(lay.size * 2); const line = Math.round(lay.line * 240);
      z.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
        `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>` +
        [1, 2, 3].map(k => `<w:style w:type="paragraph" w:styleId="Heading${k}"><w:name w:val="heading ${k}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${[0, 360, 240, 200][k]}" w:after="120" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="${k - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[0, 30, 26, 24][k]}"/></w:rPr></w:style>`).join('') +
        `<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`);
      z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>');
      z.file('word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>');
      z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>');
    } else {   // a .dotx is a .docx with another content type; Word should also update the table of contents when it opens
      let ct = await z.file('[Content_Types].xml').async('string'); ct = ct.replace('wordprocessingml.template.main+xml', 'wordprocessingml.document.main+xml'); z.file('[Content_Types].xml', ct);
      const sf = z.file('word/settings.xml'); if (sf && pr.toc) { let s = await sf.async('string'); if (!/updateFields/.test(s)) s = s.replace(/(<w:settings[^>]*>)/, '$1<w:updateFields w:val="true"/>'); z.file('word/settings.xml', s); }
    }
    // pictures: relationships and content types
    let rels = await z.file('word/_rels/document.xml.rels').async('string');
    rels = rels.replace('</Relationships>', media.map(m => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('') + '</Relationships>');
    z.file('word/_rels/document.xml.rels', rels);
    let ct = await z.file('[Content_Types].xml').async('string');
    ['png', 'jpeg'].forEach(e => { if (!new RegExp('Extension="' + e + '"', 'i').test(ct)) ct = ct.replace('<Default Extension="xml"', `<Default Extension="${e}" ContentType="image/${e}"/><Default Extension="xml"`); });
    z.file('[Content_Types].xml', ct);
    media.forEach(m => z.file('word/media/' + m.name, m.raw)); z.file('word/document.xml', doc);
    return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  };

  // ---------- HTML (open it and print it as PDF)
  const mdHtml = x => { const e = s => xe(String(s).replace(/__|`/g, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return blocks(x).map(b => b.t === 'h' ? `<h${Math.min(1 + b.level, 4)}>${e(b.text)}</h${Math.min(1 + b.level, 4)}>` : b.t === 'table' ? `<table><thead><tr>${b.head.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : (b.t === 'ul' || b.t === 'ol') ? `<${b.t}>${b.items.map(i => `<li>${e(i)}</li>`).join('')}</${b.t}>` : `<p>${e(b.text)}</p>`).join('\n'); };
  const b64 = raw => { let s = ''; for (let i = 0; i < raw.length; i += 0x8000) s += String.fromCharCode.apply(null, raw.subarray(i, i + 0x8000)); return btoa(s); };
  PR.html = async function (st) {
    const P = await PR.parts(st); const pr = P.pr; const W = P.W; const lay = pr.layout || LAYOUT; let figN = 0;
    const img = (raw, cap) => { figN++; const sz = PR.imgSize(raw); return `<figure><img src="data:image/${sz.ext};base64,${b64(raw)}"><figcaption>${xe(W.figure)} ${figN}: ${xe(cap)}</figcaption></figure>`; };
    const css = `@page{size:A4;margin:${lay.margins.t}cm ${lay.margins.r}cm ${lay.margins.b}cm ${lay.margins.l}cm}body{font-family:'${lay.font}',serif;font-size:${lay.size}pt;line-height:${lay.line};color:#000;margin:0 auto;max-width:17cm}
h1{font-size:1.3em;margin:1.4em 0 .5em}h2{font-size:1.12em}h3{font-size:1em}p{margin:0 0 .6em;text-align:justify}.title{text-align:center;page-break-after:always;padding-top:22%}.title h1{font-size:1.8em}.title p{text-align:center}
table{border-collapse:collapse;margin:.6em 0;font-size:.9em}th,td{border:1px solid #888;padding:3px 6px;text-align:start;vertical-align:top}figure{margin:1em 0;text-align:center}figure img{max-width:100%}figcaption{font-size:.9em}
.refs p{padding-inline-start:2em;text-indent:-2em;text-align:start}.decl{page-break-before:always}.sign{margin-top:3em}`;
    const h = [`<!DOCTYPE html><html lang="${pr.lang}" dir="${pr.lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xe(pr.title || 'Untitled')}</title><style>${css}</style></head><body>`,
      `<div class="title"><h1>${xe(pr.title || 'Untitled')}</h1>${pr.subtitle ? `<p>${xe(pr.subtitle)}</p>` : ''}<p>${xe(P.kind_label)}</p>`,
      ['author', 'programme', 'supervisor'].map(k => String(pr[k] || '').trim() ? `<p>${xe(W[k])}: ${xe(pr[k])}</p>` : '').join(''), `<p>${xe([pr.place, P.date].filter(Boolean).join(', '))}</p></div>`];
    if (pr.toc) h.push(`<h1>${xe(W.contents)}</h1><ol>${P.sections.map(s => `<li>${xe(s.title)}</li>`).join('')}</ol>`);
    P.sections.forEach(s => { h.push(`<h1>${s.n} ${xe(s.title)}</h1>`, mdHtml(s.md));
      if (s.milestones) { h.push(`<table><thead><tr><th>${xe(W.milestone)}</th><th>${xe(W.start)}</th><th>${xe(W.end)}</th></tr></thead><tbody>${s.milestones.map(m => `<tr><td>${xe(m.milestone)}</td><td>${xe(m.start)}</td><td>${xe(m.end)}</td></tr>`).join('')}</tbody></table>`); if (s.gantt) h.push(img(s.gantt, W.kinds.timeline)); }
      s.figs.forEach(f => h.push(img(f.raw, f.caption))); });
    if (P.refs.length) h.push(`<h1>${xe(W.references)}</h1><div class="refs">${P.refs.map(r => `<p>${xe(r)}</p>`).join('')}</div>`);
    if (P.has_appendix) { h.push(`<h1>${xe(W.appendix)}</h1>`, P.appendix_text ? mdHtml(P.appendix_text) : ''); P.appendix_files.forEach(a => h.push(a.raw ? img(a.raw, a.caption || a.name) : `<p>${xe(W.attached)}: ${xe(a.name)}${a.caption ? ' \u2013 ' + xe(a.caption) : ''}</p>`)); }
    h.push(`<div class="decl"><h1>${xe(W.ai_statement)}</h1><p>${xe(P.ai.length ? W.ai_intro : W.ai_none)}</p>${P.ai.length ? '<ul>' + P.ai.map(l => `<li>${xe(l)}</li>`).join('') + '</ul>' : ''}`,
      `<h1>${xe(W.declaration)}</h1><p>${xe(W.declaration_text)}</p><p class="sign">${xe(W.place_date)}: ______________________ &nbsp; ${xe(W.signature)}: ______________________</p></div></body></html>`);
    return h.join('\n');
  };

  // ---------- LaTeX package (compile with XeLaTeX; Overleaf: Menu > Compiler > XeLaTeX)
  const tx = s => String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\textbackslash{}').replace(/([#$%&_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
  const txi = s => tx(String(s).replace(/__|`/g, '')).replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
  const mdTex = x => [].concat(...blocks(x).map(b => b.t === 'h' ? [`${['\\subsection*{', '\\subsubsection*{', '\\paragraph*{'][Math.min(b.level, 3) - 1]}${txi(b.text)}}`]
    : b.t === 'table' ? ['\\begin{center}\\small', `\\begin{tabular}{${b.head.map(() => `p{${(0.9 / b.head.length).toFixed(2)}\\linewidth}`).join('')}}`, '\\toprule', b.head.map(txi).join(' & ') + ' \\\\', '\\midrule'].concat(b.rows.map(r => r.map(txi).join(' & ') + ' \\\\'), ['\\bottomrule', '\\end{tabular}', '\\end{center}'])
    : (b.t === 'ul' || b.t === 'ol') ? [`\\begin{${b.t === 'ul' ? 'itemize' : 'enumerate'}}`].concat(b.items.map(i => '  \\item ' + txi(i)), [`\\end{${b.t === 'ul' ? 'itemize' : 'enumerate'}}`]) : [txi(b.text), '']));
  PR.latexZip = async function (st) {
    const P = await PR.parts(st); const pr = P.pr; const W = P.W; const lay = pr.layout || LAYOUT; const z = new root.JSZip(); const dir = 'proposal/'; let figN = 0;
    const fig = (raw, cap) => { figN++; const sz = PR.imgSize(raw); const fn = `fig${U.pad(figN)}.${sz.ext === 'jpeg' ? 'jpg' : 'png'}`; z.file(dir + 'figures/' + fn, raw);
      return ['\\begin{figure}[htbp]\\centering', `\\includegraphics[width=\\linewidth,height=0.42\\textheight,keepaspectratio]{figures/${fn}}`, `\\caption{${txi(cap)}}`, '\\end{figure}']; };
    const lang = { en: 'english', de: 'german', ar: 'arabic' }[pr.lang] || 'english';
    let L = [`\\documentclass[${Math.round(lay.size)}pt,a4paper]{article}`, "% Your university or chair uses its own class? Replace the line above with it; the rest compiles unchanged in most classes.",
      '\\usepackage{fontspec}', '\\usepackage{polyglossia}', `\\setmainlanguage{${lang}}`].concat(lang !== 'english' ? ['\\setotherlanguage{english}'] : [],
      [lang === 'arabic' ? '\\newfontfamily\\arabicfont[Script=Arabic]{Amiri}' : '\\setmainfont{TeX Gyre Termes}',
      `\\usepackage[left=${lay.margins.l}cm,right=${lay.margins.r}cm,top=${lay.margins.t}cm,bottom=${lay.margins.b}cm]{geometry}`, '\\usepackage{setspace}', `\\setstretch{${lay.line}}`,
      '\\usepackage{graphicx}', '\\usepackage{booktabs}', '\\usepackage{array}', '\\usepackage[hidelinks]{hyperref}', '\\setlength{\\parskip}{0.4em}', '\\setlength{\\parindent}{0pt}',
      '\\begin{document}', '\\begin{titlepage}\\centering\\vspace*{0.25\\textheight}', `{\\LARGE\\bfseries ${txi(pr.title || 'Untitled')}\\par}\\vspace{1em}`],
      pr.subtitle ? [`{\\large ${txi(pr.subtitle)}\\par}\\vspace{1em}`] : [], [`{\\large ${txi(P.kind_label)}\\par}\\vspace{2em}`],
      ['author', 'programme', 'supervisor'].filter(k => String(pr[k] || '').trim()).map(k => `${txi(W[k])}: ${txi(pr[k])}\\par`),
      [`\\vfill ${txi([pr.place, P.date].filter(Boolean).join(', '))}\\par`, '\\end{titlepage}'], pr.toc ? [`\\renewcommand{\\contentsname}{${txi(W.contents)}}`, '\\tableofcontents', '\\clearpage'] : []);
    P.sections.forEach(s => { L.push(`\\section{${txi(s.title)}}`); L = L.concat(mdTex(s.md));
      if (s.milestones) { L.push('\\begin{center}\\small\\begin{tabular}{p{0.5\\linewidth}ll}\\toprule', `${txi(W.milestone)} & ${txi(W.start)} & ${txi(W.end)} \\\\ \\midrule`); s.milestones.forEach(m => L.push(`${txi(m.milestone)} & ${txi(m.start)} & ${txi(m.end)} \\\\`)); L.push('\\bottomrule\\end{tabular}\\end{center}'); if (s.gantt) L = L.concat(fig(s.gantt, W.kinds.timeline)); }
      s.figs.forEach(f => { L = L.concat(fig(f.raw, f.caption)); }); });
    if (P.refs.length) L = L.concat([`\\section*{${txi(W.references)}}`, `\\addcontentsline{toc}{section}{${txi(W.references)}}`, '\\begin{list}{}{\\setlength{\\leftmargin}{2em}\\setlength{\\itemindent}{-2em}}'], P.refs.map(r => '\\item ' + txi(r)), ['\\end{list}']);
    if (P.has_appendix) { L = L.concat([`\\section*{${txi(W.appendix)}}`, `\\addcontentsline{toc}{section}{${txi(W.appendix)}}`], P.appendix_text ? mdTex(P.appendix_text) : []);
      P.appendix_files.forEach(a => { L = L.concat(a.raw ? fig(a.raw, a.caption || a.name) : [`${txi(W.attached)}: ${txi(a.name)}${a.caption ? ' -- ' + txi(a.caption) : ''}\\par`]); }); }
    L = L.concat(['\\clearpage', `\\section*{${txi(W.ai_statement)}}`, txi(P.ai.length ? W.ai_intro : W.ai_none)], P.ai.length ? ['\\begin{itemize}'].concat(P.ai.map(l => '  \\item ' + txi(l)), ['\\end{itemize}']) : [],
      [`\\section*{${txi(W.declaration)}}`, txi(W.declaration_text), '', `\\vspace{3em}${txi(W.place_date)}: \\rule{5cm}{0.4pt}\\hfill ${txi(W.signature)}: \\rule{5cm}{0.4pt}`, '\\end{document}']);
    z.file(dir + 'main.tex', L.join('\n')); z.file(dir + 'latexmkrc', "$pdf_mode = 5;   # XeLaTeX: needed for the fonts and for Arabic\n$xelatex = 'xelatex -interaction=nonstopmode %O %S';\n");
    z.file(dir + 'README.txt', 'Compile main.tex with XeLaTeX (Overleaf: Menu > Compiler > XeLaTeX). The latexmkrc file sets this for a local TeX installation.\nArabic needs the Amiri font (included in Overleaf and TeX Live).\n');
    return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  };
  root.PR = PR;
})(window);
