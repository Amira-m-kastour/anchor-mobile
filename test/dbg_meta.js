const B = require('../app/js/biblio_analyses.js'); const cj = require('./ref/countries.json');
B.COUNTRIES = cj.countries.map(c => ({ name: c }));
const ds = process.argv[2]; const recs = require('./ref/' + ds + '/M.json'); const ex = require('./ref/' + ds + '/extra.json');
const M = B.fromRecords(recs.map(r => { const o = Object.assign({}, r); delete o._row; return o; }));
for (const f of ['AU_CO', 'AU1_CO', 'AU_UN', 'CR_SO']) { if (!ex[f]) continue; const c = B.meta(M, f); let bad = 0; const show = [];
  ex[f].forEach((v, i) => { const g = c[f][i]; if ((v === null ? null : v) !== (g === undefined ? null : g)) { bad++; if (show.length < 3) show.push(`#${i}: R=${JSON.stringify(v)} JS=${JSON.stringify(g)}`); } });
  console.log(f, 'mismatches', bad, '/', ex[f].length, '\n  ' + show.join('\n  ')); }
console.log('data AU_CO sample', recs.slice(0, 3).map(r => r.AU_CO));
