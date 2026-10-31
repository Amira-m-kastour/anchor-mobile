/* ANCHOR Mobile - the review state (same keys as the desktop app's new_state()), the decision and prompt logs,
   autosave to IndexedDB and settings kept on this device. API keys and contact emails live only in device settings;
   they are never written into the review state, project files, reports or logs. */
(function (root) {
  'use strict';
  const C = root.ANCHOR_CONTENT;
  const S = {};
  S.APP_VERSION = '1.5.1';
  S.MOBILE_VERSION = '1.0.0';
  S.APP_NAME = 'ANCHOR Studio';
  S.APP_BYLINE = 'by A. Mamdouh Kastour';
  S.APP_BRAND = S.APP_NAME + ' ' + S.APP_BYLINE;
  S.APP_TAGLINE = 'A. Mamdouh Kastour’s Scholarly Anchor';
  S.PHASE_IDS = C.phases.map(p => p.id);
  S.phase = id => C.phases.find(p => p.id === id);

  S.newPrereq = () => ({ name: '', orcid: '', orcid_name: '', role: '', programme: '', supervisor: '', skills: [], timeplan: '', country: '', country_how: '', inst_country: '',
    ror_id: '', institution: '', resolver: '', faculty: '', domains: '', access_route: '', dbs: [], db_source: '', rules: [], rule_links: '', ethics: '', output_licence: 'arr',
    code_licence: 'same', tools: [], checked_at: '' });
  S.newPhase = () => ({ status: 'locked', draft: '', answers: {}, checks: [], notes: '', ai_q: [], ai_a: [], approved_at: null, my_lessons: '', my_wiifm: '', accepted: [] });
  S.newState = () => ({
    settings: { mode: 'prompt', api_key: '', api_model: 'claude-sonnet-5-5', ollama_url: 'http://localhost:11434', ollama_model: 'llama3.1', include_text: true, online: true,
      crossref_mailto: '', openalex_key: '', fred_key: '' },
    setup: {}, setup_ok: false, article: {},
    phases: Object.fromEntries(S.PHASE_IDS.map(id => [id, S.newPhase()])),
    decisions: [], prompts: [],
    biblio: { M: null, M_all: null, R: null, log: null, dup: 0, source: '' },
    prisma: null, prisma_manual: {}, report_items: [], online: null, online_ds: null,
    analysis: { datasets: [], results: [], include_data: false },
    prereq: S.newPrereq(), focal_oa: null, finder: null
  });

  // ---------- device settings (localStorage); the API key is kept only if the researcher asks
  const SKEY = 'anchor.settings';
  S.defaults = { lang: '', draft_lang: '', mode: 'prompt', api_key: '', remember_key: false, api_model: 'claude-sonnet-5-5', include_text: true, online: true,
    crossref_mailto: '', openalex_key: '', theme: 'system', seen_intro: false };
  let device = Object.assign({}, S.defaults);
  try { Object.assign(device, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* private mode */ }
  let sessionKey = device.api_key || '';
  S.dev = () => device;
  S.setDev = function (patch) {
    Object.assign(device, patch); if ('api_key' in patch) sessionKey = patch.api_key;
    const keep = Object.assign({}, device); if (!keep.remember_key) keep.api_key = ''; else keep.api_key = sessionKey;
    try { localStorage.setItem(SKEY, JSON.stringify(keep)); } catch (e) { /* ignore */ }
    if (S.st) { S.st.settings.mode = device.mode; S.st.settings.api_model = device.api_model; S.st.settings.include_text = device.include_text; S.st.settings.online = device.online; }
    S.emit('settings');
  };
  S.apiKey = () => sessionKey;
  S.cfg = () => ({ enabled: device.online !== false, mailto: (device.crossref_mailto || '').trim(), oa_key: (device.openalex_key || '').trim() });

  // ---------- events
  const subs = {};
  S.on = (ev, f) => { (subs[ev] = subs[ev] || []).push(f); return () => { subs[ev] = subs[ev].filter(g => g !== f); }; };
  S.emit = (ev, x) => (subs[ev] || []).slice().forEach(f => { try { f(x); } catch (e) { console.error(e); } });

  // ---------- state
  S.st = S.newState();
  S.changed = function (what) { S.dirty = true; S.emit('change', what); S.scheduleSave(); };
  S.logDecision = function (phase, decision, note) { S.st.decisions.push({ time: U.now(), phase: phase, decision: decision, note: note || '' }); S.changed('decisions'); };
  S.logPrompt = function (phase, prompt, mode) { S.st.prompts.push({ time: U.now(), phase: phase, mode: mode || S.st.settings.mode, prompt: prompt }); S.changed('prompts'); };
  S.isLocked = function (id) {
    const i = S.PHASE_IDS.indexOf(id); if (!S.st.setup_ok) return true;
    return i > 0 && S.st.phases[S.PHASE_IDS[i - 1]].status !== 'approved';
  };
  S.name = () => (S.st.setup.S_name || '').trim() || (S.st.prereq.name || '').trim();

  // ---------- IndexedDB autosave (the article text stays on this device)
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => { if (!root.indexedDB) return rej(new Error('no IndexedDB'));
      const r = indexedDB.open('anchor-mobile', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbp;
  }
  S.idbGet = async function (k) { try { const d = await db(); return await new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return undefined; } };
  S.idbSet = async function (k, v) { try { const d = await db(); await new Promise((res, rej) => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); return true; } catch (e) { console.warn('autosave failed', e); return false; } };
  S.idbDel = async function (k) { try { const d = await db(); await new Promise(res => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); }); } catch (e) { /* ignore */ } };

  function snapshotForSave() { const s = Object.assign({}, S.st); s.biblio = Object.assign({}, s.biblio, { R: null }); s.settings = Object.assign({}, s.settings, { api_key: '', crossref_mailto: '', openalex_key: '', fred_key: '' }); return s; }
  S.saveNow = async function () { const ok = await S.idbSet('autosave', { state: snapshotForSave(), savedAt: U.now() }); if (ok) { S.lastSaved = U.now(); S.dirty = false; S.emit('saved'); } return ok; };
  let saveT = null;
  S.scheduleSave = function () { clearTimeout(saveT); saveT = setTimeout(S.saveNow, 1500); };
  root.addEventListener && root.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.dirty) S.saveNow(); });

  // fill in anything a saved state (older version, desktop project) lacks
  S.complete = function (s) {
    const base = S.newState(); const out = Object.assign(base, s || {});
    out.settings = Object.assign(S.newState().settings, s && s.settings || {});
    out.prereq = Object.assign(S.newPrereq(), s && s.prereq || {});
    for (const id of S.PHASE_IDS) out.phases[id] = Object.assign(S.newPhase(), (s && s.phases && s.phases[id]) || {});
    out.biblio = Object.assign(S.newState().biblio, s && s.biblio || {});
    out.analysis = Object.assign(S.newState().analysis, s && s.analysis || {});
    out.prisma_manual = out.prisma_manual || {};
    for (const k of ['decisions', 'prompts', 'report_items']) if (!Array.isArray(out[k])) out[k] = [];
    if (!out.article || typeof out.article !== 'object') out.article = {};
    if (!out.setup || typeof out.setup !== 'object') out.setup = {};
    return out;
  };
  S.load = async function () {
    const a = await S.idbGet('autosave');
    if (a && a.state) { S.st = S.complete(a.state); S.lastSaved = a.savedAt; }
    S.st.settings.mode = device.mode; S.st.settings.api_model = device.api_model; S.st.settings.include_text = device.include_text; S.st.settings.online = device.online;
    S.bibReady();
    return !!(a && a.state);
  };
  S.replace = function (state) { S.st = S.complete(state); S.st.settings.mode = device.mode; S.bibReady(); S.changed('all'); };
  S.reset = async function () { S.st = S.newState(); S.st.settings.mode = device.mode; await S.idbDel('origin'); await S.saveNow(); S.emit('change', 'all'); };

  // bibliometric summary statistics are recomputed on this device (never stored)
  S.bibReady = function () { const b = S.st.biblio; b.R = null; if (b.M && b.M.n) { try { b.R = root.BX.analysis(b.M); } catch (e) { console.warn(e); } } };
  root.S = S;
})(window);
