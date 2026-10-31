const B = require('../app/js/biblio_analyses.js'); const N = require('../app/js/network.js'); const cj = require('./ref/countries.json');
B.COUNTRIES = cj.countries.map(c => ({ name: c }));
for (const ds of ['management', 'scopus', 'wos']) {
  const recs = require('./ref/' + ds + '/M.json'); const th = require('./ref/' + ds + '/thematic.json');
  const M = B.fromRecords(recs.map(r => { const o = Object.assign({}, r); delete o._row; return o; }));
  for (const mode of ['R communities', 'JS walktrap']) {
    B._testThematic = mode === 'R communities' ? th.membership : null;
    const tm = B.thematicMap(M, 'DE'); const exp = th.clusters;
    const key = r => `${r[0]}|${r[1]}|${Number(r[2]).toFixed(6)}|${Number(r[3]).toFixed(6)}`;
    const eset = new Set(exp.map(r => key([r.name, r.freq, r.centrality, r.density]))); const got = tm.rows.map(r => key([r.label, r.freq, r.centrality, r.density]));
    const hit = got.filter(k => eset.has(k)).length;
    console.log(`${ds} [${mode}]: clusters R=${exp.length} JS=${tm.rows.length}, identical rows ${hit}`);
    if (mode === 'JS walktrap') { const sel = N.select(B.biblioNetwork(M, 'co-occurrences', 'author_keywords', { n: 250 }), { removeIsolates: true }); const wm = N.walktrap(sel);
      const rm = sel.nodes.map(nd => th.membership[nd.name]); console.log(`   modularity JS ${N.modularity(sel, wm).toFixed(4)} vs R partition ${N.modularity(sel, rm).toFixed(4)}; NMI ${nmi(wm, rm).toFixed(3)}`); }
  }
}
function nmi(a, b) { const n = a.length; const ca = new Map(), cb = new Map(), cab = new Map(); a.forEach((x, i) => { ca.set(x, (ca.get(x) || 0) + 1); cb.set(b[i], (cb.get(b[i]) || 0) + 1); const k = x + '|' + b[i]; cab.set(k, (cab.get(k) || 0) + 1); });
  let I = 0; cab.forEach((v, k) => { const [x, y] = k.split('|'); I += v / n * Math.log(v * n / (ca.get(+x) * cb.get(+y))); }); const H = m => { let h = 0; m.forEach(v => { h -= v / n * Math.log(v / n); }); return h; };
  const d = (H(ca) + H(cb)) / 2; return d ? I / d : 1; }
