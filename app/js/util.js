/* ANCHOR Mobile - small helpers: DOM building, escaping, dates, files, toasts, sheets. */
(function (root) {
  'use strict';
  const U = {};
  // h('div.card#id', {onclick, attrs...}, children...)
  U.h = function (sel, attrs) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; });
    let kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k]; if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = c => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) return c.forEach(add);
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return el;
  };
  U.esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.pad = n => String(n).padStart(2, '0');
  U.now = () => { const d = new Date(); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
  U.today = () => U.now().slice(0, 10);
  U.nz = s => s !== null && s !== undefined && String(s).trim() !== '';
  U.safeName = (x, n) => { const s = String(x || 'review').slice(0, n || 40).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); return s || 'review'; };
  U.uid = () => Math.random().toString(36).slice(2, 10);
  U.debounce = (f, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => f.apply(null, a), ms); }; };
  U.sleep = ms => new Promise(r => setTimeout(r, ms));
  U.readFile = (file, as) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    if (as === 'text') r.readAsText(file, 'utf-8'); else r.readAsArrayBuffer(file); });
  U.pickFile = (accept, multiple) => new Promise(res => {
    const i = U.h('input', { type: 'file', accept: accept || '', style: { display: 'none' } }); if (multiple) i.multiple = true;
    i.addEventListener('change', () => { res(Array.from(i.files || [])); i.remove(); }); document.body.appendChild(i); i.click(); });
  U.b64 = bytes => { let s = ''; const ch = 0x8000; for (let i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch)); return btoa(s); };
  U.utf8 = s => new TextEncoder().encode(s);
  U.csv = rows => rows.map(r => r.map(v => { const s = v === null || v === undefined ? 'NA' : String(v); return /[",\n\r]/.test(s) || s === '' ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n') + '\r\n';
  U.csvStrict = rows => rows.map(r => r.map(v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';

  // Save a file: the Android app's bridge, the File System Access API, or a download link
  U.save = async function (name, data, mime) {
    const bytes = typeof data === 'string' ? U.utf8(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    mime = mime || 'application/octet-stream';
    if (root.AnchorAndroid && root.AnchorAndroid.saveFile) {
      return new Promise(res => { const id = U.uid(); root.__anchorSaved = root.__anchorSaved || {}; root.__anchorSaved[id] = ok => { delete root.__anchorSaved[id]; res(ok); };
        root.AnchorAndroid.saveFile(name, mime, U.b64(bytes), id); });
    }
    const blob = new Blob([bytes], { type: mime });
    if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent) && root.File) {
      try { const f = new File([blob], name, { type: mime }); if (navigator.canShare({ files: [f] }) && U.preferShare) { await navigator.share({ files: [f], title: name }); return true; } } catch (e) { /* fall back */ }
    }
    const url = URL.createObjectURL(blob); const a = U.h('a', { href: url, download: name, style: { display: 'none' } });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000); return true;
  };
  U.copy = async function (text, fallbackEl) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      if (root.AnchorAndroid && root.AnchorAndroid.copy) { root.AnchorAndroid.copy(text); return true; }
      if (fallbackEl) { fallbackEl.removeAttribute('readonly'); fallbackEl.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } fallbackEl.setAttribute('readonly', ''); }
      return false;
    }
  };
  U.open = function (url) { if (root.AnchorAndroid && root.AnchorAndroid.openUrl) root.AnchorAndroid.openUrl(url); else root.open(url, '_blank', 'noopener'); };

  // toasts
  U.toast = function (msg, kind, ms) {
    let box = document.getElementById('toasts'); if (!box) { box = U.h('div#toasts', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const t = U.h('div.toast' + (kind ? '.' + kind : ''), msg); box.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms || (kind === 'error' ? 9000 : 4200)); setTimeout(() => t.remove(), (ms || (kind === 'error' ? 9000 : 4200)) + 400);
  };
  // bottom sheet / dialog; returns {close, el}
  U.sheet = function (title, body, buttons, opts) {
    opts = opts || {};
    const back = U.h('div.sheet-back'); const close = () => { back.classList.add('out'); setTimeout(() => back.remove(), 200); if (opts.onclose) opts.onclose(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); };
    const sheet = U.h('div.sheet' + (opts.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
      title ? U.h('div.sheet-head', U.h('h2', title), U.h('button.icon-btn', { 'aria-label': root.t ? root.t('Close') : 'Close', onclick: close }, U.icon('x'))) : null,
      U.h('div.sheet-body', body),
      buttons && buttons.length ? U.h('div.sheet-foot', buttons.map(b => U.h('button.btn' + (b.kind ? '.' + b.kind : ''), { onclick: () => { if (b.onclick && b.onclick() === false) return; close(); } }, b.label))) : null);
    back.appendChild(sheet); back.addEventListener('click', e => { if (e.target === back && !opts.modal) close(); });
    document.addEventListener('keydown', key); document.body.appendChild(back);
    setTimeout(() => { const f = sheet.querySelector('input,textarea,select,button.primary'); if (f && !opts.nofocus) f.focus({ preventScroll: true }); }, 50);
    return { close, el: sheet };
  };
  U.confirm = (title, text, yes, no) => new Promise(res => { let done = false;
    U.sheet(title, U.h('p', text), [{ label: no || (root.t ? root.t('Cancel') : 'Cancel'), onclick: () => { done = true; res(false); } }, { label: yes || 'OK', kind: 'primary', onclick: () => { done = true; res(true); } }],
      { onclose: () => { if (!done) res(false); } }); });
  U.busy = function (msg) { const b = U.h('div.busy', U.h('div.spinner'), U.h('span', msg)); document.body.appendChild(b); return { set: m => { b.lastChild.textContent = m; }, done: () => b.remove() }; };

  // inline icons (stroke icons drawn for this app)
  const ICONS = {
    x: 'M6 6l12 12M18 6L6 18', check: 'M5 12l5 5 9-10', lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z', unlock: 'M7 11V8a5 5 0 019.6-2M5 11h14v10H5z',
    home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
    menu: 'M4 7h16M4 12h16M4 17h16', more: 'M5 12h.01M12 12h.01M19 12h.01', gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4.9a7 7 0 00-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 00-1.7 1l-2.4-.9-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-.9a7 7 0 001.7 1l.4 2.5h5l.4-2.5a7 7 0 001.7-1l2.4.9 2-3.4-2-1.6c.1-.3.1-.7.1-1z',
    search: 'M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', download: 'M12 4v12M7 11l5 5 5-5M4 20h16', copy: 'M8 8h12v12H8zM4 16V4h12',
    folder: 'M3 6h6l2 2h10v11H3z', save: 'M5 3h11l3 3v15H5zM8 3v6h8M8 21v-7h8v7', info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 110 18 9 9 0 010-18z', back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7',
    wand: 'M4 20L16 8M14 4v3M18 6h3M19 2l-1 1M20 10v.01', clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2', play: 'M7 4l13 8-13 8z', plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    globe: 'M12 3a9 9 0 110 18 9 9 0 010-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', anchor: 'M12 7a2 2 0 100-4 2 2 0 000 4zM12 7v14M5 13a7 7 0 0014 0M8 10h8',
    rotate: 'M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0012 3M19 9A7 7 0 007 6', alert: 'M12 3l10 18H2zM12 10v5M12 18h.01', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    filter: 'M3 5h18l-7 8v6l-4 2v-8z', grad: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5', share: 'M8 12l8-5M8 12l8 5M18 4a2 2 0 110 4 2 2 0 010-4zM6 10a2 2 0 110 4 2 2 0 010-4zM18 16a2 2 0 110 4 2 2 0 010-4z',
    pen: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', lang: 'M4 5h10M9 3v2M11 5c-1 5-4 8-7 9M6 9c1 2 3 4 6 5M13 21l4-9 4 9M14.5 18h5'
  };
  U.icon = function (n, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[n] || ICONS.info); s.appendChild(p); return s;
  };
  root.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
