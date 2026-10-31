// Compares the JavaScript analyses with bibliometrix (desktop app) outputs on the same records.
const B = require('../app/js/biblio_analyses.js');
const ref = d => require('./ref/' + d);
const cj = ref('countries.json'); B.COUNTRIES = cj.countries.map((c, i) => ({ name: c, continent: cj.continent[i], lon: cj.Longitude[i], lat: cj.Latitude[i] }));
B.STOPWORDS = ref('stop_words_en.json');
const only = process.argv.slice(3); const sets = (process.argv[2] || 'management,scopus,wos').split(',');
const near = (a, b) => { if (typeof b === 'number' && isNaN(b)) b = null; if (a === null || a === undefined || a === 'NA') return b === null || b === undefined || b === 'NA' || b === ''; if (typeof a === 'number' || typeof b === 'number') { const x = Number(a), y = Number(b); if (isNaN(x) && isNaN(y)) return true; return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y)); } return String(a).trim() === String(b).trim(); };
let total = { exact: 0, partial: 0, fail: 0 };
for (const ds of sets) {
  const recs = ref(ds + '/M.json'); const res = ref(ds + '/results.json');
  const M = B.fromRecords(recs.map(r => { const o = Object.assign({}, r); delete o._row; return o; }));
  let R; try { R = B.analysis(M); } catch (e) { console.log(ds, 'analysis failed', e.stack); continue; }
  console.log(`\n=== ${ds} (${M.n} records, DB ${B.db(M)})`);
  for (const id of Object.keys(res)) {
    if (only.length && !only.includes(id)) continue;
    const exp = res[id]; let got, err = '';
    try { got = B.run(id, M, R, {}); } catch (e) { err = e.message; }
    if (exp.error) { console.log(`${(err ? 'BOTH-ERR' : 'R-ERR   ').padEnd(9)} ${id.padEnd(22)} R: ${exp.error.slice(0, 60)}${err ? ' | JS: ' + err.slice(0, 50) : ''}`); continue; }
    if (err) { console.log(`JS-ERR    ${id.padEnd(22)} ${err.slice(0, 120)}`); total.fail++; continue; }
    const et = exp.table; if (!et || !Object.keys(et).length || !got.table) { console.log(`NO-TABLE  ${id.padEnd(22)} (R had ${et ? Object.keys(et).length : 0} cols)`); continue; }
    const ecols = Object.keys(et).filter(c => c !== '_row'); const nrow = (et[ecols[0]] || []).length;
    const gcols = got.table.cols; const missing = ecols.filter(c => !gcols.includes(c));
    let same = 0; const diffs = [];
    const n = Math.min(nrow, got.table.rows.length);
    for (let i = 0; i < nrow; i++) { const g = got.table.rows[i]; let ok = !!g;
      if (g) for (const c of ecols) { const j = gcols.indexOf(c); if (j < 0) continue; if (!near(et[c][i], g[j])) { ok = false; if (diffs.length < 3) diffs.push(`r${i + 1} ${c}: R=${JSON.stringify(et[c][i]).slice(0, 60)} JS=${JSON.stringify(g[j]).slice(0, 60)}`); } }
      if (ok) same++; }
    const tag = (same === nrow && got.table.rows.length === nrow && !missing.length) ? 'EXACT' : same / Math.max(1, nrow) >= 0.9 ? 'MOSTLY' : 'DIFF';
    if (tag === 'EXACT') total.exact++; else if (tag === 'MOSTLY') total.partial++; else total.fail++;
    console.log(`${tag.padEnd(9)} ${id.padEnd(22)} rows R=${nrow} JS=${got.table.rows.length} same=${same}${missing.length ? ' missing cols ' + missing.join(',') : ''}${diffs.length && tag !== 'EXACT' ? '\n            ' + diffs.join('\n            ') : ''}`);
  }
}
console.log('\nTOTAL', JSON.stringify(total));
