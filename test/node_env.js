// Loads the app's modules in Node for unit tests (no DOM).
global.window = globalThis; global.self = globalThis; global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { languages: ['en'] }; global.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, visibilityState: 'visible' };
const vm = require('vm'); const fs = require('fs'); const path = require('path');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../app/js', f), 'utf8'), { filename: f });
['content.js', 'lang_de.js', 'lang_ar.js', 'i18n.js', 'util.js'].forEach(load);
globalThis.module = undefined;
['rds.js', 'bxdata.js', 'biblio_core.js', 'network.js', 'biblio_analyses.js'].forEach(f => { const src = fs.readFileSync(path.join(__dirname, '../app/js', f), 'utf8'); vm.runInThisContext('(function(module){' + src + '\n})(undefined)', { filename: f }); });
['importers.js', 'store.js', 'project.js', 'online.js', 'ai.js', 'report.js'].forEach(f => { const src = fs.readFileSync(path.join(__dirname, '../app/js', f), 'utf8'); vm.runInThisContext('(function(module){' + src + '\n})(undefined)', { filename: f }); });
BX.COUNTRIES = ANCHOR_BXDATA.countries.map(c => ({ name: c[0], continent: c[1], lon: c[2], lat: c[3] })); BX.STOPWORDS = ANCHOR_BXDATA.stopwords;
