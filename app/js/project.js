/* ANCHOR Mobile - .anchor project files, shared with the desktop app (an R list saved with saveRDS).
   Opening: every field the phone uses is read; the file itself is kept on this device so that fields the phone does not
   use (open datasets, analysis results, OpenAlex details, desktop figures) are written back unchanged when you save.
   Saving: API keys, the contact email and licensed data are never written (the same rules as the desktop app). */
(function (root) {
  'use strict';
  const R = root.RDS; const S = root.S; const BX = root.BX;
  const P = {};
  const T = R.T;
  // ---------- typed R builders
  const chr = a => R.strs((a || []).map(x => x === null || x === undefined ? null : String(x)));
  const one = s => chr([s === null || s === undefined ? '' : s]);
  const lgl = b => ({ t: T.LGL, v: [!!b] });
  const num = x => (x === null || x === undefined || x === '' || isNaN(Number(x))) ? { t: T.REAL, v: [R.NA] } : { t: T.REAL, v: [Number(x)] };
  const int = x => ({ t: T.INT, v: [x === null || x === undefined || isNaN(Number(x)) ? null : Math.round(Number(x))] });
  const NULL = R.NIL;
  const list = (pairs) => { const keys = pairs.map(p => p[0]); return { t: T.VEC, v: pairs.map(p => p[1]), attr: R.mkAttr([['names', R.strs(keys)]]) }; };
  const ulist = arr => ({ t: T.VEC, v: arr });
  const df = (names, cols, cls) => R.fromJS({ __df: true, names: names, cols: cols, nrow: cols.length ? cols[0].v.length : 0, class: cls || ['data.frame'] });
  const strCol = v => ({ type: 'str', v: v.map(x => x === null || x === undefined ? null : String(x)) });
  const numCol = v => ({ type: 'real', v: v.map(x => x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x)) });
  const intCol = v => ({ type: 'int', v: v.map(x => x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Math.round(Number(x))) });
  const val = x => Array.isArray(x) ? (x.length ? chr(x) : chr([])) : x === null || x === undefined ? NULL : typeof x === 'boolean' ? lgl(x) : typeof x === 'number' ? num(x) : one(x);
  const named = obj => list(Object.keys(obj || {}).map(k => [k, val(obj[k])]));

  // ---------- reading helpers (toJS gives a string for length-1 vectors, arrays otherwise, objects for named vectors)
  const arr = x => x === null || x === undefined ? [] : Array.isArray(x) ? x : (typeof x === 'object' && x.__vec) ? Object.keys(x).map(k => x[k]) : [x];
  const str = x => x === null || x === undefined ? '' : Array.isArray(x) ? (x.length ? String(x[0] === null ? '' : x[0]) : '') : String(x);
  const plain = x => { if (x === null || x === undefined) return x; if (Array.isArray(x)) return x.map(plain); if (typeof x === 'object' && !x.__df && !x.__r) { const o = {}; for (const k of Object.keys(x)) o[k] = plain(x[k]); return o; } return x; };
  const dfRows = d => { if (!d || !d.__df) return []; const out = []; for (let i = 0; i < d.nrow; i++) { const r = {}; d.names.forEach((n, j) => { r[n] = d.cols[j].v[i]; }); out.push(r); } return out; };

  // bibliometrix data frame <-> the engine's column store
  P.MfromDF = function (d) {
    if (!d || !d.__df) return null; const cols = {}; d.names.forEach((n, j) => { const c = d.cols[j]; if (c.type !== 'r') cols[n] = c.v.map(x => x === undefined ? null : x); });
    return BX.fromColumns(cols, d.nrow);
  };
  const NUMERIC_FIELDS = new Set(['PY', 'TC', 'TCperYear', 'NTC']);
  P.MtoDF = function (M) {
    if (!M) return NULL; const CORE = ['AU', 'TI', 'SO', 'PY', 'TC', 'DT', 'DB', 'SR', 'CR', 'DE', 'ID', 'C1', 'DI'];
    // columns the engine adds empty (AU_CO, AU_UN, ...) are left out: bibliometrix treats a present but empty AU_CO as data
    const names = Object.keys(M).filter(k => k !== 'n' && !k.startsWith('_') && Array.isArray(M[k]) && M[k].length === M.n && (CORE.includes(k) || M[k].some(v => v !== null && v !== undefined && v !== '')));
    return df(names, names.map(k => NUMERIC_FIELDS.has(k) ? numCol(M[k]) : strCol(M[k])), ['bibliometrixDB', 'data.frame']);
  };

  // ---------- open
  P.open = async function (bytes, name) {
    let tree; try { tree = (await R.readRDS(bytes)).value; } catch (e) { throw new Error(t('{name} could not be read ({msg}). Is it an ANCHOR Studio project file (.anchor)? A PDF or Word file is uploaded on the Start page instead.', { name: name, msg: e.message })); }
    if (!tree || tree.t !== T.VEC || R.listKeys(tree).indexOf('phases') < 0) throw new Error(t('{name} is not an ANCHOR Studio project.', { name: name }));
    const g = k => { const n = R.listGet(tree, k); return n === undefined ? undefined : R.toJS(n); };
    const st = S.newState();
    const set = plain(g('settings')) || {}; Object.assign(st.settings, set, { api_key: '', crossref_mailto: '', openalex_key: '', fred_key: '' });
    st.settings.include_text = set.include_text !== false; st.settings.online = set.online !== false;
    const setup = plain(g('setup')) || {}; for (const k of Object.keys(setup)) st.setup[k] = Array.isArray(setup[k]) ? setup[k] : str(setup[k]);
    st.setup_ok = g('setup_ok') === true;
    const a = plain(g('article')) || {};
    st.article = {}; for (const k of Object.keys(a)) st.article[k] = a[k];
    st.article.references = arr(a.references).filter(x => x !== null); st.article.cite_autos = arr(a.cite_autos).filter(x => x !== null);
    for (const k of ['file', 'text', 'doi', 'title', 'citation', 'version', 'abstract', 'title_guess', 'meta_title', 'cite_style', 'cite_auto', 'cite_pending']) if (a[k] !== undefined && a[k] !== null) st.article[k] = str(a[k]);
    if (a.text === undefined || a.text === null) delete st.article.text;
    const ph = g('phases') || {};
    for (const id of S.PHASE_IDS) { const p = plain(ph[id]) || {}; const q = st.phases[id];
      q.status = str(p.status) || 'locked'; q.draft = str(p.draft); q.notes = str(p.notes); q.my_lessons = str(p.my_lessons); q.my_wiifm = str(p.my_wiifm);
      q.approved_at = p.approved_at === null || p.approved_at === undefined ? null : str(p.approved_at);
      q.checks = arr(p.checks).filter(x => x !== null); q.ai_q = arr(p.ai_q).filter(x => x !== null); q.ai_a = arr(p.ai_a).map(x => str(x));
      q.answers = {}; if (p.answers && typeof p.answers === 'object' && !Array.isArray(p.answers)) for (const k of Object.keys(p.answers)) q.answers[k] = Array.isArray(p.answers[k]) ? p.answers[k] : str(p.answers[k]);
      q.accepted = arr(p.accepted).map(r => { const o = {}; for (const k of Object.keys(r || {})) o[k] = k === 'year' ? (Array.isArray(r[k]) ? r[k][0] : r[k]) : str(r[k]); return o; }); }
    st.decisions = dfRows(g('decisions')).map(r => ({ time: str(r.time), phase: str(r.phase), decision: str(r.decision), note: str(r.note) }));
    st.prompts = dfRows(g('prompts')).map(r => ({ time: str(r.time), phase: str(r.phase), mode: str(r.mode), prompt: str(r.prompt) }));
    st.draft_versions = dfRows(g('draft_versions')).map(r => ({ phase: str(r.phase), time: str(r.time), source: str(r.source), text: str(r.text) }));
    const b = g('biblio') || {};
    st.biblio.M_all = P.MfromDF(b.M_all) || P.MfromDF(b.M); st.biblio.M = P.MfromDF(b.M) || st.biblio.M_all;
    st.biblio.dup = Number(b.dup) || 0; st.biblio.source = str(b.source); st.biblio.stamp = b.stamp ? str(b.stamp) : null; st.biblio.desc = b.desc ? str(b.desc) : null;
    st.biblio.retracted_removed = b.retracted_removed && b.retracted_removed.__df ? dfRows(b.retracted_removed).map(r => ({ record: str(r.record), doi: str(r.doi), notice: str(r.notice), removed_at: str(r.removed_at) })) : [];
    st.biblio.log = b.log && b.log.__df ? dfRows(b.log).map(r => ({ file: str(r.file), database: str(r.database), records: Number(r.records) || 0 })) : null;
    const pr = plain(g('prisma')); if (pr) for (const k of ['excluded_screen', 'assessed', 'excluded_full', 'included']) if (pr[k] !== null && pr[k] !== undefined) st.prisma_manual[k] = Number(arr(pr[k])[0]);
    st.prereq = Object.assign(S.newPrereq(), plain(g('prereq')) || {});
    for (const k of ['skills', 'dbs', 'rules', 'tools']) st.prereq[k] = arr(st.prereq[k]).filter(x => x !== null);
    for (const k of Object.keys(st.prereq)) if (!Array.isArray(st.prereq[k])) st.prereq[k] = str(st.prereq[k]);
    // finder: shortlist rows and the researcher's ticks and notes
    const f = g('finder'); if (f) { const ff = { query: str(f.query), filters: str(f.filters), sort: str(f.sort) || 'relevance', found: Number(f.found) || 0, searched_at: str(f.searched_at),
        summary: str(f.summary), chosen: f.chosen ? str(f.chosen) : null, chosen_at: f.chosen_at ? str(f.chosen_at) : null, reason: str(f.reason), ticks: {}, notes: {}, shortlist: dfRows(f.shortlist) };
      if (f.ticks && typeof f.ticks === 'object') for (const k of Object.keys(f.ticks)) ff.ticks[k] = arr(f.ticks[k]).filter(x => x !== null);
      if (f.notes && typeof f.notes === 'object') for (const k of Object.keys(f.notes)) ff.notes[k] = str(f.notes[k]);
      st.finder = ff; }
    const on = g('online'); if (on && typeof on === 'object') { const fo = on.focal; st.online = { checked_at: str(on.checked_at), online: on.online === true, focal: fo ? focalFromR(fo) : null }; }
    // figures and tables the desktop app put in the report (kept exactly as they are)
    const itemsNode = R.listGet(tree, 'report_items');
    if (itemsNode && itemsNode.t === T.VEC) st.report_items = itemsNode.v.map((node, k) => { const it = R.toJS(node) || {};
      const pngNode = R.listGet(node, 'png_raw'); return { id: 'd' + k, label: str(it.label), note: str(it.note), phase: str(it.phase) || 'C', table: it.table && it.table.__df ? { cols: it.table.names, rows: dfRows(it.table).map(r => it.table.names.map(n => r[n])) } : null,
        png: pngNode && pngNode.t === T.RAW ? pngNode.v : null, data_stamp: it.data_stamp ? str(it.data_stamp) : null, from_desktop: true, node: k }; });
    st.app_version_saved = str(g('app_version'));
    return st;
  };
  function focalFromR(fo) { const o = { doi: str(fo.doi), found: fo.found === true, status: str(fo.status), checked_at: str(fo.checked_at) };
    if (fo.meta) { o.meta = {}; for (const k of Object.keys(fo.meta)) o.meta[k] = k === 'year' ? fo.meta[k] : str(fo.meta[k]); }
    o.notices = dfRows(fo.notices).map(r => ({ type: str(r.type), label: str(r.label), doi: str(r.doi), source: str(r.source), date: str(r.date) })); return o; }

  // ---------- save
  P.prisma = function (st) {
    const b = st.biblio; if (!b.log || !b.M_all) return null; const m = st.prisma_manual || {};
    return { identified: b.log.reduce((s, r) => s + (Number(r.records) || 0), 0), duplicates: b.dup || 0, retracted: (b.retracted_removed || []).length, filtered: b.M_all.n - (b.M ? b.M.n : 0), screened: b.M ? b.M.n : 0,
      excluded_screen: m.excluded_screen, assessed: m.assessed, excluded_full: m.excluded_full, included: m.included };
  };
  function phaseR(p) {
    return list([['status', one(p.status)], ['draft', one(p.draft)], ['answers', named(p.answers)], ['checks', chr(p.checks)], ['notes', one(p.notes)],
      ['ai_q', chr(p.ai_q)], ['ai_a', ulist((p.ai_a || []).map(one))], ['approved_at', p.approved_at ? one(p.approved_at) : NULL], ['my_lessons', one(p.my_lessons)], ['my_wiifm', one(p.my_wiifm)],
      ['accepted', ulist((p.accepted || []).map(r => list(['au', 'year', 'title', 'journal', 'vol', 'iss', 'pages', 'doi'].map(k => [k, k === 'year' ? num(r.year) : one(r[k])]))))]]);
  }
  function articleR(a) {
    const pairs = []; const skip = new Set(['cite_pending']);
    for (const k of Object.keys(a)) { if (skip.has(k)) continue; const v = a[k];
      if (k === 'references' || k === 'cite_autos') pairs.push([k, chr(v || [])]);
      else if (k === 'pages' || k === 'words') pairs.push([k, int(v)]);
      else if (k === 'scanned') pairs.push([k, lgl(v)]);
      else pairs.push([k, val(v)]); }
    if (a.cite_pending) pairs.push(['cite_pending', one(a.cite_pending)]);
    return list(pairs);
  }
  function finderR(f) {
    if (!f) return NULL; const sh = f.shortlist || [];
    const cols = ['id', 'doi', 'title', 'authors', 'year', 'journal', 'source_id', 'type', 'language', 'cites', 'per_year', 'fwci', 'oa_status', 'pdf_url', 'oa_url', 'version', 'licence', 'host', 'retracted', 'n_refs', 'abstract', 'fit'];
    const NUM = new Set(['per_year', 'fwci']), INT = new Set(['year', 'cites', 'n_refs', 'fit']);
    const short = sh.length ? df(cols, cols.map(c => c === 'retracted' ? { type: 'lgl', v: sh.map(r => !!r.retracted) } : NUM.has(c) ? numCol(sh.map(r => r[c])) : INT.has(c) ? intCol(sh.map(r => r[c])) : strCol(sh.map(r => r[c] === undefined ? '' : r[c])))) : NULL;
    return list([['shortlist', short], ['ticks', list(Object.keys(f.ticks || {}).map(k => [k, chr(f.ticks[k])]))], ['notes', list(Object.keys(f.notes || {}).map(k => [k, one(f.notes[k])]))],
      ['summary', one(f.summary)], ['query', one(f.query)], ['filters', one(f.filters)], ['sort', one(f.sort || 'relevance')], ['found', int(f.found)], ['searched_at', one(f.searched_at)],
      ['chosen', f.chosen ? one(f.chosen) : NULL], ['chosen_at', f.chosen_at ? one(f.chosen_at) : NULL], ['reason', one(f.reason)]]);
  }
  function lookupR(f) {
    return list([['doi', one(f.doi)], ['found', lgl(f.found)], ['checked_at', one(f.checked_at)], ['status', one(f.status || (f.found ? 'ok' : 'not found'))],
      ['meta', f.meta ? list(['au', 'year', 'title', 'journal', 'vol', 'iss', 'pages', 'doi'].map(k => [k, k === 'year' ? num(f.meta.year) : one(f.meta[k])])) : NULL],
      ['notices', df(['type', 'label', 'doi', 'source', 'date'], ['type', 'label', 'doi', 'source', 'date'].map(k => strCol((f.notices || []).map(n => n[k]))))]]);
  }
  function onlineR(o) {
    if (!o) return NULL; const refs = o.refs || {}; const sg = o.suggestions || {};
    const SG = ['title', 'year', 'cited_by', 'doi', 'journal', 'au', 'vol', 'iss', 'pages'];
    return list([['checked_at', one(o.checked_at)], ['online', lgl(o.online)], ['refs', list(Object.keys(refs).filter(k => refs[k]).map(k => [k, lookupR(refs[k])]))],
      ['suggestions', list(Object.keys(sg).filter(k => sg[k] && sg[k].length).map(k => [k, df(SG, SG.map(c => ['year', 'cited_by'].includes(c) ? numCol(sg[k].map(x => x[c])) : strCol(sg[k].map(x => x[c]))))]))],
      ['focal', o.focal ? lookupR(o.focal) : NULL], ['errors', chr(o.errors || [])]]);
  }
  P.itemR = async function (it) {
    const tb = it.table ? df(it.table.cols.map(String), it.table.cols.map((c, j) => { const v = it.table.rows.slice(0, 30).map(r => r[j]); return v.every(x => x === null || typeof x === 'number') ? numCol(v) : strCol(v.map(x => x === null ? null : String(x))); })) : NULL;
    const png = it.png ? { t: T.RAW, v: it.png } : NULL;
    return list([['label', one(it.label)], ['note', one(it.note)], ['table', tb], ['png_raw', png], ['pdf_raw', NULL], ['phase', one(it.phase || 'C')], ['code', NULL], ['data_stamp', it.data_stamp ? one(it.data_stamp) : NULL]]);
  };

  // the whole project; origin = the bytes of the .anchor file this review was opened from (kept on the device), if any
  P.build = async function (st, origin) {
    let parsed = null;
    if (origin) { try { parsed = await R.readRDS(origin); } catch (e) { parsed = null; } }
    let tree = parsed && parsed.value && parsed.value.t === T.VEC ? parsed.value : null;
    const originItems = tree ? R.listGet(tree, 'report_items') : null;
    if (!tree) tree = list([]);
    // a value the phone did not change keeps the node it was read from (names, attributes and key order as R wrote them)
    const sig = n => { try { return JSON.stringify(R.toJS(n), (k, v) => (v && v.__r ? '~' : v)); } catch (e) { return Math.random(); } };
    const merge = (orig, neu, depth) => {
      if (!orig || orig.t !== T.VEC || neu.t !== T.VEC || !R.attrGet(orig, 'names') || !R.attrGet(neu, 'names') || R.attrGet(orig, 'class') || R.attrGet(neu, 'class')) return sig(orig) === sig(neu) ? orig : neu;
      const keys = R.listKeys(neu); const out = { t: T.VEC, v: orig.v.slice(), attr: R.mkAttr([['names', R.strs(R.listKeys(orig))]].concat(R.attrsOf(orig).filter(a => a[0] !== 'names'))) };
      keys.forEach((k, i) => { const o = R.listGet(orig, k); const nv = neu.v[i]; R.listSet(out, k, o === undefined ? nv : depth > 0 ? merge(o, nv, depth - 1) : (sig(o) === sig(nv) ? o : nv)); });
      return out; };
    const put = (k, v, depth) => { const o = R.listGet(tree, k); R.listSet(tree, k, o !== undefined && depth !== undefined ? merge(o, v, depth) : v); };
    put('settings', list([['mode', one(st.settings.mode)], ['api_key', one('')], ['api_model', one(st.settings.api_model)], ['ollama_url', one(st.settings.ollama_url || 'http://localhost:11434')],
      ['ollama_model', one(st.settings.ollama_model || 'llama3.1')], ['include_text', lgl(st.settings.include_text)], ['online', lgl(st.settings.online)],
      ['crossref_mailto', one('')], ['openalex_key', one('')], ['fred_key', one('')]]));
    put('setup', named(st.setup), 1); put('setup_ok', lgl(st.setup_ok), 0);
    put('article', articleR(st.article), 1);
    put('phases', list(S.PHASE_IDS.map(id => [id, phaseR(st.phases[id])])), 3);
    put('decisions', df(['time', 'phase', 'decision', 'note'], ['time', 'phase', 'decision', 'note'].map(k => strCol(st.decisions.map(r => r[k])))));
    put('prompts', df(['time', 'phase', 'mode', 'prompt'], ['time', 'phase', 'mode', 'prompt'].map(k => strCol(st.prompts.map(r => r[k])))));
    put('draft_versions', df(['phase', 'time', 'source', 'text'], ['phase', 'time', 'source', 'text'].map(k => strCol((st.draft_versions || []).map(r => r[k])))));
    const b = st.biblio;
    if (st.biblio.changed || !R.listGet(tree, 'biblio')) put('biblio', list([['M', b.M ? P.MtoDF(b.M) : NULL], ['M_all', b.M_all ? P.MtoDF(b.M_all) : NULL], ['R', NULL],
      ['log', b.log ? df(['file', 'database', 'records'], [strCol(b.log.map(r => r.file)), strCol(b.log.map(r => r.database)), intCol(b.log.map(r => r.records))]) : NULL],
      ['dup', num(b.dup || 0)], ['source', one(b.source || '')], ['stamp', b.stamp ? one(b.stamp) : NULL], ['desc', b.desc ? one(b.desc) : NULL],
      ['retracted_removed', (b.retracted_removed || []).length ? df(['record', 'doi', 'notice', 'removed_at'], ['record', 'doi', 'notice', 'removed_at'].map(k => strCol(b.retracted_removed.map(r => r[k])))) : NULL]]));
    const pr = P.prisma(st);
    if (st.biblio.changed || !R.listGet(tree, 'prisma') || st.prisma_changed) put('prisma', pr ? list(Object.keys(pr).filter(k => pr[k] !== undefined && pr[k] !== null && !(typeof pr[k] === 'number' && isNaN(pr[k]))).map(k => [k, ['identified', 'filtered', 'screened', 'retracted'].includes(k) ? int(pr[k]) : num(pr[k])])) : NULL);
    const items = [];
    for (const it of st.report_items) { if (it.from_desktop && originItems && originItems.v[it.node]) items.push(originItems.v[it.node]); else items.push(await P.itemR(it)); }
    put('report_items', ulist(items));
    if ((st.online && st.online.mobile) || !R.listGet(tree, 'online')) put('online', onlineR(st.online));
    else if (st.online && st.online.focal_mobile) { const on = R.listGet(tree, 'online'); if (on && on.t === T.VEC) R.listSet(on, 'focal', lookupR(st.online.focal)); }
    const prq = st.prereq; put('prereq', list(Object.keys(S.newPrereq()).map(k => [k, Array.isArray(prq[k]) ? chr(prq[k]) : one(prq[k])])), 1);
    put('finder', finderR(st.finder), 2);
    // fields only the desktop app fills keep their saved values; a new project gets the desktop defaults
    if (R.listGet(tree, 'online_ds') === undefined) put('online_ds', NULL);
    if (R.listGet(tree, 'analysis') === undefined) put('analysis', list([['datasets', ulist([])], ['results', ulist([])], ['include_data', lgl(false)]]));
    if (R.listGet(tree, 'focal_oa') === undefined) put('focal_oa', NULL);
    // licensed datasets never leave in a project file
    const an = R.listGet(tree, 'analysis'); if (an && an.t === T.VEC) { const ds = R.listGet(an, 'datasets'); const inc = R.toJS(R.listGet(an, 'include_data') || NULL) === true;
      if (ds && ds.t === T.VEC) ds.v.forEach(d => { if (d.t !== T.VEC) return; const lic = R.toJS(R.listGet(d, 'licensed') || NULL) === true; if ((lic || !inc) && R.listGet(d, 'data') !== undefined) R.listSet(d, 'data', NULL); }); }
    put('app_version', one(S.APP_VERSION));
    put('saved_with', one('ANCHOR Mobile ' + S.MOBILE_VERSION));
    return R.writeRDS({ version: parsed ? parsed.version : 3, rver: parsed ? parsed.rver : 263171, minver: parsed ? parsed.minver : 197888, encoding: parsed ? parsed.encoding : 'UTF-8', value: tree });
  };
  root.P = P;
})(window);
