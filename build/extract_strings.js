// Lists every English text the app shows through t(): interface strings in the JS files and the framework content.
const fs = require('fs'); const path = require('path'); global.window = {}; require('../app/js/content.js'); const C = window.ANCHOR_CONTENT;
const set = new Set(); const dir = path.join(__dirname, '../app/js');
for (const f of fs.readdirSync(dir)) { if (/^(lang_|content|bxdata|worldmap|rds)/.test(f)) continue; const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /\b(?:t|r)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g; let m; while ((m = re.exec(src))) { if (m[1] === '`' && m[2].includes('${')) continue; set.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n')); } }
const add = x => { if (x && typeof x === 'string') set.add(x); };
C.phases.forEach(p => { ['name', 'question', 'input', 'actions', 'output'].forEach(k => add(p[k])); p.checks.forEach(add); p.questions.forEach(q => { add(q.label); (q.choices || []).forEach(add); }); });
Object.values(C.controls).forEach(add); C.setup.forEach(q => { add(q.label); (q.choices || []).forEach(add); });
Object.values(C.lessons).forEach(l => { l.lessons.forEach(add); add(l.wiifm); });
['skills', 'rules', 'ethics', 'output_licences', 'code_licences', 'cite_styles', 'find_sorts', 'find_types'].forEach(k => C[k].forEach(x => add(x.label)));
C.find_criteria.forEach(x => add(x.value)); Object.values(C.version_label).forEach(add); C.db_catalog.forEach(d => { add(d.name); add(d.licence); });
global.self = undefined; const B = require('../app/js/biblio_analyses.js'); Object.values(B.ANALYSES).forEach(a => { add(a.label); add(a.group); });
// notes returned by analyses (literal strings)
const an = fs.readFileSync(path.join(dir, 'biblio_analyses.js'), 'utf8'); let m; const re2 = /note: '([^']+)'/g; while ((m = re2.exec(an))) add(m[1]);
['approved', 'open', 'locked', 'needs review', 'ok', 'offline', 'off', 'not checked', 'desktop', 'open copy', 'uploaded by you', 'article', 'review', 'book-chapter', 'preprint'].forEach(add);
const keys = Array.from(set).filter(s => s.trim() && /[A-Za-z]/.test(s)).sort();
fs.writeFileSync(path.join(__dirname, 'strings_en.json'), JSON.stringify(keys, null, 0).replace(/","/g, '",\n"'));
console.log(keys.length, 'strings', keys.join('').length, 'chars');
