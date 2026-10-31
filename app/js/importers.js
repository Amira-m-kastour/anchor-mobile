/* ANCHOR Mobile - reading database exports into bibliometrix's record format (ports of bibliometrix::convert2df):
   Web of Science plain text, Scopus CSV, OpenAlex (live API records), and the "Dataset for Biblioshiny (.xlsx)" the desktop app
   exports. Tested against convert2df on the same files. */
(function (root) {
  'use strict';
  const B = (typeof module !== 'undefined' && module.exports) ? require('./biblio_core.js') : root.BX;
  const Papa = (typeof module !== 'undefined' && module.exports) ? require('../vendor/papaparse.min.js') : root.Papa;
  const I = {};
  const trimES = s => s.replace(/[ \t\n\r\f\v]+/g, ' ');
  const trim = s => s.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '');
  const up = v => (v === null || v === undefined ? v : String(v).toUpperCase());

  I.detect = function (name, text) {
    const head = text.slice(0, 4000); const lname = (name || '').toLowerCase();
    if (/^(﻿)?(FN |PT |VR )/m.test(head) && /^PT /m.test(head)) return 'wos';
    if (/^[ \t\n\r\f\v]*@\w+[ \t\n\r\f\v]*\{/m.test(head)) return 'bibtex';
    const first = head.split(/\r?\n/)[0] || '';
    if (/"?Authors"?,/.test(first) && /(Source title|EID|Link)/.test(first)) return 'scopus';
    if (/Lens ID/.test(first)) return 'lens';
    if (/^"?id"?,/.test(first) && /display_name|publication_year/.test(first)) return 'openalex_csv';
    if (lname.endsWith('.xlsx') || lname.endsWith('.xls')) return 'xlsx';
    return 'unknown';
  };

  // common post-processing of convert2df()
  function finish(recs, dbsource) {
    for (const r of recs) {
      r.PY = r.PY === undefined || r.PY === null || r.PY === '' ? null : (isNaN(Number(r.PY)) ? null : Number(r.PY));
      r.TC = r.TC === undefined || r.TC === null || r.TC === '' || isNaN(Number(r.TC)) ? 0 : Number(r.TC);
      if (r.CR === undefined || r.CR === null) r.CR = 'none';
      else r.CR = trimES(String(r.CR).replace(/\[,|\[|\]| \.\. | \. /g, '')).replace(/^[ \t\n\r\f\v]+/, '');
    }
    let M = { n: recs.length };
    const keys = Array.from(new Set([].concat(...recs.map(r => Object.keys(r)))));
    for (const k of keys) M[k] = recs.map(r => (k in r ? r[k] : null));
    if (!['pubmed', 'lens', 'openalex_api'].includes(dbsource)) {
      if (M.C1) { if (!M.AU_UN) B.AU_UN(M); } else { M.C1 = new Array(M.n).fill(null); M.AU_UN = new Array(M.n).fill(null); }
      M.AU = M.AU.map(a => (a === null || a === undefined) ? a : a.split(';').filter((x, i, arr) => !(i === arr.length - 1 && x === '')).map(x => trim(trimES(x))).join(';'));
    }
    for (const k of keys.concat(['AU_UN'])) if (Array.isArray(M[k])) M[k] = M[k].map(v => (typeof v === 'string' ? v.split(';;').join(';') : v));
    const idf = { isi: 'UT', scopus: 'UT', openalex: 'id_oa', openalex_api: 'id_oa', lens: 'UT' }[dbsource] || 'TI';
    if (M[idf]) { const seen = new Set(); const keep = []; M[idf].forEach((v, i) => { const k = v === null ? '\u0000NA' : v; if (!seen.has(k)) { seen.add(k); keep.push(i); } }); if (keep.length < M.n) M = B.subset(M, keep); }
    B.SR(M); return M;
  }

  // ---------- Web of Science plain text (isi2df)
  I.wos = function (text) {
    let D = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.length > 1).filter(l => !['FN ', 'VR '].includes(l.slice(0, 3)));
    for (let i = 1; i < D.length; i++) if (D[i].slice(0, 3) === '   ') D[i] = D[i - 1].slice(0, 3) + D[i].slice(3);
    const recs = []; let cur = null;
    for (const line of D) { const tag = line.slice(0, 3).replace(/ /g, ''); const content = line.slice(3);
      if (tag === 'PT') { cur = {}; recs.push(cur); } if (!cur) continue; if (tag === 'ER' || tag === 'EF') continue;
      (cur[tag] = cur[tag] || []).push(content); }
    // bibliometrix pivots the tags after sorting them alphabetically, so records appear in the order of their first tag
    const tags = Array.from(new Set([].concat(...recs.map(r => Object.keys(r))))).sort(B.cmp); const order = []; const seen = new Set();
    for (const t of tags) recs.forEach((r, i) => { if (t in r && !seen.has(i)) { seen.add(i); order.push(i); } });
    const comma = new Set(['AU', 'AF', 'CR']);
    const out = order.map(i => recs[i]).map(r => { const o = {};
      for (const [k, v] of Object.entries(r)) o[k] = comma.has(k) ? v.join(';') : trimES(v.join(' '));
      o.C1raw = o.C1 === undefined ? null : o.C1; o.DB = 'ISI'; if (o.AU !== undefined) o.AU = trimES(o.AU.replace(/,/g, ' '));
      const DI = o.DI === undefined ? null : o.DI; for (const k of Object.keys(o)) o[k] = up(o[k]); o.DI = DI;
      if (o.C1 !== undefined && o.C1 !== null) { o.C1 = trim(o.C1.replace(/\[.*?\]/g, '')).replace(/\./g, '.;'); }
      return o; });
    return finish(out, 'isi');
  };

  // ---------- Scopus CSV (csvScopus2df)
  const SCOPUS_TAGS = { 'Abbreviated Source Title': 'JI', 'Authors with affiliations': 'C1', 'Author Addresses': 'C1', 'Authors': 'AU', 'Author Names': 'AU', 'Author full names': 'AF', 'Source title': 'SO',
    'Titles': 'TI', 'Title': 'TI', 'Publication Year': 'PY', 'Year': 'PY', 'Volume': 'VL', 'Issue': 'IS', 'Page count': 'PP', 'Cited by': 'TC', 'DOI': 'DI', 'Link': 'URL', 'Abstract': 'AB',
    'Author Keywords': 'DE', 'Indexed Keywords': 'ID', 'Index Keywords': 'ID', 'Funding Details': 'FU', 'Funding Texts': 'FX', 'Funding Text 1': 'FX', 'References': 'CR', 'Correspondence Address': 'RP',
    'Publisher': 'PU', 'Open Access': 'OA', 'Language of Original Document': 'LA', 'Document Type': 'DT', 'Source': 'DB', 'EID': 'UT' };
  I.scopus = function (text) {
    const p = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
    const rows = p.data.map(r => { const o = {}; for (const [k, v] of Object.entries(r)) { const t = SCOPUS_TAGS[k] || k; if (!(t in o)) o[t] = v === undefined || v === null ? '' : v; } return o; });
    const out = rows.map(o => {
      if (o.AU !== undefined) o.AU = o.AU.replace(/\./g, '').replace(/,/g, ';');
      o.C1raw = o.C1; if (o.C1 === undefined) o.C1 = null; else o.C1 = o.C1.split(';').map(l => l.replace(/.*\., /, '')).join(';');
      if (o.JI !== undefined) o.J9 = o.JI.replace(/\./g, ''); else { o.JI = o.SO; o.J9 = o.SO; }
      const DI = o.DI, URL = o.URL; for (const k of Object.keys(o)) o[k] = up(o[k]); o.DI = DI; o.URL = URL;
      return o; });
    return finish(out, 'scopus');
  };

  // ---------- OpenAlex works from the API (as ANCHOR Studio's desktop fetch: convert2df(dbsource = "openalex_api"))
  I.openalexWorks = function (works) {
    const inv = idx => { if (!idx) return null; const pos = []; for (const [w, ps] of Object.entries(idx)) for (const p of ps) pos.push([p, w]); pos.sort((a, b) => a[0] - b[0]); return pos.map(x => x[1]).join(' '); };
    const out = works.map(w => { const au = (w.authorships || []).map(a => (a.author && a.author.display_name) || '').filter(Boolean);
      const names = au.map(n => { const p = n.trim().split(/[ \t\n\r\f\v]+/); const last = p.pop(); return (last + ' ' + p.map(x => x[0]).join('')).trim(); });
      const inst = (w.authorships || []).map(a => ((a.institutions || [])[0] || {}).display_name).filter(Boolean);
      const ctry = (w.authorships || []).map(a => ((a.countries || [])[0]) || ((a.institutions || [])[0] || {}).country_code).filter(Boolean);
      const src = (w.primary_location && w.primary_location.source) || {};
      const kw = (w.keywords || []).map(k => k.display_name); const concepts = (w.concepts || []).map(c => c.display_name);
      return { AU: up(names.join(';')), AF: up(au.join(';')), TI: up(w.display_name || w.title || ''), SO: up(src.display_name || ''), JI: up(src.display_name || ''), J9: up(src.display_name || ''),
        PY: w.publication_year, TC: w.cited_by_count || 0, DE: up(kw.join(';')), ID: up(concepts.join(';')), CR: (w.referenced_works || []).map(x => String(x).replace('https://openalex.org/', '')).join(';'),
        C1: up(inst.join(';')), AU_UN: up(inst.join(';')), AU_CO: up(ctry.map(cc => I.COUNTRY_NAME[cc] || cc).join(';')), DI: (w.doi || '').replace(/^https?:\/\/doi\.org\//, '') || null,
        DT: up(w.type || ''), LA: up(w.language || ''), DB: 'OPENALEX', AB: up(inv(w.abstract_inverted_index) || ''), id_oa: (w.id || '').replace('https://openalex.org/', ''), RP: null }; });
    const M = finish(out, 'openalex_api');
    M.AU1_CO = M.AU_CO.map(s => (s ? String(s).split(';')[0] : null));
    return M;
  };
  I.COUNTRY_NAME = { US: 'USA', GB: 'UNITED KINGDOM', DE: 'GERMANY', EG: 'EGYPT', FR: 'FRANCE', CN: 'CHINA', IT: 'ITALY', ES: 'SPAIN', NL: 'NETHERLANDS', CA: 'CANADA', AU: 'AUSTRALIA', JP: 'JAPAN', KR: 'KOREA',
    IN: 'INDIA', BR: 'BRAZIL', CH: 'SWITZERLAND', SE: 'SWEDEN', NO: 'NORWAY', DK: 'DENMARK', FI: 'FINLAND', BE: 'BELGIUM', AT: 'AUSTRIA', PT: 'PORTUGAL', GR: 'GREECE', PL: 'POLAND', TR: 'TURKEY', SA: 'SAUDI ARABIA',
    AE: 'UNITED ARAB EMIRATES', IR: 'IRAN', IL: 'ISRAEL', ZA: 'SOUTH AFRICA', NG: 'NIGERIA', KE: 'KENYA', GH: 'GHANA', MA: 'MOROCCO', TN: 'TUNISIA', JO: 'JORDAN', LB: 'LEBANON', QA: 'QATAR', MY: 'MALAYSIA', SG: 'SINGAPORE',
    ID: 'INDONESIA', TH: 'THAILAND', VN: 'VIETNAM', PK: 'PAKISTAN', BD: 'BANGLADESH', MX: 'MEXICO', AR: 'ARGENTINA', CL: 'CHILE', CO: 'COLOMBIA', PE: 'PERU', NZ: 'NEW ZEALAND', IE: 'IRELAND', CZ: 'CZECH REPUBLIC',
    HU: 'HUNGARY', RO: 'ROMANIA', RU: 'RUSSIA', UA: 'UKRAINE', TW: 'CHINA', HK: 'CHINA' };

  // ---------- "Dataset for Biblioshiny (.xlsx)" exported by ANCHOR Studio or Biblioshiny: bibliometrix columns as they are
  I.xlsx = function (arrayBuffer) {
    const XLSX = root.XLSX || (typeof require !== 'undefined' ? require('../vendor/xlsx.mini.min.js') : null);
    const wb = XLSX.read(arrayBuffer, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    if (!rows.length || !('AU' in rows[0] || 'TI' in rows[0])) throw new Error('This spreadsheet does not have bibliometrix columns (AU, TI, SO, PY ...). Export "Dataset for Biblioshiny (.xlsx)" from ANCHOR Studio, or a database export.');
    const M = { n: rows.length }; for (const k of Object.keys(rows[0])) M[k] = rows.map(r => (r[k] === '' ? null : r[k]));
    return B.normalize(M);
  };

  I.read = async function (file) {
    const name = file.name || 'file'; const isX = /\.xlsx?$/i.test(name);
    if (isX) return { M: I.xlsx(await file.arrayBuffer()), format: 'xlsx', database: 'From a bibliometrix spreadsheet' };
    const text = await file.text(); const fmt = I.detect(name, text);
    if (fmt === 'wos') return { M: I.wos(text), format: fmt, database: 'Web of Science' };
    if (fmt === 'scopus') return { M: I.scopus(text), format: fmt, database: 'Scopus' };
    if (fmt === 'bibtex') throw new Error('BibTeX exports are not read on the phone yet. Export Web of Science as plain text, or Scopus as CSV, or use the desktop app for BibTeX.');
    if (fmt === 'lens' || fmt === 'openalex_csv') throw new Error('This export (' + fmt + ') is read by the desktop app. On the phone, fetch OpenAlex records directly, or use Web of Science plain text or Scopus CSV.');
    throw new Error('This file is not a recognised export. Use Web of Science "Plain text" (Full Record and Cited References) or Scopus "CSV" with all information.');
  };
  I.merge = function (list) {
    if (list.length === 1) return list[0];
    const keys = Array.from(new Set([].concat(...list.map(M => Object.keys(M).filter(k => k !== 'n')))));
    const M = { n: list.reduce((s, x) => s + x.n, 0) }; for (const k of keys) M[k] = [].concat(...list.map(x => x[k] || new Array(x.n).fill(null)));
    // duplicates across databases: same DOI, or same title and year
    const seen = new Set(); const keep = []; for (let i = 0; i < M.n; i++) { const k = M.DI[i] ? 'd:' + String(M.DI[i]).toLowerCase() : 't:' + String(M.TI[i]).replace(/[^A-Z0-9]/gi, '').toUpperCase() + M.PY[i]; if (!seen.has(k)) { seen.add(k); keep.push(i); } }
    const out = B.subset(M, keep); out._dup = M.n - keep.length; B.SR(out); return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = I; else root.IMPORT = I;
})(typeof self !== 'undefined' ? self : this);
