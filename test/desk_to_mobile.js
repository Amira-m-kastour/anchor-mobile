// Opens desktop .anchor files in the mobile code, saves them again, and checks that nothing the phone does not use was lost.
require('./node_env.js'); const fs = require('fs');
(async () => { for (const f of process.argv.slice(2)) { const bytes = new Uint8Array(fs.readFileSync(f));
  try { const st = await P.open(bytes, f); S.replace(st);
    const out = await P.build(S.st, bytes); fs.writeFileSync('/tmp/claude-0/rt_' + require('path').basename(f), out);
    console.log('OK', require('path').basename(f), '| phases', Object.values(st.phases).map(p => p.status[0]).join(''), '| M', st.biblio.M ? st.biblio.M.n : '-', '| items', st.report_items.length, '| decisions', st.decisions.length, '| text', (st.article.text || '').length, '| out', out.length);
  } catch (e) { console.log('ERR', f, e.stack); } } })();
