/* ANCHOR Mobile - bibliometric engine: a JavaScript port of the bibliometrix (Aria & Cuccurullo, 2017) functions that
   ANCHOR Studio's desktop analyses use (version 4.3.1). Records are held column-wise like bibliometrix's data frame M:
   M.n = number of records, M.AU[i], M.PY[i], ... with null for NA. Tested against bibliometrix on the same data. */
(function (root) {
  'use strict';
  const B = {};
  const isNA = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v));
  const trim = s => s.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '');
  const trimLeading = s => s.replace(/^[ \t\n\r\f\v]+/, '');
  const trimES = s => s.replace(/[ \t\n\r\f\v]+/g, ' ');
  B.isNA = isNA; B.trim = trim; B.trimES = trimES;

  // R's strsplit: NA gives [NA]; "" gives []; a trailing separator gives no empty last piece
  function strsplit(x, sep) {
    if (isNA(x)) return [null];
    const s = String(x); if (s === '') return [];
    const parts = s.split(sep); if (parts.length && parts[parts.length - 1] === '') parts.pop(); return parts;
  }
  B.strsplit = strsplit;
  // C-locale string order (what the reference runs use); ties in sorted tables keep this order
  // R's collation in the C locale (the reference): UTF-8 characters compare as their <U+XXXX> escapes
  const ckey = new Map();
  const collKey = s => { let k = ckey.get(s); if (k !== undefined) return k; k = /[^\x00-\x7f]/.test(s) ? s.replace(/[^\x00-\x7f]/gu, c => '<U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + '>') : s; if (ckey.size < 200000) ckey.set(s, k); return k; };
  const cmp = (a, b) => { const x = collKey(String(a)), y = collKey(String(b)); return x < y ? -1 : x > y ? 1 : 0; };
  B.cmp = cmp;
  // R: sort(table(x), decreasing = TRUE) -> [[name, count], ...]
  function table(values) {
    const m = new Map(); for (const v of values) { if (isNA(v)) continue; m.set(v, (m.get(v) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => cmp(a[0], b[0]));
  }
  function sortTable(values) { return table(values).sort((a, b) => b[1] - a[1]); }   // Array.sort is stable
  B.table = table; B.sortTable = sortTable;
  const unique = a => Array.from(new Set(a));
  const sum = a => a.reduce((s, x) => s + (isNA(x) ? 0 : x), 0);
  const mean = a => { const v = a.filter(x => !isNA(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; };
  B.unique = unique; B.sum = sum; B.mean = mean;
  const CURRENT_YEAR = () => new Date().getFullYear();
  B.CURRENT_YEAR = CURRENT_YEAR;

  // ---------- the record set
  B.FIELDS = ['AU', 'TI', 'SO', 'JI', 'J9', 'PY', 'TC', 'DE', 'ID', 'CR', 'C1', 'RP', 'DI', 'DT', 'LA', 'DB', 'AB', 'SR', 'SR_FULL', 'AU_UN', 'AU_CO', 'AU1_CO', 'C3', 'VL', 'BP', 'EP', 'PU'];
  B.fromRecords = function (recs) {
    const M = { n: recs.length };
    const keys = unique([].concat(B.FIELDS, ...recs.map(r => Object.keys(r))));
    for (const k of keys) M[k] = recs.map(r => (k in r ? r[k] : null));
    return B.normalize(M);
  };
  B.fromColumns = function (cols, n) { const M = { n: n }; for (const k of Object.keys(cols)) M[k] = cols[k].slice(); return B.normalize(M); };
  B.has = (M, f) => Array.isArray(M[f]) && M[f].some(v => !isNA(v) && String(v).length > 0);
  B.need = (M, f, what) => { if (!B.has(M, f)) throw new Error(`This analysis needs ${what} (field ${f}), which this dataset does not have. Export it again with all fields, or choose another analysis.`); };
  // like ANCHOR Studio's normalize_M(): missing columns empty, PY and TC numbers, SR built
  B.normalize = function (M) {
    for (const f of ['AU', 'TI', 'SO', 'DE', 'ID', 'CR', 'C1', 'DT', 'PP', 'VL', 'DI', 'J9', 'JI', 'AB', 'LA', 'RP', 'DB', 'BP', 'EP', 'AU_CO', 'AU_UN']) if (!M[f]) M[f] = new Array(M.n).fill(null);
    for (const f of ['PY', 'TC']) M[f] = (M[f] || new Array(M.n).fill(null)).map(v => { if (isNA(v) || v === '') return null; const x = Number(v); return isNaN(x) ? null : x; });
    if (!B.has(M, 'DE') && M.KW_Merged) M.DE = M.KW_Merged.map(v => isNA(v) ? null : String(v).toUpperCase());
    if (!M.SR || !B.has(M, 'SR')) B.SR(M);
    return M;
  };
  B.db = M => String(M.DB && M.DB[0] || '').toUpperCase();

  // ---------- SR: short reference "FIRSTAUTHOR, YEAR, JOURNAL" made unique with -a, -b, ...
  B.SR = function (M) {
    const dbs = String(M.DB[0] || '');
    const first = M.AU.map(a => { let l = strsplit(a, ';').map(trimLeading);
      if (dbs === 'scopus') l = l.map(x => trim(x).replace(' ', ',').replace(',,', ',').split(' ').join(''));
      return (l.length > 0 ? (l[0] === null ? 'NA' : l[0]) : 'NA').replace(/,/g, ' '); });
    let J9;
    if (M.J9 && M.J9.some(v => v !== undefined)) {
      J9 = M.J9.map((j, i) => { let v = j; if (isNA(v) && isNA(M.JI[i])) v = M.SO[i]; if (isNA(v)) v = isNA(M.JI[i]) ? null : trim(String(M.JI[i]).replace(/\./g, ' ')); return v; });
    } else J9 = M.JI.map((j, i) => trim(String(isNA(j) ? M.SO[i] : j).replace(/\./g, ' ')));
    let SR = first.map((a, i) => `${a}, ${isNA(M.PY[i]) ? 'NA' : M.PY[i]}, ${isNA(J9[i]) ? 'NA' : J9[i]}`.replace(/[ \t\n\r\f\v]+/g, ' '));
    M.SR_FULL = SR.slice();
    const letters = 'abcdefghijklmnopqrstuvwxyz'; let round = 0;
    for (;;) { const seen = new Set(); const dup = []; SR.forEach((s, i) => { if (seen.has(s)) dup.push(i); else seen.add(s); }); if (!dup.length) break;
      const suf = letters[round++] || ('z' + round); for (const i of dup) SR[i] = SR[i] + '-' + suf; }
    M.SR = SR; return M;
  };

  // ---------- countries (bibliometrix's table, same order: the order decides which country is "first")
  B.COUNTRIES = null;   // set by the app from countries.json: [{name, continent, lon, lat}]
  const lastChar = (s, last) => (isNA(s) ? s : (s.slice(-1) !== last ? s + last : s));
  const removeLastChar = (s, last) => (isNA(s) ? s : (s.slice(-1) === last ? s.slice(0, -1) : s));
  function countryFix(s) { return s.replace(/UNITED STATES/g, 'USA').replace(/RUSSIAN FEDERATION/g, 'RUSSIA').replace(/TAIWAN/g, 'CHINA').replace(/ENGLAND/g, 'UNITED KINGDOM')
    .replace(/SCOTLAND/g, 'UNITED KINGDOM').replace(/WALES/g, 'UNITED KINGDOM').replace(/NORTH IRELAND/g, 'UNITED KINGDOM'); }
  B.AU_CO = function (M) {
    const db = B.db(M); const names = B.COUNTRIES.map(c => c.name);
    const suffix = (db === 'ISI' || db === 'PUBMED') ? '.' : db === 'SCOPUS' ? ';' : db === 'DIMENSIONS' ? ')' : '';
    const pats = names.map(c => c + suffix);
    const out = new Array(M.n).fill(null); const hasRP = Array.isArray(M.RP);
    for (let i = 0; i < M.n; i++) {
      let c1 = M.C1[i]; if (isNA(c1) && hasRP) c1 = M.RP[i];
      if (!isNA(c1)) { c1 = strsplit(c1, ';').join(';'); c1 = c1.replace(/\[.*?\] /g, ''); if (c1 === 'NA') c1 = null; }
      if (!isNA(c1)) { if (db === 'ISI') c1 = lastChar(c1, '.'); if (db === 'SCOPUS') c1 = lastChar(c1, ';'); if (db === 'DIMENSIONS') c1 = c1.replace(/\.\)/g, ')'); }
      const rp = String(hasRP && !isNA(M.RP[i]) ? M.RP[i] : 'NA') + ';';
      const occ = (txt) => { const h = []; for (const p of pats) { let k = txt.indexOf(p); while (k >= 0) { h.push(p); k = txt.indexOf(p, k + p.length); } } return h; };
      let hits = []; if (!isNA(c1)) hits = occ(c1);
      if (!hits.length) hits = occ(rp);
      if (hits.length) { let s = hits.join(';');
        s = s.replace(/[0-9]/g, '').replace(/\(|\)/g, '').split('.').join('').split(';;').join(';'); s = countryFix(s);
        if (db === 'ISI') s = removeLastChar(s, '.'); if (db === 'SCOPUS') s = removeLastChar(s, ';'); out[i] = s; }
    }
    M.AU_CO = out; return M;
  };
  const punctBlank = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~ \t]+/g;   // R: [[:punct:][:blank:]]+
  B.AU1_CO = function (M, sep = ';') {
    const db = B.db(M);
    if (db === 'DIMENSIONS') { const M2 = Object.assign({}, M); B.AU_CO(M2); M.AU1_CO = M2.AU_CO.map(s => isNA(s) ? null : s.split(';')[0]); return M; }
    const names = B.COUNTRIES.map(c => c.name); const pats = names.map(c => ' ' + c + ' ');
    const out = new Array(M.n).fill(null);
    for (let i = 0; i < M.n; i++) {
      let c1 = M.C1[i]; if (!isNA(M.RP[i])) c1 = M.RP[i];
      let rp;
      if (!isNA(c1)) { c1 = c1.replace(/\[.*?\] /g, '').replace(/^.*?\(REPRINT[ \t\n\r\f\v]AUTHOR\)/, ''); c1 = strsplit(c1, sep)[0];
        if (c1 === undefined) c1 = null; }
      if (!isNA(c1)) { c1 = c1.replace(/^(.+)?,/, ''); c1 = c1.replace(punctBlank, ' '); c1 = trim(c1) + ' '; }
      else c1 = 'NA ';                                                        // R pastes "NA" into the string
      if (db !== 'PUBMED') { rp = (isNA(M.RP[i]) ? 'NA' : M.RP[i]) + ';'; rp = rp.replace(punctBlank, ' '); }
      else { c1 = ' ' + c1.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ''); rp = c1; }
      let hit = pats.find(p => c1.indexOf(p) >= 0);
      if (!hit) hit = pats.find(p => rp.indexOf(p) >= 0);
      if (hit) out[i] = countryFix(trim(hit.replace(/[0-9]/g, '')));
    }
    M.AU1_CO = out; return M;
  };

  // affiliations (bibliometrix AU_UN with disambiguation)
  const U_TAGS = ['UNIV', 'COLL', 'SCH', 'INST', 'ACAD', 'ECOLE', 'CTR', 'SCI', 'CENTRE', 'CENTER', 'CENTRO', 'HOSP', 'ASSOC', 'COUNCIL', 'FONDAZ', 'FOUNDAT', 'ISTIT', 'LAB', 'TECH',
    'RES', 'CNR', 'ARCH', 'SCUOLA', 'PATENT OFF', 'CENT LIB', 'HEALTH', 'NATL', 'LIBRAR', 'CLIN', 'FDN', 'OECD', 'FAC', 'WORLD BANK', 'POLITECN', 'INT MONETARY FUND', 'CLIMA',
    'METEOR', 'OFFICE', 'ENVIR', 'CONSORTIUM', 'OBSERVAT', 'AGRI', 'MIT ', 'INFN', 'SUNY '];
  const hasDigit = s => /[0-9]/.test(s);
  function affIndex(affL) { const idx = []; for (const tag of U_TAGS) affL.forEach((a, j) => { if (a.indexOf(tag) >= 0) idx.push(j); }); return idx; }
  B.AU_UN = function (M, sep = ';') {
    const db = B.db(M); const hasRP = Array.isArray(M.RP);
    const AFFs = M.C1.map((c, i) => { let a = isNA(c) ? null : c.replace(/\[.*?\] /g, ''); if (isNA(a)) a = hasRP ? M.RP[i] : null; if (!isNA(a) && a.length === 0) a = null; return a; });
    const out = AFFs.map(a => {
      const l = a === null ? [null] : a.split(sep).filter((x, k, arr) => !(k === arr.length - 1 && x === ''));
      const index = [];
      for (let raw of l) {
        const li = raw === null ? 'NA' : raw.replace(/\(REPRINT AUTHOR\)/g, '');
        const affL = li.split(','); if (affL.length && affL[affL.length - 1] === '') affL.pop();
        const indd = affIndex(affL);
        if (!indd.length) { index.push('NOTREPORTED'); continue; }
        const aff = affL.filter(x => !hasDigit(x)); const ind = indd.filter(j => !hasDigit(affL[j]));
        if (ind.length < 1) index.push('NOTDECLARED');
        else { const pos = ind[0]; const val = aff[pos]; index.push(val === undefined ? 'NA' : val); }
      }
      let x = ''; if (index.length) { x = index.map(trimLeading).join(';'); x = x.split(' ,').join(';'); }
      return x;
    });
    let AU_UN = out;
    if ((db === 'ISI' || db === 'OPENALEX') && Array.isArray(M.C3)) AU_UN = AU_UN.map((x, i) => (!isNA(M.C3[i]) && M.C3[i] !== '') ? strsplit(M.C3[i], sep).map(trim).join(sep) : x);
    AU_UN = AU_UN.map(x => isNA(x) ? x : x.replace(/\\&/g, 'AND').replace(/&/g, 'AND'));
    AU_UN = AU_UN.map((x, i) => {
      if (AFFs[i] === null) return null;
      if (x === 'NOTDECLARED' || x === 'NOTREPORTED') return null;
      return x.replace(/NOTREPORTED;/g, '').replace(/;NOTREPORTED/g, '').replace(/NOTDECLARED;/g, '').replace(/NOTDECLARED/g, '');
    });
    M.AU_UN = AU_UN; return M;
  };
  B.CR_SO = function (M, sep = ';') {
    const db = B.db(M); const out = new Array(M.n).fill(null);
    for (let i = 0; i < M.n; i++) {
      let refs = strsplit(isNA(M.CR[i]) ? null : String(M.CR[i]).replace(/DOI;/g, 'DOI '), sep);
      if (db === 'ISI') { const el = refs.map(r => r === null ? ['NA'] : r.split(','));
        const mx = Math.max(...el.map(e => e.length)); if (mx > 2) out[i] = el.filter(e => e.length > 2).map(e => trimLeading(e[2])).join(';'); }
      else if (db === 'SCOPUS') { refs = refs.map(r => r === null ? 'NA' : r.replace(/.*\) /, '')); const el = refs.map(r => r.split(','));
        if (el.length) { const mx = Math.max(...el.map(e => e.length)); if (mx > 2) out[i] = el.filter(e => e.length > 2).map(e => trimLeading(e[0])).join(';'); } }
    }
    M.CR_SO = out; return M;
  };
  B.CR_AU = function (M, sep = ';') {
    M.CR_AU = M.CR.map(c => strsplit(isNA(c) ? null : String(c).replace(/DOI;/g, 'DOI '), sep).filter(l => l !== null && l.length > 10)
      .map(l => trimLeading(l.replace(/,.*/, '')).replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '')).join(';'));
    return M;
  };
  B.meta = function (M, field) { const c = B.clone(M); B[field](c); return c; };
  B.clone = function (M) { const c = { n: M.n }; for (const k of Object.keys(M)) if (k !== 'n') c[k] = Array.isArray(M[k]) ? M[k].slice() : M[k]; return c; };
  B.subset = function (M, idx) { const c = { n: idx.length }; for (const k of Object.keys(M)) if (k !== 'n') c[k] = Array.isArray(M[k]) ? idx.map(i => M[k][i]) : M[k]; return c; };

  // ---------- tableTag
  B.tableTag = function (M, Tag = 'CR', sep = ';') {
    const seen = new Set(); const keep = []; for (let i = 0; i < M.n; i++) { if (!seen.has(M.SR[i])) { seen.add(M.SR[i]); keep.push(i); } }
    let col;
    if (Tag === 'TI' || Tag === 'AB') col = B.termExtraction(B.subset(M, keep), Tag);
    else col = keep.map(i => M[Tag] ? M[Tag][i] : null);
    if (Tag === 'C1') col = col.map(v => isNA(v) ? v : v.replace(/\[.+?]/g, ''));
    let tab = []; for (const v of col) for (const p of strsplit(isNA(v) ? null : String(v), sep)) { if (p === null) continue; const t = trim(p.replace(/[ \t\n\r\f\v]+|\.|,/g, ' ')); if (t.length > 0) tab.push(t); }
    return sortTable(tab);
  };

  // ---------- biblioAnalysis + summary (Main information)
  B.analysis = function (M, sep = ';') {
    const R = { Articles: M.n };
    const PY = M.PY.map(v => isNA(v) ? null : Number(v));
    const listAU = M.AU.map(a => strsplit(a, sep).map(x => x === null ? null : trim(x)));
    const nAU = listAU.map(l => l.length);
    const AU = [].concat(...listAU); R.Authors = sortTable(AU);
    const frac = new Map(); listAU.forEach((l, i) => l.forEach(a => { const k = a === null ? 'NA' : a; frac.set(k, (frac.get(k) || 0) + 1 / nAU[i]); }));
    R.AuthorsFrac = Array.from(frac.entries()).sort((a, b) => cmp(a[0], b[0])).sort((a, b) => b[1] - a[1]);
    const first = listAU.map(l => l.length ? l[0] : null);
    R.FirstAuthors = first; R.nAUperPaper = nAU; R.Appearances = sum(nAU); R.nAuthors = R.Authors.length;
    R.AuSingleAuthoredArt = unique(first.filter((f, i) => nAU[i] === 1)).length;
    R.AuMultiAuthoredArt = R.nAuthors - R.AuSingleAuthoredArt;
    const Y = CURRENT_YEAR();
    R.TC = M.TC.map(v => isNA(v) ? null : Number(v)); R.TCperYear = R.TC.map((t, i) => (isNA(t) || isNA(PY[i])) ? null : t / (Y - PY[i] + 1));
    // MostCitedPapers with NTC = TC / mean(TC of the same year)
    const byY = new Map(); PY.forEach((p, i) => { const k = String(p); if (!byY.has(k)) byY.set(k, []); byY.get(k).push(R.TC[i]); });
    const meanY = new Map(Array.from(byY.entries()).map(([k, v]) => [k, v.some(isNA) ? NaN : v.reduce((s, x) => s + x, 0) / v.length]));
    R.MostCitedPapers = M.SR.map((s, i) => ({ Paper: s, DOI: isNA(M.DI[i]) ? null : M.DI[i], TC: R.TC[i], TCperYear: R.TCperYear[i], NTC: R.TC[i] / meanY.get(String(PY[i])) }))
      .map((r, i) => Object.assign(r, { _i: i })).sort((a, b) => ((isNA(b.TC) ? -Infinity : b.TC) - (isNA(a.TC) ? -Infinity : a.TC)) || (a._i - b._i));
    R.nReferences = B.has(M, 'CR') ? B.tableTag(M, 'CR', sep).length : 0;
    R.ID = B.has(M, 'ID') ? B.tableTag(M, 'ID', sep) : []; R.DE = B.has(M, 'DE') ? B.tableTag(M, 'DE', sep) : [];
    R.Sources = sortTable(M.SO.map(s => isNA(s) ? null : String(s).split(',').join('')));
    R.Years = PY;
    if (B.has(M, 'C1')) {
      const MU = B.has(M, 'AU_UN') ? M : B.meta(M, 'AU_UN');
      const listAFF = MU.AU_UN.map(a => { const l = isNA(a) ? [null] : a.split(sep); return l.length ? l : ['NA']; });
      const AFF = [].concat(...listAFF).map(a => a === null ? null : trimLeading(a)); R.Affiliations = sortTable(AFF);
      const M1 = B.has(M, 'AU1_CO') ? M : B.meta(M, 'AU1_CO'); R.CO = M1.AU1_CO;
      R.Countries = B.tableTag(M1, 'AU1_CO');
      const M2 = B.has(M1, 'AU_CO') ? M1 : B.meta(M1, 'AU_CO');
      R.CountryCollaboration = R.Countries.map(([co, n]) => { let scp = 0; for (let i = 0; i < M2.n; i++) { if (isNA(M2.AU_CO[i])) continue; const u = unique(M2.AU_CO[i].split(';')); if (u.length === 1 && M2.AU1_CO[i] === co) scp++; }
        return { Country: co, SCP: scp, MCP: n - scp }; });
      R._MCO = M2;
    } else { R.CO = new Array(M.n).fill(null); R.Countries = []; R.CountryCollaboration = []; }
    R.Documents = B.has(M, 'DT') ? table(M.DT) : null;
    const MC = R._MCO || (B.has(M, 'AU_CO') ? M : B.meta(M, 'AU_CO'));
    const coll = MC.AU_CO.map(s => unique(strsplit(s, sep).map(x => x === null ? 'NA' : x)).length > 1);
    R.IntColl = coll.filter(Boolean).length / M.n * 100;
    return R;
  };
  // R's format(x, digits = d): d significant digits, trailing zeros dropped
  // R's format(x, digits = d) / signif: d significant digits; an exact binary tie rounds to even (as C's printf does)
  function fmt(x, d) { if (!isFinite(x)) return String(x); if (x === 0) return '0'; return String(signifR(x, d)); }
  function signifR(x, d) { const e = Math.floor(Math.log10(Math.abs(x))); const p = d - 1 - e; return roundR(x, p); }
  // R's round(x, digits): ties go to even when x is exactly representable as a tie
  function roundR(x, digits = 0) { if (!isFinite(x)) return x; const f = 10 ** digits; const v = x * f; const fl = Math.floor(v);
    if (Math.abs(v - fl - 0.5) < 1e-7) { // decide from the exact decimal value of x
      const str = Math.abs(x).toFixed(Math.min(100, Math.max(0, digits) + 40)); const tail = str.slice(str.indexOf('.') + 1 + Math.max(0, digits));
      const up = /^50*$/.test(tail) ? (fl % 2 !== 0) : tail[0] >= '5'; const r = Math.abs(x) === -x && x !== 0 ? -1 : 1;
      if (r < 0) { const av = Math.abs(v), afl = Math.floor(av); const up2 = /^50*$/.test(tail) ? (afl % 2 !== 0) : tail[0] >= '5'; return -(up2 ? afl + 1 : afl) / f; }
      return (up ? fl + 1 : fl) / f; }
    return Math.round(v) / f; }
  B.roundR = roundR; B.signifR = signifR;
  B.fmt = fmt;
  B.mainInfo = function (M, R) {
    const yrs = R.Years.filter(v => !isNA(v)); const ymin = Math.min(...yrs), ymax = Math.max(...yrs);
    const Yt = table(R.Years.filter(v => !isNA(v)).map(String)).sort((a, b) => +a[0] - +b[0]); const ny = +Yt[Yt.length - 1][0] - +Yt[0][0];
    const cagr = Math.round(((Yt[Yt.length - 1][1] / Yt[0][1]) ** (1 / ny) - 1) * 100 * 100) / 100;
    const tcm = mean(R.TC), tcmy = mean(R.MostCitedPapers.map(r => r.TCperYear));
    const age = CURRENT_YEAR() - mean(R.Years);
    const rows = [['MAIN INFORMATION ABOUT DATA', ''], ['Timespan', `${ymin}:${ymax}`], ['Sources (Journals, Books, etc)', String(R.Sources.length)], ['Documents', String(R.Articles)],
      ['Annual Growth Rate %', fmt(cagr, 4)], ['Document Average Age', fmt(age, 3)], ['Average citations per doc', fmt(tcm, 4)],
      ['Average citations per year per doc', fmt(tcmy, 4)], ['References', String(R.nReferences)]];
    if (R.Documents) { rows.push(['DOCUMENT TYPES', '']); for (const [k, v] of R.Documents) rows.push([k.toLowerCase().replace(/[0-9]+/g, '').replace(/[.:]/g, '').trim(), String(v)]); }
    rows.push(['DOCUMENT CONTENTS', ''], ['Keywords Plus (ID)', String(R.ID.length)], ["Author's Keywords (DE)", String(R.DE.length)], ['AUTHORS', ''],
      ['Authors', String(R.nAuthors)], ['Author Appearances', String(R.Appearances)], ['Authors of single-authored docs', String(R.AuSingleAuthoredArt)],
      ['AUTHORS COLLABORATION', ''], ['Single-authored docs', String(R.nAUperPaper.filter(x => x === 1).length)], ['Documents per Author', fmt(R.Articles / R.nAuthors, 3)],
      ['Co-Authors per Doc', fmt(mean(R.nAUperPaper), 3)], ['International co-authorships %', fmt(R.IntColl, 4)], ['', '']);
    return { cagr: cagr, rows: rows };
  };

  // ---------- h-index by author or source
  B.Hindex = function (M, field = 'author', sep = ';') {
    const Y = CURRENT_YEAR(); const rows = [];
    for (let i = 0; i < M.n; i++) { const tc = M.TC[i]; if (isNA(tc)) continue;
      const items = field === 'author' ? strsplit(isNA(M.AU[i]) ? null : trimES(M.AU[i].replace(/,/g, ' ')), sep).map(x => x === null ? 'NA' : trim(x)) : [isNA(M.SO[i]) ? null : M.SO[i]];
      for (const it of items) rows.push([it, Number(tc), M.PY[i]]); }
    const g = new Map(); for (const [k, tc, py] of rows) { if (!g.has(k)) g.set(k, { tc: [], py: [] }); g.get(k).tc.push(tc); g.get(k).py.push(py); }
    const out = [];
    for (const [k, v] of g) { const s = v.tc.slice().sort((a, b) => b - a); let h = 0; s.forEach((x, j) => { if (j + 1 <= x) h = j + 1; });
      let gi = 0, cs = 0; s.forEach((x, j) => { cs += x; if (j + 1 <= cs / (j + 1)) gi = j + 1; });
      const start = Math.min(...v.py.filter(p => !isNA(p)));
      if (!(s[0] >= 1)) continue;            // bibliometrix drops elements whose h-index is undefined (no citations)
      out.push({ Element: k, h_index: h, g_index: gi, m_index: h / (Y - start + 1), TC: v.tc.reduce((a, b) => a + b, 0), NP: v.tc.length, PY_start: start }); }
    out.sort((a, b) => cmp(a.Element === null ? 'NA' : a.Element, b.Element === null ? 'NA' : b.Element));
    return out;
  };

  // ---------- co-occurrence matrices (sparse): rows = documents, columns = items
  function reduceRefs(a) { const m = a.match(/V[0-9]/); if (m && m.index > 0) a = a.slice(0, m.index); const d = a.indexOf('DOI '); if (d > 0) a = a.slice(0, d); return a; }
  // R's regexec("*V[0-9]") behaves like "V[0-9]" anywhere; a match at position 1 gives an empty string
  function reduceRefsR(a) { let m = a.search(/V[0-9]/); if (m >= 0) a = a.slice(0, m); const d = a.indexOf('DOI '); if (d >= 0) a = a.slice(0, d); return a; }
  B.cocMatrix = function (M, Field, opts = {}) {
    const sep = opts.sep || ';'; const binary = opts.binary !== false;
    let col = M[Field] || new Array(M.n).fill(null);
    if (Field === 'CR') col = col.map(v => isNA(v) ? v : String(v).replace(/DOI;/g, 'DOI '));
    let Fi = col.map(v => strsplit(isNA(v) ? null : String(v), sep).map(x => x === null ? null : trimLeading(x)));
    if (['ID', 'DE', 'TI', 'TI_TM', 'AB', 'AB_TM'].includes(Field)) Fi = Fi.map(l => l.map(x => x === null ? null : trim(x)));
    let allField = [];
    if (Field === 'CR') {
      Fi = Fi.map(l => l.filter(x => x !== null && x.length > 10));
      const norm = l => { let x = l.replace(/\).*/, ')'); x = x.replace(/,/g, ' ').replace(/;/g, ' '); return x; };
      Fi = Fi.map(l => l.map(norm).filter(x => x.length > 0).map(reduceRefsR).map(trimES));
      for (const l of Fi) for (const x of l) allField.push(x);
      // the column names use the first 100 characters for references starting with "("
      allField = allField;   // (bibliometrix trims "(" references to 100 characters; WoS and Scopus references do not start with "(")
    } else {
      const norm = x => { let s = x.replace(/,/g, ';'); s = s.replace(';', ','); s = s.replace(';', ','); s = s.replace(/;.*/, ''); return s; };
      Fi = Fi.map(l => l.map(x => x === null ? null : norm(x)).filter(x => x === null || x.length > 0).map(x => x === null ? null : trim(x)));
      for (const l of Fi) for (const x of l) if (x !== null) allField.push(x);
    }
    const tab = sortTable(allField); let names = tab.map(t => t[0]);
    if (opts.n) { let n = opts.n; if (names.slice(0, n).includes('NA')) n++; names = names.slice(0, n); }
    else if (opts.short) names = tab.filter(t => t[1] > 1).map(t => t[0]);
    names = names.filter(x => x !== 'NA');
    const idx = new Map(names.map((x, j) => [x, j]));
    const rows = Fi.map(l => { const m = new Map(); for (const x of l) { if (x === null) continue; const j = idx.get(x); if (j === undefined) continue; m.set(j, binary ? 1 : (m.get(j) || 0) + 1); } return m; });
    return { names: names, rows: rows, nrow: M.n };
  };
  // crossprod(W, W) as a symmetric count map {i: Map(j -> count)} including the diagonal
  B.crossprod = function (W) {
    const k = W.names.length; const adj = Array.from({ length: k }, () => new Map());
    for (const r of W.rows) { const ent = Array.from(r.entries()); for (let a = 0; a < ent.length; a++) { const [i, wi] = ent[a];
      for (let b = a; b < ent.length; b++) { const [j, wj] = ent[b]; const v = wi * wj; adj[i].set(j, (adj[i].get(j) || 0) + v); if (i !== j) adj[j].set(i, (adj[j].get(i) || 0) + v); } } }
    return { names: W.names, adj: adj };
  };
  // t(W) %*% W for documents (coupling): documents x documents through shared items
  B.crossprodT = function (W) {
    const byItem = new Map(); W.rows.forEach((r, d) => r.forEach((w, j) => { if (!byItem.has(j)) byItem.set(j, []); byItem.get(j).push([d, w]); }));
    const adj = Array.from({ length: W.nrow }, () => new Map());
    for (const list of byItem.values()) for (let a = 0; a < list.length; a++) for (let b = a; b < list.length; b++) { const [i, wi] = list[a], [j, wj] = list[b];
      adj[i].set(j, (adj[i].get(j) || 0) + wi * wj); if (i !== j) adj[j].set(i, (adj[j].get(i) || 0) + wi * wj); }
    return adj;
  };
  // biblioNetwork: returns {names, adj}
  B.labelShort = function (names, db) {
    const year = names.map(l => { const m = l.match(/.*(\d{4}).*/); return m ? m[1] : ''; });
    let lab;
    if (db === 'isi') lab = names.map((l, i) => { const p = l.split(' '); return `${p[0]} ${p[1] === undefined ? 'NA' : p[1]} ${year[i]}`; });
    else if (db === 'scopus') lab = names.map((l, i) => `${l.split('. ')[0]}. ${year[i]}`);
    else lab = names.slice();
    const t = sortTable(lab); const dups = t.filter(e => e[1] > 1).map(e => e[0]);
    for (const d of dups) { let k = 0; lab = lab.map(x => (x === d ? `${x}-${++k}` : x)); }
    return lab;
  };
  B.biblioNetwork = function (M, analysis, network, opts = {}) {
    const sep = ';'; let net;
    const W = f => B.cocMatrix(M, f, { sep: sep, n: opts.n, short: opts.short });
    if (analysis === 'co-occurrences') net = B.crossprod(W({ authors: 'AU', keywords: 'ID', author_keywords: 'DE', titles: 'TI_TM', abstracts: 'AB_TM', sources: 'SO' }[network]));
    else if (analysis === 'co-citation') net = B.crossprod(W({ authors: 'CR_AU', references: 'CR', sources: 'CR_SO' }[network]));
    else if (analysis === 'collaboration') net = B.crossprod(W({ authors: 'AU', universities: 'AU_UN', countries: 'AU_CO' }[network]));
    else if (analysis === 'coupling') {
      if (network === 'references') { const w = W('CR'); net = { names: M.SR.slice(), adj: B.crossprodT(w) }; }
      else { const unitF = { authors: 'AU', sources: 'SO', countries: 'AU_CO' }[network]; const wu = W(unitF), wc = W('CR');
        // CRA = t(WCR) %*% WU (refs x units); NetMatrix = t(CRA) %*% CRA (units x units)
        const cra = Array.from({ length: wc.names.length }, () => new Map());
        for (let d = 0; d < M.n; d++) wc.rows[d].forEach((a, r) => wu.rows[d].forEach((b, u) => cra[r].set(u, (cra[r].get(u) || 0) + a * b)));
        const adj = Array.from({ length: wu.names.length }, () => new Map());
        for (const row of cra) { const ent = Array.from(row.entries()); for (let a = 0; a < ent.length; a++) for (let b = a; b < ent.length; b++) { const [i, x] = ent[a], [j, y] = ent[b];
          adj[i].set(j, (adj[i].get(j) || 0) + x * y); if (i !== j) adj[j].set(i, (adj[j].get(i) || 0) + x * y); } }
        net = { names: wu.names, adj: adj }; }
    }
    // drop empty names
    const keep = net.names.map((x, i) => (x !== null && String(x).length !== 0 ? i : -1)).filter(i => i >= 0);
    if (keep.length !== net.names.length) net = B.subNet(net, keep);
    if (network === 'references' && B.db(M) === 'SCOPUS') net = B.subNet(net, net.names.map((x, i) => (/^[A-Za-z]/.test(x) ? i : -1)).filter(i => i >= 0));
    if (network === 'references' && opts.shortlabel !== false) net.names = B.labelShort(net.names, B.db(M) === 'ISI' ? 'isi' : B.db(M).toLowerCase());
    return net;
  };
  B.subNet = function (net, keep) { const pos = new Map(keep.map((i, k) => [i, k]));
    return { names: keep.map(i => net.names[i]), adj: keep.map(i => { const m = new Map(); net.adj[i].forEach((v, j) => { if (pos.has(j)) m.set(pos.get(j), v); }); return m; }) }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = B; else root.BX = B;
})(typeof self !== 'undefined' ? self : this);
