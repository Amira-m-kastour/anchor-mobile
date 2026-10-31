const B = require('../app/js/biblio_analyses.js'); const cj = require('./ref/countries.json');
B.COUNTRIES = cj.countries.map((c, i) => ({ name: c, continent: cj.continent[i], lon: cj.Longitude[i], lat: cj.Latitude[i] })); B.STOPWORDS = require('./ref/stop_words_en.json');
const recs = require('../app/data/sample_management.json'); const M = B.fromRecords(recs); const R = B.analysis(M);
for (const id of Object.keys(B.ANALYSES)) { const t0 = Date.now(); let e = ''; try { B.run(id, M, R, {}); } catch (x) { e = x.message; } console.log(id.padEnd(22), Date.now() - t0, 'ms', e.slice(0, 80)); }
