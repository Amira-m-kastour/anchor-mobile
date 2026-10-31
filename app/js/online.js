/* ANCHOR Mobile - live services: Crossref (reference checks, retraction notices, focal look-up), doi.org (citation styles),
   OpenAlex (finding a focal article, new reading, bibliometric corpus, retraction check), ROR and ORCID (Before you start).
   Only DOIs and short search terms are sent; never the article text, drafts, notes or keys.
   Tests set window.ANCHOR_MOCK = function (url, query) { return parsed JSON | text | {__404: true} }. */
(function (root) {
  'use strict';
  const O = {};
  const C = root.ANCHOR_CONTENT;
  const GAP = { 'api.crossref.org': 1050, 'api.openalex.org': 120, 'api.ror.org': 200, 'pub.orcid.org': 100, 'doi.org': 300 };
  const last = {};
  async function pace(url) { const h = new URL(url).hostname; const g = GAP[h]; if (!g) return; const w = (last[h] || 0) + g - Date.now(); last[h] = Date.now() + Math.max(0, w); if (w > 0) await U.sleep(w); }
  O.norm = x => String(x || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
  O.isDoi = d => /^10\.\d{4,9}\/\S+$/.test(d);
  O.http = async function (url, query, opts) {
    opts = opts || {}; query = query || {};
    if (typeof root.ANCHOR_MOCK === 'function') { const q = Object.assign({}, query); if (opts.headers) q['.headers'] = opts.headers;
      const x = await root.ANCHOR_MOCK(url, q); if (x && x.__404) return null; if (x && x.__error) throw new Error(x.__error); return x; }
    const cfg = S.cfg(); if (!cfg.enabled && !opts.force) throw new Error(t('Internet features are switched off in Settings.'));
    const u = new URL(url); for (const k of Object.keys(query)) if (query[k] !== undefined && query[k] !== null && query[k] !== '') u.searchParams.set(k, query[k]);
    for (let attempt = 0; attempt < (opts.tries || 3); attempt++) {
      await pace(url);
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), opts.timeout || 15000);
      let r; try { r = await fetch(u.toString(), { headers: opts.headers || {}, signal: ctl.signal, mode: 'cors', credentials: 'omit' }); }
      catch (e) { clearTimeout(tm); if (attempt === (opts.tries || 3) - 1) throw new Error(t('No connection to {host} (offline, blocked, or the service is down).', { host: u.hostname })); continue; }
      clearTimeout(tm);
      if ([429, 502, 503, 504].includes(r.status) && attempt < (opts.tries || 3) - 1) { await U.sleep(1500 * (attempt + 1)); continue; }
      if (r.status === 404) return null;
      if (r.status >= 400) throw new Error(t('{host} answered HTTP {code}', { host: u.hostname, code: r.status }));
      return opts.as === 'text' ? r.text() : opts.as === 'bytes' ? new Uint8Array(await r.arrayBuffer()) : r.json();
    }
  };
  const mail = () => { const m = S.cfg().mailto; return m ? { mailto: m } : {}; };
  const oaq = q => { const c = S.cfg(); if (c.oa_key) q.api_key = c.oa_key; if (c.mailto) q.mailto = c.mailto; return q; };
  O.ping = async function () { try { const x = await O.http('https://api.crossref.org/works', Object.assign({ rows: 0 }, mail()), { tries: 1, timeout: 8000 }); return !!x; } catch (e) { return false; } };

  // ---------- Crossref
  O.apaAuthors = function (auth) {
    if (!auth || !auth.length) return '';
    let nm = auth.map(a => { if (a.family) { const ini = a.given ? a.given.split(/[ -]+/).filter(Boolean).map(p => p[0] + '.').join(' ') : ''; return (a.family + (ini ? ', ' + ini : '')).trim(); } return a.name || ''; }).filter(Boolean);
    if (nm.length > 20) nm = nm.slice(0, 19).concat(['...', nm[nm.length - 1]]);
    return nm.length === 1 ? nm[0] : nm.slice(0, -1).join(', ') + ', & ' + nm[nm.length - 1];
  };
  O.refApa = r => { const vi = (U.nz(r.vol) ? ', ' + r.vol : '') + (U.nz(r.iss) ? '(' + r.iss + ')' : '');
    return `${r.au} (${r.year}). ${String(r.title || '').replace(/\.$/, '')}. ${r.journal}${vi}${U.nz(r.pages) ? ', ' + String(r.pages).replace(/-/g, '–') : ''}. https://doi.org/${r.doi}`; };
  const NOTICE_CLASS = { retraction: 'retracted', withdrawal: 'retracted', removal: 'retracted', expression_of_concern: 'concern', 'expression-of-concern': 'concern', concern: 'concern',
    correction: 'corrected', erratum: 'corrected', corrigendum: 'corrected', addendum: 'corrected' };
  const notices = lst => { const seen = new Set(); return (lst || []).map(u => ({ type: String(u.type || '').toLowerCase(), label: u.label || u.type || '', doi: u.DOI || '', source: u.source || '',
    date: u.updated && u.updated['date-parts'] ? u.updated['date-parts'][0].join('-') : '' })).filter(n => { const k = n.type + '|' + n.doi; if (seen.has(k)) return false; seen.add(k); return true; }); };
  O.noticeStatus = nd => { const c = nd.map(n => NOTICE_CLASS[n.type]).filter(Boolean); return c.includes('retracted') ? 'retracted' : c.includes('concern') ? 'concern' : c.includes('corrected') ? 'corrected' : 'ok'; };
  O.crossref = async function (doi) {
    doi = O.norm(doi); if (!doi) return null;
    const x = await O.http('https://api.crossref.org/works/' + encodeURIComponent(doi), mail());
    if (!x) return { doi: doi, found: false, status: 'not found', checked_at: U.now() };
    const m = x.message || {}; const dp = (m.issued && m.issued['date-parts'] && m.issued['date-parts'][0]) || (m.published && m.published['date-parts'] && m.published['date-parts'][0]) || [];
    let nd = notices(m['updated-by']);
    try { const u = await O.http('https://api.crossref.org/works', Object.assign({ filter: 'updates:' + doi, rows: 20 }, mail()));
      const extra = []; ((u && u.message && u.message.items) || []).forEach(it => (it['update-to'] || []).forEach(tt => { if (O.norm(tt.DOI) === doi) extra.push(tt); }));
      if (extra.length) nd = notices(nd.map(n => ({ type: n.type, label: n.label, DOI: n.doi, source: n.source })).concat(extra)); } catch (e) { /* notices from the record itself still count */ }
    return { doi: doi, found: true, checked_at: U.now(), status: O.noticeStatus(nd), notices: nd,
      meta: { au: O.apaAuthors(m.author), year: dp[0] === undefined ? null : dp[0], title: (m.title || [''])[0] || '', journal: (m['container-title'] || [''])[0] || '',
        vol: m.volume || '', iss: m.issue || '', pages: m.page || m['article-number'] || '', doi: doi } };
  };
  O.cleanCitation = x => String(x).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().replace(/^\[1\]\s*/, '').replace(/^1\.\s*/, '');
  O.citeDoi = async function (doi, style, meta) {
    doi = O.norm(doi); if (!doi) throw new Error('No DOI.');
    if (style === 'apa' && meta) return O.refApa(meta);
    const x = await O.http('https://doi.org/' + encodeURI(doi), {}, { as: 'text', headers: { Accept: 'text/x-bibliography; style=' + style + '; locale=en-GB' } });
    if (!x || !String(x).trim()) throw new Error(t('doi.org returned no citation for this DOI in that style.'));
    return O.cleanCitation(x);
  };
  O.NOTICE_NAME = { retracted: 'retraction notice', concern: 'expression of concern', corrected: 'correction notice' };

  // built-in key references and live suggestions for the stage cards
  O.refLive = function (key, st) {
    const r = Object.assign({}, C.refs[key]); const live = st.online && st.online.refs && st.online.refs[r.doi];
    if (live && live.found) for (const f of ['vol', 'iss', 'pages']) if (!U.nz(r[f]) && live.meta && U.nz(live.meta[f])) r[f] = live.meta[f];
    r.status = live && live.found ? live.status : live ? 'not found' : 'unchecked'; r.checked_at = (live && live.checked_at) || ''; return r;
  };
  O.statusLabel = r => ({ ok: t('verified online {d}', { d: (r.checked_at || '').slice(0, 10) }), retracted: t('RETRACTED - do not cite without explanation'), concern: t('expression of concern published'),
    corrected: t('correction published - check the corrected version'), 'not found': t('DOI not found online') }[r.status] || t('not checked online; as of {d}', { d: C.lessons_asof }));
  O.suggest = async function (query, n, years) {
    const y = new Date().getFullYear(); years = years || 3;
    const x = await O.http('https://api.openalex.org/works', oaq({ search: query, filter: `publication_year:${y - years + 1}-${y},type:article,is_retracted:false`, sort: 'cited_by_count:desc', per_page: n || 5,
      select: 'id,doi,title,publication_year,cited_by_count,authorships,primary_location,biblio' }));
    return ((x && x.results) || []).map(w => { const au = (w.authorships || []).map(a => (a.author && a.author.display_name) || '').map(s => { const p = s.trim().split(/ +/); return p.length < 2 ? s : p[p.length - 1] + ', ' + p.slice(0, -1).map(q => q[0] + '.').join(' '); });
      const b = w.biblio || {}; return { title: w.title || '', year: w.publication_year, cited_by: w.cited_by_count || 0, doi: O.norm(w.doi || ''), journal: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '',
        au: !au.length ? '' : au.length === 1 ? au[0] : au.length <= 20 ? au.slice(0, -1).join(', ') + ', & ' + au[au.length - 1] : au.slice(0, 19).join(', ') + ', ... ' + au[au.length - 1],
        vol: b.volume || '', iss: b.issue || '', pages: [b.first_page, b.last_page].filter(Boolean).join('-') }; });
  };
  O.refreshing = false;
  O.refresh = async function (onstep) {
    const st = S.st; const res = { checked_at: U.now(), online: false, refs: {}, suggestions: {}, focal: st.online && st.online.focal || null, errors: [], mobile: true };
    if (!S.cfg().enabled) { res.errors.push(t('Internet features are switched off in Settings.')); return res; }
    O.refreshing = true; S.emit('online');
    try {
      if (!(await O.ping())) { res.errors.push(t('No connection to Crossref (offline, blocked by a firewall, or the service is down).')); return res; }
      res.online = true;
      const keys = Object.keys(C.refs); let k = 0;
      for (const key of keys) { const d = C.refs[key].doi; try { res.refs[d] = await O.crossref(d); } catch (e) { res.errors.push(e.message); } if (onstep) onstep(++k, keys.length); }
      if (O.isDoi(O.norm(st.article.doi))) try { res.focal = await O.crossref(st.article.doi); } catch (e) { /* keep the last result */ }
      for (const id of Object.keys(C.lessons)) try { res.suggestions[id] = await O.suggest(C.lessons[id].query); } catch (e) { res.errors.push(e.message); }
      return res;
    } finally { O.refreshing = false; if (res.online || !st.online || !st.online.online) { st.online = res; S.changed('online'); } S.emit('online'); }
  };

  // ---------- OpenAlex: find a focal article
  O.oaShort = x => String(x || '').replace(/^https?:\/\/openalex\.org\//, '');
  O.oaAbstract = inv => { if (!inv) return ''; const w = []; for (const k of Object.keys(inv)) for (const p of inv[k]) w[p] = k; return w.filter(x => x !== undefined).join(' '); };
  O.oaFilter = function (base, from, to, types, lang) {
    const f = (base || []).slice(); if (from && to) f.push(`publication_year:${parseInt(from, 10)}-${parseInt(to, 10)}`);
    if (types && types.length) f.push('type:' + types.join('|')); if (lang) f.push('language:' + lang); f.push('is_paratext:false'); return f.join(',');
  };
  const FIND_SELECT = 'id,doi,display_name,publication_year,authorships,primary_location,cited_by_count,fwci,open_access,best_oa_location,is_retracted,language,type,referenced_works_count,abstract_inverted_index';
  O.findRows = function (ws) {
    const y = new Date().getFullYear();
    return (ws || []).map(w => { const au = (w.authorships || []).map(a => (a.author && a.author.display_name) || ''); const yr = w.publication_year === undefined || w.publication_year === null ? null : Number(w.publication_year);
      const cites = Number(w.cited_by_count || 0); const oa = w.best_oa_location || {}; const src = (w.primary_location && w.primary_location.source) || {};
      return { id: O.oaShort(w.id), doi: O.norm(w.doi || ''), title: w.display_name || w.title || '', authors: au.length > 3 ? au.slice(0, 3).join(', ') + ' et al.' : au.join(', '),
        year: yr, journal: src.display_name || '', source_id: O.oaShort(src.id || ''), type: w.type || '', language: w.language || '', cites: cites,
        per_year: yr === null ? null : Math.round(cites / Math.max(1, y - yr + 1) * 10) / 10, fwci: w.fwci === undefined || w.fwci === null ? null : Number(w.fwci),
        oa_status: (w.open_access && w.open_access.oa_status) || 'closed', pdf_url: oa.pdf_url || '', oa_url: oa.landing_page_url || (w.open_access && w.open_access.oa_url) || '',
        version: oa.version || '', licence: oa.license || '', host: (oa.source && oa.source.display_name) || '', retracted: !!w.is_retracted,
        n_refs: w.referenced_works_count === undefined ? null : w.referenced_works_count, abstract: O.oaAbstract(w.abstract_inverted_index) }; });
  };
  O.findSearch = async function (p) {
    const q = String(p.query || '').trim(); if (!q) throw new Error(t('Type a subject to search for, for example: ESG rating disagreement stock returns.'));
    let f = O.oaFilter([], p.from, p.to, p.types, p.lang); if (p.oa_only) f += ',is_oa:true';
    const mc = parseInt(p.min_cites, 10); if (mc > 0) f += ',cited_by_count:>' + (mc - 1);
    const qq = oaq({ search: q, filter: f, per_page: Math.max(10, Math.min(200, p.n || 50)), select: FIND_SELECT }); if (p.sort && p.sort !== 'relevance') qq.sort = p.sort;
    const x = await O.http('https://api.openalex.org/works', qq);
    if (!x) throw new Error(t('OpenAlex did not answer the search.'));
    return { rows: O.findRows(x.results), found: Number((x.meta && x.meta.count) || (x.results || []).length), query: q, filters: f, sort: p.sort || 'relevance', at: U.now() };
  };
  O.libraryLink = (doi, resolver) => { const d = 'https://doi.org/' + doi; return /^https?:\/\/\S+$/.test(String(resolver || '').trim()) ? String(resolver).trim() + d : d; };
  O.fitScore = function (r, ticks, pool) {
    if (r.retracted) return 0; const keys = C.find_criteria.map(c => c.label); const own = (ticks || []).filter(x => keys.includes(x)).length / keys.length;
    let py = Math.max.apply(null, pool.map(p => p.per_year).filter(x => x !== null && !isNaN(x))); if (!isFinite(py) || py <= 0) py = 1;
    const sig = ((r.fwci === null ? 0.5 : Math.min(r.fwci / 2, 1)) + (r.per_year === null ? 0 : Math.min(r.per_year / py, 1)) + (r.pdf_url || r.oa_url ? 1 : 0.5)) / 3;
    return Math.round(100 * (0.6 * own + 0.4 * sig));
  };
  O.findSummaryPrompt = sh => 'You are helping a researcher choose the focal article for a systematic literature review (ANCHOR framework).\n' +
    'For each candidate below, use ONLY its abstract. Give four short lines: Question, Data and sample, Method, Main finding. ' +
    "Write 'not stated in the abstract' when the abstract does not say. Do not rank, score or recommend the candidates: the researcher decides.\n\n" +
    sh.map((r, i) => `=== Candidate ${i + 1}: ${r.title} (${r.authors}, ${r.year}), doi:${r.doi} ===\n${r.abstract || '(no abstract available)'}`).join('\n\n');
  O.findRef = r => `${r.authors || '[authors]'} (${r.year === null ? 'n.d.' : r.year}). ${r.title}.${r.journal ? ' ' + r.journal : ''}.${r.doi ? ' https://doi.org/' + r.doi : ''}`.replace(/\.\.(\s|$)/, '.$1');
  // download one legal open copy; refuses anything that is not a PDF
  O.download = async function (url) {
    const b = await O.http(url, {}, { as: 'bytes', timeout: 90000, tries: 1 });
    const bytes = typeof b === 'string' ? U.utf8(b) : b;
    if (!bytes) throw new Error(t('the server answered HTTP 404'));
    if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '%PDF') throw new Error(t("the link gave a web page, not a PDF (the host may ask you to click through). Use 'Open copy' and save it from your browser."));
    return bytes;
  };

  // ---------- OpenAlex corpus for the bibliometric analyses
  O.oaWorks = async function (filter, search, max, progress) {
    let out = [], cursor = '*', found = null;
    for (;;) {
      const q = oaq({ per_page: Math.min(200, max), cursor: cursor }); if (filter) q.filter = filter; if (search) q.search = search;
      const x = await O.http('https://api.openalex.org/works', q); if (!x) break;
      found = (x.meta && x.meta.count) || found; out = out.concat(x.results || []); if (progress) progress(out.length, found);
      cursor = x.meta && x.meta.next_cursor; if (!cursor || !(x.results || []).length || out.length >= max) break;
    }
    return { works: out.slice(0, max), found: found === null ? out.length : found };
  };
  O.focalWork = async function (doi) { const d = O.norm(doi); if (!d) throw new Error(t("Enter the focal article's DOI on the Start page first."));
    const w = await O.http('https://api.openalex.org/works/doi:' + d, oaq({})); if (!w) throw new Error(t('OpenAlex has no record for DOI {doi}.', { doi: d })); return w; };
  O.corpus = async function (p, progress) {
    const log = []; let works = [], found = 0;
    const add = (label, r) => { works = works.concat(r.works); found += r.found; log.push({ file: label, database: 'openalex (live)', records: r.works.length, found: r.found }); };
    if (p.mode === 'search') { if (!String(p.query || '').trim()) throw new Error(t('Write a search query, for example: ESG rating disagreement stock returns.'));
      add('OpenAlex search: ' + p.query, await O.oaWorks(O.oaFilter([], p.from, p.to, p.types, p.lang), p.query, p.max, progress)); }
    else { const fw = await O.focalWork(p.doi); const id = O.oaShort(fw.id);
      if (p.mode === 'citing' || p.mode === 'both') add('Works citing ' + id, await O.oaWorks(O.oaFilter(['cites:' + id], p.from, p.to, p.types, p.lang), null, p.max, progress));
      if (p.mode === 'refs' || p.mode === 'both') add('References of ' + id, await O.oaWorks(O.oaFilter(['cited_by:' + id]), null, p.max, progress)); }
    const seen = new Set(); works = works.filter(w => { if (seen.has(w.id)) return false; seen.add(w.id); return true; });
    if (!works.length) throw new Error(t('OpenAlex returned no records for this request.'));
    const M = root.IMPORT.openalexWorks(works);
    const fetched = log.reduce((s, r) => s + r.records, 0);
    return { M: M, log: log.map(r => ({ file: r.file, database: r.database, records: r.records })), found: found, dup: fetched - works.length,
      note: found > fetched ? t('OpenAlex found {n} records; the first {k} by relevance or date were fetched (raise the limit to fetch more).', { n: found, k: fetched }) : '' };
  };
  // retraction check of the dataset (50 DOIs per request)
  O.datasetCheck = async function (M, progress) {
    const dois = Array.from(new Set((M.DI || []).map(O.norm).filter(d => d && /^10\./.test(d) && !/[|,]/.test(d))));
    const out = [];
    for (let i = 0; i < dois.length; i += 50) { const ch = dois.slice(i, i + 50);
      const x = await O.http('https://api.openalex.org/works', oaq({ filter: 'doi:' + ch.join('|'), per_page: 100, select: 'id,doi,title,publication_year,is_retracted,cited_by_count' }));
      ((x && x.results) || []).forEach(w => out.push({ doi: O.norm(w.doi), title: w.title || '', year: w.publication_year, is_retracted: !!w.is_retracted })); if (progress) progress(Math.min(i + 50, dois.length), dois.length); }
    const flagged = out.filter(w => w.is_retracted).map(w => { const i = (M.DI || []).findIndex(d => O.norm(d) === w.doi); return { record: i >= 0 && M.SR ? M.SR[i] : '', title: w.title, doi: w.doi, notice: 'Retracted (OpenAlex)' }; });
    return { checked_at: U.now(), n_records: M.n, n_doi: dois.length, n_found: out.length, flagged: flagged };
  };

  // ---------- ROR and ORCID
  O.rorItems = x => { const seen = new Set(); return ((x && x.items) || []).map(o => { const nm = o.names || []; const disp = nm.find(n => (n.types || []).includes('ror_display')) || nm[0] || {};
    const loc = (o.locations && o.locations[0] && o.locations[0].geonames_details) || {};
    return { id: o.id || '', name: disp.value || '', city: loc.name || '', country: loc.country_code || '', domains: (o.domains || []).join(' '), types: (o.types || []).join(' ') }; }).filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }); };
  O.rorSearch = async function (q, cc) { q = String(q || '').trim(); if (q.length < 2) return [];
    const d = O.rorItems(await O.http('https://api.ror.org/v2/organizations', Object.assign({ query: q }, cc ? { filter: 'country.country_code:' + cc.toUpperCase() } : {})));
    return d.sort((a, b) => (/education/.test(b.types) ? 1 : 0) - (/education/.test(a.types) ? 1 : 0)); };
  const esEscape = x => x.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, c => '\\' + c);
  O.rorByDomain = async function (domain) {
    let d = String(domain || '').trim().toLowerCase().replace(/.*@/, '').replace(/\/.*$/, '').replace(/^https?:\/\//, '');
    if (!d || d.indexOf('.') < 0) throw new Error(t('Type your institution\'s email domain, for example university.edu (only the part after @ is used).'));
    const parts = d.split('.'); const GEN = ['ac', 'edu', 'co', 'com', 'gov', 'org', 'net', 'sch', 'mil', 'res', 'uni'];
    for (let k = 0; k < parts.length - 1; k++) { const rest = parts.slice(k); if (rest.length === 2 && GEN.includes(rest[0])) break;
      try { const r = O.rorItems(await O.http('https://api.ror.org/v2/organizations', { 'query.advanced': 'domains:' + esEscape(rest.join('.')) })); if (r.length) return r[0]; } catch (e) { /* try a shorter domain */ } }
    throw new Error(t('No institution in ROR lists the domain {d}. Choose it from the list or type its name.', { d: d }));
  };
  O.orcidOk = function (id) { id = String(id || '').trim().replace(/^https?:\/\/orcid.org\//, '').toUpperCase(); if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) return false;
    const d = id.replace(/-/g, ''); let tot = 0; for (const ch of d.slice(0, 15)) tot = (tot + Number(ch)) * 2; const r = (12 - tot % 11) % 11; return d[15] === (r === 10 ? 'X' : String(r)); };
  O.orcidName = async function (id) { id = String(id).trim().replace(/^https?:\/\/orcid.org\//, '').toUpperCase();
    const x = await O.http(`https://pub.orcid.org/v3.0/${id}/person`, {}, { headers: { Accept: 'application/json' } });
    if (!x) throw new Error(t('ORCID has no public record for {id}. Check the iD.', { id: id }));
    const n = x.name || {}; let nm = [((n['given-names'] || {}).value || ''), ((n['family-name'] || {}).value || '')].join(' ').trim(); if (!nm) nm = ((n['credit-name'] || {}).value || '').trim();
    return nm || t('record found; name not public'); };
  root.O = O;
})(window);
