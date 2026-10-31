const RDS = require('../app/js/rds.js'); const fs = require('fs'); const zlib = require('zlib');
(async () => { let ok = 0, bad = 0;
  for (const f of process.argv.slice(2)) {
    const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(f)));
    const t0 = Date.now(); const p = RDS.parse(raw); const t1 = Date.now(); const out = RDS.serialize(p);
    let same = out.length === raw.length; let at = -1; if (same) for (let i = 0; i < raw.length; i++) if (raw[i] !== out[i]) { same = false; at = i; break; }
    if (!same && at < 0) { for (let i = 0; i < Math.min(raw.length, out.length); i++) if (raw[i] !== out[i]) { at = i; break; } }
    const keys = RDS.listKeys(p.value); console.log(same ? 'IDENTICAL' : 'DIFF@' + at, f.split('/').slice(-2).join('/'), raw.length, out.length, (t1 - t0) + 'ms', keys.length + ' keys');
    same ? ok++ : bad++; }
  console.log(ok, 'identical,', bad, 'different'); })();
