// network analyses with R's own communities injected, to test node choice and centralities exactly
const B = require('../app/js/biblio_analyses.js'); const cj = require('./ref/countries.json');
B.COUNTRIES = cj.countries.map(c => ({ name: c })); B.STOPWORDS = require('./ref/stop_words_en.json');
for (const ds of (process.argv[2] || 'management,scopus,wos').split(',')) {
  const recs = require('./ref/' + ds + '/M.json'); const res = require('./ref/' + ds + '/results.json');
  const M = B.fromRecords(recs.map(r => { const o = Object.assign({}, r); delete o._row; return o; })); const R = B.analysis(M);
  for (const id of ['cooc_net', 'cocit_net', 'coupling_net', 'collab_net']) { const t = res[id].table; if (!t || !t.Node) { console.log(ds, id, 'no R table'); continue; }
    const mb = {}; t.Node.forEach((n, i) => { mb[n] = t.Cluster[i]; }); B._testMembership = mb;
    let g; try { g = B.run(id, M, R, {}); } catch (e) { console.log(ds, id, 'JS error', e.message); continue; }
    const rows = new Map(g.table.rows.map(r => [r[0], r])); let nodesOk = 0, cent = { b: 0, c: 0, p: 0 }; const bad = [];
    t.Node.forEach((n, i) => { const r = rows.get(n); if (!r) { if (bad.length < 2) bad.push('missing ' + n); return; } nodesOk++;
      if (Math.abs(r[2] - t.Betweenness[i]) < 1e-3) cent.b++; else if (bad.length < 4) bad.push(`${n} btw R=${t.Betweenness[i]} JS=${r[2]}`);
      if (t.Closeness[i] === null || Math.abs(r[3] - t.Closeness[i]) < 1e-3) cent.c++; else if (bad.length < 4) bad.push(`${n} clo R=${t.Closeness[i]} JS=${r[3]}`);
      if (Math.abs(r[4] - t.PageRank[i]) < 1e-3) cent.p++; else if (bad.length < 4) bad.push(`${n} pr R=${t.PageRank[i]} JS=${r[4]}`); });
    console.log(`${ds} ${id}: nodes ${nodesOk}/${t.Node.length} (JS ${g.table.rows.length}); betweenness ${cent.b}, closeness ${cent.c}, pagerank ${cent.p} match${bad.length ? '\n   ' + bad.join('\n   ') : ''}`); }
  B._testMembership = null;
}
