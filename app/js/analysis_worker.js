/* ANCHOR Mobile - runs a bibliometric analysis off the main thread, so the screen stays responsive on long ones. */
self.window = self;
importScripts('bxdata.js', 'biblio_core.js', 'network.js', 'biblio_analyses.js');
BX.COUNTRIES = ANCHOR_BXDATA.countries.map(c => ({ name: c[0], continent: c[1], lon: c[2], lat: c[3] })); BX.STOPWORDS = ANCHOR_BXDATA.stopwords;
let cacheKey = null, cacheR = null;
self.onmessage = function (e) {
  const m = e.data;
  try { if (m.key !== cacheKey || !cacheR) { cacheR = BX.analysis(m.M); cacheKey = m.key; }
    const res = BX.run(m.id, m.M, cacheR, m.opts || {}); self.postMessage({ ok: true, res: JSON.parse(JSON.stringify(res)) }); }
  catch (err) { self.postMessage({ ok: false, error: err.message }); }
};
