const B = require('../app/js/biblio_core.js'); const I = require('../app/js/importers.js'); const fs = require('fs');
const FX = process.argv[2];
for (const [ds, file, fn] of [['wos', 'wos_sample.txt', 'wos'], ['scopus', 'scopus_sample.csv', 'scopus']]) {
  const M = I[fn](fs.readFileSync(FX + '/' + file, 'utf8')); const ref = require('./ref/' + ds + '/M.json');
  console.log(`\n${ds}: JS ${M.n} records, R ${ref.length}`);
  for (const f of ['AU', 'TI', 'SO', 'JI', 'J9', 'PY', 'TC', 'DE', 'ID', 'CR', 'C1', 'RP', 'DI', 'DT', 'LA', 'DB', 'AB', 'SR', 'AU_UN', 'VL', 'BP', 'EP']) {
    if (!(f in ref[0])) continue; let ok = 0; let ex = '';
    ref.forEach((r, i) => { const a = r[f] === undefined ? null : r[f], b = M[f] ? M[f][i] : undefined; const eq = (a === null && (b === null || b === undefined || b === '')) || String(a).toUpperCase() === String(b).toUpperCase(); if (eq) ok++; else if (!ex) ex = `#${i}: R=${JSON.stringify(a).slice(0, 90)} JS=${JSON.stringify(b).slice(0, 90)}`; });
    console.log(`  ${f.padEnd(6)} ${ok}/${ref.length} ${ex}`); } }
