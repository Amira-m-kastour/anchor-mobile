/* ANCHOR Mobile - languages. English text is the key; lang_de.js and lang_ar.js hold the German and Arabic texts for the
   interface and for the framework content (phases, questions, checks, controls). Prompts sent to Claude stay in English and
   ask for the draft in the chosen drafting language. */
(function (root) {
  'use strict';
  const L = root.ANCHOR_I18N = root.ANCHOR_I18N || {};
  // short labels that have no long English text of their own
  L.en = Object.assign({ 'nav:biblio': 'Bibliometrics', 'tab:A': 'Anchor', 'tab:N': 'Navigate', 'tab:C': 'Code', 'tab:H': 'Hypothesise', 'tab:O': 'Operationalise', 'tab:R': 'Report' }, L.en || {});
  const NAMES = { en: 'English', de: 'Deutsch', ar: 'العربية' };
  const ENGLISH_NAME = { en: 'English', de: 'German', ar: 'Arabic' };
  let lang = 'en';
  function pick() {
    let d = ''; try { d = JSON.parse(localStorage.getItem('anchor.settings') || '{}').lang || ''; } catch (e) { /* ignore */ }
    if (d && NAMES[d]) return d;
    const nav = (navigator.languages || [navigator.language || 'en']).map(x => String(x).slice(0, 2).toLowerCase());
    for (const n of nav) if (NAMES[n]) return n;
    return 'en';
  }
  function fmt(s, vars) { return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null) ? m : String(vars[k])) : s; }
  root.t = function (s, vars) { const d = L[lang]; const x = d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : Object.prototype.hasOwnProperty.call(L.en, s) ? L.en[s] : s; return fmt(x, vars); };
  root.I18N = {
    NAMES: NAMES, ENGLISH_NAME: ENGLISH_NAME,
    get lang() { return lang; },
    set: function (l) { lang = NAMES[l] ? l : 'en'; const h = document.documentElement; h.lang = lang; h.dir = lang === 'ar' ? 'rtl' : 'ltr'; },
    init: function () { this.set(pick()); },
    // numbers and dates for display (Arabic keeps Western digits, as in most academic writing)
    num: function (x, d) { if (x === null || x === undefined || x === '' || isNaN(Number(x))) return x === null || x === undefined ? '' : String(x);
      return Number(x).toLocaleString(lang === 'ar' ? 'ar-u-nu-latn' : lang === 'de' ? 'de-DE' : 'en-GB', d === undefined ? {} : { maximumFractionDigits: d }); },
    missing: function (l) { const d = L[l] || {}; return Object.keys(d).length; }
  };
})(window);
