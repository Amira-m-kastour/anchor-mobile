/* ANCHOR Mobile - the bibliometric analyses (same ids, labels and tables as ANCHOR Studio's desktop app).
   run(id, M, R, opts) returns {table: {cols, rows}, chart: {...}, note}. Charts are drawn by charts.js. */
(function (root) {
  'use strict';
  const B = (typeof module !== 'undefined' && module.exports) ? require('./biblio_core.js') : root.BX;
  const N = (typeof module !== 'undefined' && module.exports) ? require('./network.js') : root.NET;
  const { isNA, strsplit, sortTable, table, unique, sum, mean, cmp, trim } = B;
  const T = (cols, rows) => ({ cols: cols, rows: rows });
  const head = (a, n) => a.slice(0, n);
  const r2 = x => (isNA(x) ? null : B.roundR(x, 2));
  // R's tools::toTitleCase (as used on tolower(x) by the desktop app), ported token by token
  const TT_ALONE = new Set(['2D', '3D', 'AIC', 'BayesX', 'GoF', 'HTML', 'LaTeX', 'MonetDB', 'OpenBUGS', 'TeX', 'U.S.', 'U.S.A.', 'WinBUGS', 'aka', 'et', 'al.', 'ggplot2', 'i.e.', 'jar', 'jars', 'ncdf', 'netCDF', 'rgl', 'rpart', 'xls', 'xlsx',
    'all', 'above', 'after', 'along', 'also', 'among', 'any', 'both', 'can', 'few', 'it', 'less', 'log', 'many', 'may', 'more', 'over', 'some', 'their', 'then', 'this', 'under', 'until', 'using', 'von', 'when', 'where', 'which', 'will', 'without', 'yet', 'you', 'your']);
  const TT_SMALL = /^(a|an|and|are|as|at|be|but|by|en|for|if|in|is|nor|not|of|on|or|per|so|the|to|v[.]?|via|vs[.]?|from|into|than|that|with)$/i;
  const titleCase = text => { const x = text.toLowerCase(); const xx = []; let cur = '';
    for (const ch of x) { if (' -/"()\n\t'.includes(ch)) { if (cur) xx.push(cur); xx.push(ch); cur = ''; } else cur += ch; } if (cur) xx.push(cur);
    const alone = xx.map(t => TT_ALONE.has(t) || /^'.*'$/.test(t)); const havecaps = xx.map(t => /^[A-Za-z].*[A-Z]+/.test(t));
    const l = xx.map(t => TT_SMALL.test(t)); if (l.length) l[0] = false;
    xx.forEach((t, i) => { if (/[-:]$/.test(t) && i + 2 < l.length && xx[i + 1] === ' ' && /^['A-Za-z0-9]/.test(xx[i + 2])) l[i + 2] = false; if (t === '"' && i + 1 < l.length) l[i + 1] = false; });
    return xx.map((t, i) => { if (l[i]) return t.toLowerCase(); if (havecaps[i] || [...t].length === 1 || alone[i]) return t;
      const c = [...t]; if (c.length >= 3 && (c[0] === "'" || c[0] === '"')) return c[0] + c[1].toUpperCase() + c.slice(2).join('').toLowerCase(); return c[0].toUpperCase() + c.slice(1).join('').toLowerCase(); }).join(''); };
  B.titleCase = titleCase;
  const niceCountry = s => { const t = titleCase(s); return t === 'Usa' ? 'USA' : t === 'Uk' ? 'UK' : t; };
  // R quantile(type 7)
  function quantile(xs, p) { const v = xs.filter(x => !isNA(x)).sort((a, b) => a - b); if (!v.length) return NaN; const h = (v.length - 1) * p; const lo = Math.floor(h); return v[lo] + (h - lo) * ((v[lo + 1] !== undefined ? v[lo + 1] : v[lo]) - v[lo]); }
  // R round(): half to even at .5
  function rround(x) { const f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }
  B.quantile = quantile; B.rround = rround;
  function rank(v) { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); let i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; } return r; }
  const FIELD_LABEL = { DE: 'author keywords', ID: 'Keywords Plus', TI: 'titles', AB: 'abstracts' };
  const needRefs = M => { B.need(M, 'CR', 'cited references'); };

  function bar(df, x, y, title, ylab, n = 20, colour) { return { type: 'bar', title: title, x: head(df, n).map(r => r[x]), y: head(df, n).map(r => r[y]), ylab: ylab, colour: colour }; }
  function prodOverTime(M, tag, what, title, top = 5) {
    const M2 = B.has(M, tag) ? M : B.meta(M, tag); const rows = [];
    for (let i = 0; i < M2.n; i++) { if (isNA(M2.PY[i])) continue; const x = unique(strsplit(M2[tag][i], ';').map(s => s === null ? null : trim(s))).filter(s => s !== null && s.length && !['NA', 'NOTREPORTED', 'NOTDECLARED'].includes(s));
      for (const it of x) rows.push([it, M2.PY[i]]); }
    if (!rows.length) throw new Error(`No ${what.toLowerCase()} could be read from this dataset.`);
    const keep = head(sortTable(rows.map(r => r[0])).map(e => e[0]), top); const ys = rows.map(r => r[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const out = []; const series = [];
    for (const k of keep) { let c = 0; const pts = []; for (let y = y0; y <= y1; y++) { c += rows.filter(r => r[0] === k && r[1] === y).length; out.push([niceCountry(k), y, c]); pts.push([y, c]); } series.push({ name: niceCountry(k), points: pts }); }
    return { table: T([what, 'Year', 'Articles'], out), chart: { type: 'lines', title: title, series: series, xlab: 'Year', ylab: 'Cumulative articles' } };
  }

  const A = {};
  // ---- Overview
  A.main_info = { group: 'Overview', label: 'Main information', run(M, R) { const mi = B.mainInfo(M, R);
    return { table: T(['Description', 'Results'], mi.rows), note: 'Equivalent to Biblioshiny > Overview > Main information.' }; } };
  A.annual_prod = { group: 'Overview', label: 'Annual scientific production', run(M) { B.need(M, 'PY', 'publication years');
    const t = table(M.PY.filter(v => !isNA(v)).map(String)).map(([y, n]) => [+y, n]); const y0 = Math.min(...t.map(e => e[0])), y1 = Math.max(...t.map(e => e[0]));
    const rows = []; for (let y = y0; y <= y1; y++) { const e = t.find(x => x[0] === y); rows.push([y, e ? e[1] : 0]); }
    const nz = rows.filter(r => r[1] > 0); const cagr = nz.length > 1 ? r2(((rows[rows.length - 1][1] / Math.max(1, rows.find(r => r[1] > 0)[1])) ** (1 / Math.max(1, y1 - y0)) - 1) * 100) : null;
    return { table: T(['Year', 'Articles'], rows), chart: { type: 'area', title: 'Annual scientific production', x: rows.map(r => r[0]), y: rows.map(r => r[1]), ylab: 'Documents' }, note: 'Annual growth rate: ' + cagr + '%' }; } };
  A.avg_citations = { group: 'Overview', label: 'Average citations per year', run(M) { B.need(M, 'TC', 'citation counts'); B.need(M, 'PY', 'publication years');
    const now = B.CURRENT_YEAR(); const g = new Map(); for (let i = 0; i < M.n; i++) { if (isNA(M.PY[i])) continue; if (!g.has(M.PY[i])) g.set(M.PY[i], []); g.get(M.PY[i]).push(M.TC[i]); }
    const rows = Array.from(g.keys()).sort((a, b) => a - b).map(y => { const tc = g.get(y); const m = mean(tc.map(x => isNA(x) ? null : x)); return [y, tc.length, r2(m), r2(m / Math.max(1, now - y + 1))]; });
    return { table: T(['Year', 'N', 'MeanTCperArt', 'MeanTCperYear'], rows), chart: { type: 'line', title: 'Average citations per year', x: rows.map(r => r[0]), y: rows.map(r => r[3]), ylab: 'Mean citations per article per year' } }; } };
  A.three_field = { group: 'Overview', label: 'Three-field plot', opts: ['tf'], run(M, R, o) {
    const f = (o && o.tf) || ['AU', 'DE', 'SO']; let M2 = M; if (f.includes('AU_CO') && !B.has(M, 'AU_CO')) M2 = B.meta(M2, 'AU_CO'); if (f.includes('CR_SO')) M2 = B.meta(M2, 'CR_SO');
    for (const x of f) if (!['CR_SO', 'AU_CO'].includes(x)) B.need(M2, x, x);
    const n = 15; const W = f.map(x => B.cocMatrix(M2, x, { n: n, binary: x === 'CR' }));
    const docs = W[1].rows.map((r, d) => (r.size > 0 ? d : -1)).filter(d => d >= 0);
    const flows = []; const add = (Wa, Wb, la, lb) => { const m = new Map(); for (const d of docs) Wa.rows[d].forEach((va, i) => Wb.rows[d].forEach((vb, j) => { const k = i + ',' + j; m.set(k, (m.get(k) || 0) + va * vb); }));
      m.forEach((v, k) => { const [i, j] = k.split(',').map(Number); if (v >= 1) flows.push({ from: la + i, to: lb + j, value: v }); }); };
    const n1 = W[0].names.length, n2 = W[1].names.length; add(W[0], W[1], 0, n1); add(W[1], W[2], n1, n1 + n2);
    const nodes = [].concat(W[0].names.map(x => ({ name: x.toLowerCase(), level: 0 })), W[1].names.map(x => ({ name: x.toLowerCase(), level: 1 })), W[2].names.map(x => ({ name: x.toLowerCase(), level: 2 })));
    const used = new Set(); flows.forEach(e => { used.add(e.from); used.add(e.to); });
    return { chart: { type: 'sankey', title: 'Three-field plot', nodes: nodes, flows: flows, used: Array.from(used), fields: f },
      table: T(['From', 'To', 'Value'], flows.sort((a, b) => b.value - a.value).slice(0, 60).map(e => [nodes[e.from].name, nodes[e.to].name, e.value])) }; } };

  // ---- Sources
  A.rel_sources = { group: 'Sources', label: 'Most relevant sources', run(M) { B.need(M, 'SO', 'source titles');
    const df = sortTable(M.SO).map(([s, n]) => ({ Source: s, Documents: n })); return { table: T(['Source', 'Documents'], head(df, 50).map(r => [r.Source, r.Documents])), chart: bar(df, 'Source', 'Documents', 'Most relevant sources', 'Documents') }; } };
  A.local_cited_sources = { group: 'Sources', label: 'Most local cited sources', run(M) { needRefs(M); const M2 = B.meta(M, 'CR_SO');
    const df = B.tableTag(M2, 'CR_SO').map(([s, n]) => ({ Source: s, Citations: n })); return { table: T(['Source', 'Citations'], head(df, 50).map(r => [r.Source, r.Citations])), chart: bar(df, 'Source', 'Citations', 'Most local cited sources', "Citations in the dataset's references", 20, 'accent') }; } };
  A.bradford = { group: 'Sources', label: "Bradford's law", run(M) { B.need(M, 'SO', 'source titles');
    const so = sortTable(M.SO); const n = sum(so.map(e => e[1])); let cum = 0; const cumv = so.map(e => (cum += e[1]));
    const a = cumv.filter(c => c < n * 0.33).length + 1, b = cumv.filter(c => c < n * 0.67).length + 1;
    const Z = so.map((e, i) => (i < a ? 'Zone 1' : i < b ? 'Zone 2' : 'Zone 3'));
    const rows = so.map((e, i) => [e[0], i + 1, e[1], cumv[i], Z[i]]);
    return { table: T(['SO', 'Rank', 'Freq', 'cumFreq', 'Zone'], head(rows, 60)), chart: { type: 'bradford', title: "Core sources by Bradford's law", rank: rows.map(r => r[1]), freq: rows.map(r => r[2]), zone: Z, labels: rows.map(r => r[0]) }, note: 'Zone 1 = core sources (Bradford, 1934).' }; } };
  A.source_impact = { group: 'Sources', label: "Sources' local impact (h-index)", run(M) { B.need(M, 'TC', 'citation counts');
    const h = B.Hindex(M, 'source').sort((x, y) => y.h_index - x.h_index || y.TC - x.TC);
    return { table: T(['Element', 'h_index', 'g_index', 'm_index', 'TC', 'NP', 'PY_start'], head(h, 50).map(r => [r.Element, r.h_index, r.g_index, r.m_index, r.TC, r.NP, r.PY_start])), chart: bar(h, 'Element', 'h_index', "Sources' local impact", 'h-index') }; } };
  A.source_dynamics = { group: 'Sources', label: "Sources' production over time", run(M) { B.need(M, 'SO', 'source titles'); B.need(M, 'PY', 'years');
    const W = B.cocMatrix(M, 'SO'); const cs = W.names.map((_, j) => W.rows.reduce((s, r) => s + (r.get(j) || 0), 0));
    const top = Math.min(5, W.names.length); const deg = cs.slice().sort((a, b) => b - a)[top - 1]; const keep = W.names.map((_, j) => j).filter(j => cs[j] >= deg);
    const yrs = M.PY.filter(v => !isNA(v)); const y0 = Math.min(...yrs), y1 = Math.max(...yrs);
    const rows = []; const acc = keep.map(() => 0);
    for (let y = y0; y <= y1; y++) { keep.forEach((j, k) => { for (let d = 0; d < M.n; d++) if (M.PY[d] === y && W.rows[d].get(j)) acc[k]++; }); rows.push([y].concat(acc.slice())); }
    return { table: T(['Year'].concat(keep.map(j => W.names[j])), rows), chart: { type: 'lines', title: "Sources' production over time", series: keep.map((j, k) => ({ name: W.names[j], points: rows.map(r => [r[0], r[k + 1]]) })), xlab: 'Year', ylab: 'Cumulative documents' } }; } };

  // ---- Authors
  A.rel_authors = { group: 'Authors', label: 'Most relevant authors', run(M, R) { B.need(M, 'AU', 'authors');
    const fr = new Map(R.AuthorsFrac); let df = R.Authors.map(([a, n]) => ({ Author: a, Documents: n, Fractionalized: fr.get(a) }));
    df.sort((x, y) => cmp(x.Author, y.Author)); df.sort((x, y) => y.Documents - x.Documents);
    return { table: T(['Author', 'Documents', 'Fractionalized'], head(df, 50).map(r => [r.Author, r.Documents, r.Fractionalized])), chart: bar(df, 'Author', 'Documents', 'Most relevant authors', 'Documents') }; } };
  A.local_cited_authors = { group: 'Authors', label: 'Most local cited authors', run(M) { needRefs(M); const lc = B.localCitations(M);
    return { table: T(['Author', 'LocalCitations'], head(lc.authors, 50).map(r => [r.Author, r.LocalCitations])), chart: bar(lc.authors, 'Author', 'LocalCitations', 'Most local cited authors', 'Local citations', 20, 'accent') }; } };
  A.author_time = { group: 'Authors', label: "Authors' production over time", run(M) { B.need(M, 'AU', 'authors'); B.need(M, 'PY', 'years');
    const Y = B.CURRENT_YEAR(); const idx = []; for (let i = 0; i < M.n; i++) if (!isNA(M.PY[i])) idx.push(i);
    const pairs = []; for (const i of idx) for (const a of strsplit(M.AU[i], ';')) pairs.push([a === null ? null : a.trim(), i]);
    const counts = sortTable(pairs.map(p => p[0])); const k = Math.min(10, counts.length); const top = counts.slice(0, k).map(e => e[0]); const topSet = new Set(top);
    const g = new Map(); for (const [a, i] of pairs) { if (!topSet.has(a)) continue; const key = a + '\u0000' + M.PY[i]; if (!g.has(key)) g.set(key, { Author: a, year: M.PY[i], freq: 0, TC: 0, TCpY: 0 });
      const e = g.get(key); e.freq++; e.TC += M.TC[i]; e.TCpY += M.TC[i] / (Y - M.PY[i] + 1); }
    const rows = Array.from(g.values()).sort((x, y) => cmp(x.Author, y.Author) || x.year - y.year);
    return { table: T(['Author', 'year', 'freq', 'TC', 'TCpY'], head(rows, 60).map(r => [r.Author, r.year, r.freq, r.TC, r.TCpY])), chart: { type: 'authortime', title: "Authors' production over time", authors: top, points: rows } }; } };
  A.lotka = { group: 'Authors', label: "Lotka's law", run(M, R) { B.need(M, 'AU', 'authors');
    const byN = new Map(); for (const [, n] of R.Authors) byN.set(n, (byN.get(n) || 0) + 1);
    const ks = Array.from(byN.keys()).sort((a, b) => a - b); const tot = sum(ks.map(k => byN.get(k)));
    const rows = ks.map(k => [k, byN.get(k), byN.get(k) / tot]);
    const x = rows.map(r => Math.log10(r[0])), y = rows.map(r => Math.log10(r[2])); const mx = mean(x), my = mean(y);
    const sxy = sum(x.map((v, i) => (v - mx) * (y[i] - my))), sxx = sum(x.map(v => (v - mx) ** 2)); const beta = sxx ? sxy / sxx : NaN; const c0 = my - beta * mx;
    const ssr = sum(y.map((v, i) => (v - (c0 + beta * x[i])) ** 2)), sst = sum(y.map(v => (v - my) ** 2)); const r2v = sst ? 1 - ssr / sst : NaN;
    return { table: T(['Documents', 'Authors', 'Proportion'], rows), chart: { type: 'line', title: "Author productivity through Lotka's law", x: rows.map(r => r[0]), y: rows.map(r => r[2]), xlab: 'Documents written', ylab: '% of authors', percent: true },
      note: `Estimated beta = ${Math.abs(beta).toFixed(2)}, C = ${(10 ** c0).toFixed(2)}, R2 = ${r2v.toFixed(2)}` }; } };
  A.author_impact = { group: 'Authors', label: "Authors' local impact (h-index)", run(M) { B.need(M, 'TC', 'citation counts');
    const h = B.Hindex(M, 'author').sort((x, y) => y.h_index - x.h_index || y.TC - x.TC);
    return { table: T(['Element', 'h_index', 'g_index', 'm_index', 'TC', 'NP', 'PY_start'], head(h, 50).map(r => [r.Element, r.h_index, r.g_index, r.m_index, r.TC, r.NP, r.PY_start])), chart: bar(h, 'Element', 'h_index', "Authors' local impact", 'h-index') }; } };
  A.affiliations = { group: 'Authors', label: 'Most relevant affiliations', run(M, R) { B.need(M, 'C1', 'affiliations');
    const df = R.Affiliations.filter(([a]) => !['NOTREPORTED', 'NOTDECLARED', 'NA'].includes(a)).map(([a, n]) => ({ Affiliation: a, Articles: n }));
    return { table: T(['Affiliation', 'Articles'], head(df, 50).map(r => [r.Affiliation, r.Articles])), chart: bar(df, 'Affiliation', 'Articles', 'Most relevant affiliations', 'Articles') }; } };
  A.aff_time = { group: 'Authors', label: "Affiliations' production over time", run(M) { B.need(M, 'C1', 'affiliations'); return prodOverTime(M, 'AU_UN', 'Affiliation', "Affiliations' production over time"); } };
  A.country_time = { group: 'Authors', label: "Countries' production over time", run(M) { B.need(M, 'C1', 'affiliations'); return prodOverTime(M, 'AU_CO', 'Country', "Countries' production over time"); } };
  A.corr_country = { group: 'Authors', label: "Corresponding author's countries (SCP/MCP)", run(M, R) { B.need(M, 'C1', 'author affiliations');
    let cc = R.CountryCollaboration.slice(); if (!cc.length) throw new Error('No country information in this dataset.');
    cc = cc.map((r, i) => Object.assign({ _i: i }, r)).sort((a, b) => (b.SCP + b.MCP) - (a.SCP + a.MCP) || a._i - b._i).slice(0, 20);
    return { table: T(['Country', 'SCP', 'MCP', 'MCP_ratio'], cc.map(r => [r.Country, r.SCP, r.MCP, B.roundR(r.MCP / (r.SCP + r.MCP), 3)])),
      chart: { type: 'stacked', title: "Corresponding author's countries", x: cc.map(r => r.Country), series: [{ name: 'Single-country publications (SCP)', values: cc.map(r => r.SCP) }, { name: 'Multiple-country publications (MCP)', values: cc.map(r => r.MCP) }], ylab: 'Documents' } }; } };
  A.country_prod = { group: 'Authors', label: "Countries' scientific production (map)", run(M) { B.need(M, 'C1', 'affiliations');
    const M2 = B.meta(M, 'AU_CO'); const df = B.tableTag(M2, 'AU_CO').map(([c, n]) => [c === 'USA' ? 'United States' : c === 'UK' ? 'United Kingdom' : titleCase(c), n]);
    return { table: T(['Country', 'Frequency'], head(df, 60)), chart: { type: 'countrymap', title: "Countries' scientific production (author appearances)", values: df } }; } };
  A.cited_countries = { group: 'Authors', label: 'Most cited countries', run(M, R) { B.need(M, 'TC', 'citation counts'); B.need(M, 'C1', 'author affiliations');
    const g = new Map(); R.CO.forEach((c, i) => { if (isNA(c)) return; if (!g.has(c)) g.set(c, []); g.get(c).push(M.TC[i]); });
    const df = Array.from(g.entries()).sort((a, b) => cmp(a[0], b[0])).map(([c, v]) => ({ Country: c, TotalCitations: sum(v), AvgCitations: B.roundR(mean(v), 1) })).sort((a, b) => b.TotalCitations - a.TotalCitations);
    return { table: T(['Country', 'TotalCitations', 'AvgCitations'], head(df, 40).map(r => [r.Country, r.TotalCitations, r.AvgCitations])), chart: bar(df, 'Country', 'TotalCitations', 'Most cited countries', 'Total citations', 20, 'accent') }; } };

  // ---- Documents
  A.global_cited_docs = { group: 'Documents', label: 'Most global cited documents', run(M, R) { B.need(M, 'TC', 'citation counts');
    const df = R.MostCitedPapers; return { table: T(['Paper', 'DOI', 'TC', 'TCperYear', 'NTC'], head(df, 50).map(r => [r.Paper, r.DOI, r.TC, r.TCperYear, r.NTC])), chart: bar(df, 'Paper', 'TC', 'Most global cited documents', 'Global citations') }; } };
  A.local_cited_docs = { group: 'Documents', label: 'Most local cited documents', run(M) { needRefs(M); const lc = B.localCitations(M);
    return { table: T(['Paper', 'DOI', 'Year', 'LCS', 'GCS'], head(lc.papers, 50).map(r => [r.Paper, r.DOI, r.Year, r.LCS, r.GCS])), chart: bar(lc.papers, 'Paper', 'LCS', 'Most local cited documents', 'Local citations', 20, 'accent') }; } };
  A.local_cited_refs = { group: 'Documents', label: 'Most local cited references', run(M) { needRefs(M);
    const refs = []; for (const c of M.CR) for (const r of strsplit(c, ';')) { if (r === null || r.indexOf(',') < 0) continue; if (r.length >= 3) refs.push(r.replace(/^[ \t\n\r\f\v]+/, '')); }
    const df = sortTable(refs).filter(e => e[0].length > 0).map(([r, n]) => ({ Reference: r, Citations: n, Short: r.slice(0, 70) }));
    return { table: T(['Reference', 'Citations'], head(df, 60).map(r => [r.Reference, r.Citations])), chart: bar(df, 'Short', 'Citations', 'Most local cited references', 'Citations') }; } };
  A.rpys = { group: 'Documents', label: 'Reference spectroscopy (RPYS)', run(M) { needRefs(M); const r = B.rpys(M);
    return { table: T(['Year', 'Citations', 'diffMedian5', 'diffMedian'], head(r, 100).map(x => [x.Year, x.Citations, x.diffMedian5, x.diffMedian])), chart: { type: 'rpys', title: 'Reference publication year spectroscopy', x: r.map(x => x.Year), y: r.map(x => x.Citations), y2: r.map(x => x.diffMedian5) }, note: 'Peaks show the historical roots of the field.' }; } };

  // ---- Words
  function needField(M, f) { if (f === 'TI' || f === 'AB') B.need(M, f, 'titles/abstracts'); else B.need(M, f, 'keywords'); }
  A.freq_words = { group: 'Words', label: 'Most frequent words', opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; needField(M, f);
    const df = B.tableTag(M, f).map(([w, n]) => ({ Word: w, Occurrences: n })); return { table: T(['Word', 'Occurrences'], head(df, 100).map(r => [r.Word, r.Occurrences])), chart: bar(df, 'Word', 'Occurrences', 'Most frequent words - ' + (FIELD_LABEL[f] || f), 'Occurrences') }; } };
  A.word_cloud = { group: 'Words', label: 'Word cloud', opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords or text');
    const df = head(B.tableTag(M, f), 80); return { table: T(['Word', 'Occurrences'], df), chart: { type: 'wordcloud', words: df } }; } };
  A.treemap = { group: 'Words', label: 'Tree map', opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords or text');
    const df = head(B.tableTag(M, f), 50); const tot = sum(df.map(e => e[1])); const rows = df.map(([w, n]) => [w, n, B.roundR(100 * n / tot, 1)]);
    return { table: T(['Word', 'Occurrences', 'pct'], rows), chart: { type: 'treemap', items: rows } }; } };
  A.word_dynamics = { group: 'Words', label: "Words' frequency over time", opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords');
    const pairs = []; for (let i = 0; i < M.n; i++) for (const t of strsplit(M[f][i], ';')) { if (t === null) continue; const x = t.replace(/^[ \t\n\r\f\v]+/, ''); if (x !== '' && !isNA(M.PY[i])) pairs.push([x, M.PY[i]]); }
    const ys = pairs.map(p => p[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys); const top = head(sortTable(pairs.map(p => p[0])).map(e => e[0]), 8);
    const rows = []; const acc = top.map(() => 0);
    for (let y = y0; y <= y1; y++) { top.forEach((w, k) => { acc[k] += pairs.filter(p => p[0] === w && p[1] === y).length; }); rows.push([y].concat(acc.slice())); }
    return { table: T(['Year'].concat(top), rows), chart: { type: 'lines', title: "Words' cumulative frequency over time", series: top.map((w, k) => ({ name: w, points: rows.map(r => [r[0], r[k + 1]]) })), xlab: 'Year', ylab: 'Cumulative occurrences' } }; } };
  A.trend_topics = { group: 'Words', label: 'Trend topics', opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords'); B.need(M, 'PY', 'years');
    const W = B.cocMatrix(M, f, { binary: false });
    let items = W.names.map((name, j) => { const yrs = []; let n = 0; W.rows.forEach((r, d) => { const c = r.get(j); if (c) { n += c; for (let k = 0; k < c; k++) yrs.push(M.PY[d]); } });
      return { item: name, freq: n, year_q1: rround(quantile(yrs, 0.25)), year_med: rround(quantile(yrs, 0.5)), year_q3: rround(quantile(yrs, 0.75)) }; });
    const meds = items.map(x => x.year_med).filter(x => !isNA(x)); const span = [Math.min(...meds), Math.max(...meds)];
    items = items.map(x => Object.assign({}, x, { item: x.item.toLowerCase() }));
    const byYear = new Map(); for (const it of items) { if (!byYear.has(it.year_med)) byYear.set(it.year_med, []); byYear.get(it.year_med).push(it); }
    const out = []; for (const y of Array.from(byYear.keys()).filter(y => !isNA(y)).sort((a, b) => a - b)) { const l = byYear.get(y).sort((a, b) => b.freq - a.freq || cmp(a.item, b.item)).slice(0, 4).filter(x => x.freq >= 3 && y >= span[0] && y <= span[1]); out.push(...l); }
    return { table: T(['item', 'freq', 'year_q1', 'year_med', 'year_q3'], out.map(r => [r.item, r.freq, r.year_q1, r.year_med, r.year_q3])), chart: { type: 'trend', title: 'Trend topics', items: out } }; } };

  // ---- networks
  function netResult(net, opts, title, note) { if (B._testMembership) opts.membershipByName = B._testMembership; const g = N.build(net, opts); return { table: g.table, chart: { type: 'network', title: title, nodes: g.nodes, edges: g.edges, modularity: g.modularity }, note: note }; }
  A.cooc_net = { group: 'Conceptual structure', label: 'Co-occurrence network', opts: ['field', 'nnodes'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords');
    let M2 = M; if (f === 'TI' || f === 'AB') { M2 = B.clone(M); M2[f + '_TM'] = B.termExtraction(M, f); }
    const net = B.biblioNetwork(M2, 'co-occurrences', { DE: 'author_keywords', ID: 'keywords', TI: 'titles', AB: 'abstracts' }[f] || 'author_keywords');
    return netResult(net, { n: (o && o.nnodes) || 40 }, 'Co-occurrence network - ' + (FIELD_LABEL[f] || f), 'Colours are clusters (Louvain). Node size = occurrences.'); } };
  A.cocit_net = { group: 'Intellectual structure', label: 'Co-citation network', opts: ['nnodes'], slow: true, run(M, R, o) { needRefs(M);
    return netResult(B.biblioNetwork(M, 'co-citation', 'references'), { n: (o && o.nnodes) || 40 }, 'Co-citation network', 'Colours are clusters (Louvain). Node size = degree.'); } };
  A.coupling_net = { group: 'Intellectual structure', label: 'Bibliographic coupling network', opts: ['clevel', 'nnodes'], slow: true, run(M, R, o) { B.need(M, 'CR', 'cited references');
    const lv = (o && o.clevel) || 'references'; const unit = { references: 'documents', sources: 'sources', authors: 'authors' }[lv];
    return netResult(B.biblioNetwork(M, 'coupling', lv), { n: (o && o.nnodes) || 40 }, 'Bibliographic coupling of ' + unit, `Two ${unit} are linked when they cite the same references. Colours are clusters (Louvain).`); } };
  A.collab_net = { group: 'Social structure', label: 'Collaboration network', opts: ['level', 'nnodes'], run(M, R, o) { const lv = (o && o.level) || 'authors'; let M2 = M;
    if (lv === 'countries') M2 = B.meta(M, 'AU_CO'); if (lv === 'universities') M2 = B.meta(M, 'AU_UN');
    return netResult(B.biblioNetwork(M2, 'collaboration', lv), { n: (o && o.nnodes) || 40 }, 'Collaboration network - ' + lv, 'Colours are clusters (Louvain). Node size = degree.'); } };
  A.country_collab_map = { group: 'Social structure', label: "Countries' collaboration world map", run(M) { B.need(M, 'C1', 'affiliations');
    const M2 = B.meta(M, 'AU_CO'); const pairs = new Map();
    for (const s of M2.AU_CO) { const x = unique(strsplit(s, ';').map(v => v === null ? 'NA' : v.trim())).filter(v => v.length && v !== 'NA').sort(cmp); if (x.length < 2) continue;
      for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) { const k = x[i] + '\u0000' + x[j]; pairs.set(k, (pairs.get(k) || 0) + 1); } }
    if (!pairs.size) throw new Error('No international co-authorships in this dataset.');
    const df = Array.from(pairs.entries()).map(([k, v]) => { const [a, b] = k.split('\u0000'); return [a, b, v]; }).sort((a, b) => cmp(a[1], b[1]) || cmp(a[0], b[0])).sort((a, b) => b[2] - a[2]);
    return { table: T(['From', 'To', 'Frequency'], head(df, 100)), chart: { type: 'collabmap', links: head(df, 40) } }; } };

  // thematic map (Cobo et al., 2011, as in bibliometrix::thematicMap): walktrap clusters of the top-250 keywords,
  // centrality and density from the association index e_ij = c_ij / (c_i c_j)
  B.thematicMap = function (M, f, n = 250, minfreq0 = 5) {
    const minfreq = Math.max(2, Math.floor(minfreq0 * M.n / 1000));
    let M2 = M; if (f === 'TI' || f === 'AB') { M2 = B.clone(M); M2[f + '_TM'] = B.termExtraction(M, f); }
    const net = B.biblioNetwork(M2, 'co-occurrences', { DE: 'author_keywords', ID: 'keywords', TI: 'titles', AB: 'abstracts' }[f], { n: n });
    const g = N.select(net, { removeIsolates: true });                       // weighted graph: edge weight = co-occurrences
    const memb = B._testThematic ? g.nodes.map(nd => B._testThematic[nd.name]) : N.walktrap(g, 4, true);
    const C = net.adj.map((m, i) => m.get(i) || 0); const lname = net.names.map(x => String(x).toLowerCase()); const gi = new Map(g.nodes.map((nd, k) => [nd.name, k]));
    const words = []; lname.forEach((w, i) => { if (gi.has(w)) words.push({ w: w, i: i, c: C[i], g: memb[gi.get(w)] }); });
    const kept = words.filter(x => x.c >= minfreq); const keptSet = new Map(kept.map(x => [x.i, x]));
    const groups = unique(kept.map(x => x.g)).sort((a, b) => a - b);
    const info = new Map(groups.map(gr => { const ws = kept.filter(x => x.g === gr); let best = ws[0]; for (const x of ws) if (x.c > best.c) best = x; return [gr, { freq: sum(ws.map(x => x.c)), label: best.w, top: ws.slice().sort((a, b) => b.c - a.c).slice(0, 10) }]; }));
    const stat = new Map(groups.map(gr => [gr, { words1: new Set(), cen: 0, densRaw: [] }]));
    for (const a of kept) net.adj[a.i].forEach((cij, j) => { if (j < a.i || !keptSet.has(j) || !(cij > 0)) return; const b = keptSet.get(j); const e = cij / (C[a.i] * C[j]); if (!(e > 0)) return;
      const st = stat.get(a.g); st.words1.add(a.w); if (a.g !== b.g) st.cen += e; else st.densRaw.push(e); });
    const rows = groups.filter(gr => stat.get(gr).words1.size > 0).map(gr => { const st = stat.get(gr); const nW = st.words1.size; return { gr: gr, n: nW, centrality: st.cen, density: st.densRaw.reduce((s, e) => s + e / nW, 0) * 100 }; });
    const rc = rank(rows.map(r => r.centrality)), rd = rank(rows.map(r => r.density)); rows.forEach((r, k) => { r.rcentrality = rc[k]; r.rdensity = rd[k]; Object.assign(r, info.get(r.gr)); });
    return { rows: rows, words: kept, minfreq: minfreq };
  };
  A.thematic_map = { group: 'Conceptual structure', label: 'Thematic map', opts: ['field'], run(M, R, o) { const f = (o && o.field) || 'DE'; B.need(M, f, 'keywords');
    const tm = B.thematicMap(M, f);
    return { table: T(['name', 'freq', 'centrality', 'density', 'rcentrality', 'rdensity'], tm.rows.map(r => [r.label, r.freq, r.centrality, r.density, r.rcentrality, r.rdensity])),
      chart: { type: 'quadrant', title: 'Thematic map', xlab: 'Relevance degree (Centrality)', ylab: 'Development degree (Density)',
        points: tm.rows.map(r => ({ x: r.rcentrality, y: r.rdensity, size: r.freq, label: r.top.slice(0, 3).map(x => x.w).join(', '), cluster: r.gr, words: r.top.map(x => x.w + ' ' + x.c) })), quadrants: ['Emerging or declining themes', 'Niche themes', 'Basic themes', 'Motor themes'] },
      note: 'Upper right = motor themes; upper left = niche; lower left = emerging or declining; lower right = basic themes.' }; } };

  // clustering by coupling (bibliometrix::couplingMap, documents x references): walktrap clusters of the 250 best-connected
  // documents; centrality = mean PageRank x 100, impact = mean normalised local citation score of documents scoring at least 1
  B.couplingMap = function (M, n = 250, minfreq0 = 3, nLabels = 2) {
    const minfreq = Math.max(0, Math.floor(minfreq0 * M.n / 1000));
    const W = B.cocMatrix(M, 'CR', { short: true }); const adj = B.crossprodT(W);
    let net = { names: M.SR.slice(), adj: adj };
    if (B.db(M) === 'SCOPUS') net = B.subNet(net, net.names.map((x, i) => (/^[A-Za-z]/.test(x) ? i : -1)).filter(i => i >= 0));
    net = B.subNet(net, net.names.map((x, i) => (x && x.length ? i : -1)).filter(i => i >= 0));
    const g = N.select(net, { n: n, removeIsolates: true, weighted: true });
    const memb = B._testCoupling ? g.nodes.map(nd => B._testCoupling[nd.name]) : N.walktrap(g, 4, true); const pr = N.pagerank(g);
    // normalised local citation score per document (LCS of 0 counts as 1 within its year, as bibliometrix does)
    const lc = B.localCitations(M); const rows = lc.papersRaw.map(p => ({ SR: p.SR, PY: p.Year, LCS: p.LCS === 0 ? 1 : p.LCS }));
    const byY = new Map(); rows.forEach(r => { const k = String(r.PY); if (!byY.has(k)) byY.set(k, []); byY.get(k).push(r.LCS); });
    const nlcs = new Map(rows.map(r => [String(r.SR).toUpperCase(), r.LCS / mean(byY.get(String(r.PY)))]));
    const docs = g.nodes.map((nd, i) => ({ name: nd.name, group: memb[i], pr: pr[i], MNLCS: nlcs.has(nd.name.toUpperCase()) ? nlcs.get(nd.name.toUpperCase()) : null }));
    const groups = unique(memb).sort((a, b) => a - b);
    let out = groups.map(gr => { const ds = docs.filter(d => d.group === gr); const imp = ds.map(d => d.MNLCS).filter(v => v !== null && v >= 1);
      const sorted = ds.map(d => Object.assign({}, d, { r: d.MNLCS === null ? null : Math.round(d.MNLCS * 100) / 100 })).sort((a, b) => (b.r === null ? -Infinity : b.r) - (a.r === null ? -Infinity : a.r));
      return { group: gr, freq: ds.length, centrality: mean(ds.map(d => d.pr)) * 100, impact: imp.length ? mean(imp) : 0, label_cluster: gr,
        label: sorted.slice(0, nLabels).map(d => d.name).join('\n'), items: sorted.slice(0, 10).map(d => `${d.name} ${d.r === null ? 'NA' : d.r}`).join('\n') }; });
    const rc = rank(out.map(r => r.centrality)), ri = rank(out.map(r => r.impact)); out.forEach((r, k) => { r.rcentrality = rc[k]; r.rimpact = ri[k]; });
    return out.filter(r => r.freq >= minfreq);
  };
  A.coupling_map = { group: 'Intellectual structure', label: 'Clustering by coupling', slow: true, run(M) { B.need(M, 'CR', 'cited references');
    const rows = B.couplingMap(M);
    return { table: T(['group', 'freq', 'centrality', 'impact', 'label_cluster', 'color', 'label', 'items', 'rcentrality', 'rimpact'], rows.map(r => [r.group, r.freq, r.centrality, r.impact, r.label_cluster, N.color(r.group) + '80', r.label, r.items, r.rcentrality, r.rimpact])),
      chart: { type: 'quadrant', title: 'Clusters by documents coupling', xlab: 'Centrality', ylab: 'Impact', points: rows.map(r => ({ x: r.rcentrality, y: r.rimpact, size: r.freq, label: r.label.replace(/\n/g, '; '), cluster: r.group, words: r.items.split('\n') })) },
      note: "Clusters of documents that share references, placed by centrality (x) and impact (y), as in Biblioshiny's Clustering by Coupling." }; } };
  A.historiograph = { group: 'Intellectual structure', label: 'Historiograph', slow: true, run(M) { needRefs(M); const lc = B.localCitations(M);
    const top = lc.histData.slice().sort((a, b) => b.LCS - a.LCS).slice(0, 20);
    return { table: T(['Paper', 'Title', 'Author_Keywords', 'KeywordsPlus', 'DOI', 'Year', 'LCS', 'GCS'], head(lc.histData, 50).map(r => [r.Paper, r.Title, r.Author_Keywords, r.KeywordsPlus, r.DOI, r.Year, r.LCS, r.GCS])),
      chart: { type: 'historiograph', title: 'Historical direct citation network', nodes: top, links: lc.links.filter(l => top.some(t => t._i === l[0]) && top.some(t => t._i === l[1])) } }; } };

  // ---------- local citations (bibliometrix histNetwork for Web of Science and Scopus)
  B.localCitations = function (M) {
    const db = B.db(M); const n = M.n; let LCS = new Array(n).fill(0); const links = [];
    // Web of Science records are sorted by year first (bibliometrix's wos()); Scopus keeps the original order
    const order = db === 'SCOPUS' ? M.PY.map((p, i) => i) : M.PY.map((p, i) => i).sort((a, b) => (isNA(M.PY[a]) ? Infinity : M.PY[a]) - (isNA(M.PY[b]) ? Infinity : M.PY[b]) || a - b);
    if (db === 'ISI' || db === 'WOS' || db === 'OPENALEX' || db === 'LENS') {
      const SRF = M.SR_FULL || M.SR; const label = i => `${SRF[i]} DOI ${isNA(M.DI[i]) ? '' : String(M.DI[i]).toUpperCase()}`;
      const byLabel = new Map(); for (let i = 0; i < n; i++) { const l = label(i); if (!byLabel.has(l)) byLabel.set(l, []); byLabel.get(l).push(i); }
      for (let i = 0; i < n; i++) for (const ref of strsplit(M.CR[i], ';')) { if (ref === null) continue;
        const di = (ref.split('DOI')[1] || '').trim(); const p = ref.split(','); const au = (p[0] || '').replace(/\./g, ' ').replace(/[ ]{2,}/g, '').trim();
        const lab = `${au}, ${(p[1] === undefined ? 'NA' : p[1]).trim()}, ${(p[2] === undefined ? 'NA' : p[2]).trim()} DOI ${di === 'NA' ? '' : di}`;
        const hit = byLabel.get(lab); if (hit) for (const j of hit) { LCS[j]++; links.push([i, j]); } }
    } else if (db === 'SCOPUS') {
      const firstAu = s => s.replace(/^(.*?),.*$/, '$1').replace(/\. /g, '').replace(/\./g, '').trim();
      const keyOf = i => `${M.PY[i]}\u0000${firstAu(M.SR[i])}`; const byKey = new Map(); for (let i = 0; i < n; i++) { const k = keyOf(i); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(i); }
      const pp = i => { const s = Number(M.BP ? M.BP[i] : NaN), e = Number(M.EP ? M.EP[i] : NaN); return isNaN(s) ? null : `${s}-${e}`; };
      for (let i = 0; i < n; i++) for (const r0 of strsplit(M.CR[i], ';')) { if (r0 === null) continue; const ref = r0.trim(); const m = ref.match(/\((\d{4})\)/); if (!m) continue;
        const ppm = ref.match(/PP\. ([0-9-]+)/); const ppx = ppm ? ppm[1] : ref; if (!/^[0-9]/.test(ppx)) continue;
        const au = ref.replace(/^(.*?),.*$/, '$1').replace(/\. /g, '').replace(/\./g, '').trim();
        for (const j of (byKey.get(`${m[1]}\u0000${au}`) || [])) { const ppy = pp(j); if (ppy !== null && ppx !== ppy) continue; LCS[j]++; links.push([i, j]); } }
    } else throw new Error('Local citations need Web of Science or Scopus records (this database is not supported for direct citations).');
    const histData = order.map(i => ({ _i: i, Paper: (db === 'SCOPUS' ? (M.SR_FULL || M.SR)[i] : `${(M.SR_FULL || M.SR)[i]} DOI ${isNA(M.DI[i]) ? '' : String(M.DI[i]).toUpperCase()}`),
      Title: M.TI[i], Author_Keywords: M.DE[i], KeywordsPlus: M.ID[i], DOI: isNA(M.DI[i]) ? '' : M.DI[i], Year: M.PY[i], LCS: LCS[i], GCS: isNA(M.TC[i]) ? 0 : M.TC[i] }));
    const papersRaw = order.map(i => ({ SR: M.SR[i], Paper: M.SR[i], DOI: isNA(M.DI[i]) ? '' : M.DI[i], Year: M.PY[i], LCS: LCS[i], GCS: isNA(M.TC[i]) ? 0 : M.TC[i] }));
    const papers = papersRaw.slice().sort((a, b) => b.LCS - a.LCS);
    const au = new Map(); order.forEach(i => { for (const a of strsplit(M.AU[i], ';')) { const k = a === null ? 'NA' : a; au.set(k, (au.get(k) || 0) + LCS[i]); } });
    const authors = Array.from(au.entries()).sort((a, b) => cmp(a[0], b[0])).map(([a, v]) => ({ Author: a, LocalCitations: v })).sort((a, b) => b.LocalCitations - a.LocalCitations);
    return { LCS: LCS, histData: histData, papers: papers, papersRaw: papersRaw, authors: authors, links: links };
  };

  // ---------- RPYS
  B.rpys = function (M) {
    const db = B.db(M); const Y = B.CURRENT_YEAR(); const recs = [];
    for (let i = 0; i < M.n; i++) for (let r of strsplit(isNA(M.CR[i]) ? null : String(M.CR[i]).replace(/DOI;/g, 'DOI '), ';')) { if (r === null) continue; r = r.replace(/^[ \t\n\r\f\v]+/, ''); if (r.length <= 10) continue;
      let l = r; if (db === 'ISI') l = l.replace(/\).*/, ')'); l = B.trim(B.trimES(l.replace(/,/g, ' ').replace(/;/g, ' ').replace(/\./g, ' '))); if (!l.length) continue;
      let y; if (db === 'ISI') { const m = l.match(/ ([0-9]{4}) /); y = m ? +m[1] : 0; } else { const m = l.match(/\(([0-9]{4})\)/); y = m ? +m[1] : 0; }
      if (y > 1700 && y <= Y) recs.push(y); }
    const t = new Map(); recs.forEach(y => t.set(y, (t.get(y) || 0) + 1)); const ys = Array.from(t.keys()).sort((a, b) => a - b); if (!ys.length) return [];
    const rows = []; for (let y = ys[0]; y <= ys[ys.length - 1]; y++) rows.push({ Year: y, Citations: t.get(y) || 0 });
    const YY = [0, 0, 0, 0].concat(rows.map(r => r.Citations));
    rows.forEach((r, k) => { const w = YY.slice(k, k + 5).sort((a, b) => a - b); r.diffMedian5 = r.Citations - w[2]; r.diffMedian = Math.max(0, r.diffMedian5); });
    return rows;
  };

  // ---------- title and abstract terms (tidytext tokens, English stop words; approximate to bibliometrix::termExtraction)
  B.STOPWORDS = null;  // set from stop_words_en.json
  B.termExtraction = function (M, Field) {
    const stop = new Set((B.STOPWORDS || []).concat(['elsevier', 'springer', 'wiley', 'mdpi', 'emerald', 'originalityvalue', 'designmethodologyapproach']));
    return M[Field].map(t => { if (isNA(t)) return null; let s = String(t).replace(/ - /g, ' ').toLowerCase().replace(/[^\p{L}\p{N} \t\n\r\f\v-]/gu, '').replace(/-/g, '__').replace(/[0-9]/g, '');
      const toks = s.split(/[^\p{L}\p{N}_]+/u).filter(Boolean).map(w => w.replace(/^__/, '').replace(/__/g, '-').replace(/_/g, ' ')).filter(w => w && !stop.has(w));
      return toks.length ? toks.map(w => w.toUpperCase()).join(';') : null; });
  };

  B.ANALYSES = A;
  B.run = function (id, M, R, opts) { const a = A[id]; if (!a) throw new Error('Unknown analysis ' + id);
    if (['local_cited_sources', 'local_cited_refs', 'rpys'].includes(id) && B.db(M) === 'OPENALEX') throw new Error('This analysis needs cited references written out with source names and years, which OpenAlex gives only as work ids. Use a Web of Science or Scopus export for it; all other analyses run on OpenAlex records.');
    const res = a.run(M, R, opts || {}); res.label = a.label; res.group = a.group; return res; };
  if (typeof module !== 'undefined' && module.exports) module.exports = B; else root.BX = B;
})(typeof self !== 'undefined' ? self : this);
