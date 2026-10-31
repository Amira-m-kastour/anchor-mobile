/* ANCHOR Mobile - charts drawn as SVG for the bibliometric analyses (one renderer per chart type the engine returns).
   CH.svg(spec, width, palette) gives the SVG text (also used for the PNG that goes into reports and project files);
   CH.render(spec) gives the on-screen element, sized to the screen, with tap/hover tooltips. One y-axis per chart. */
(function (root) {
  'use strict';
  const CH = {};
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // light/dark palettes (categorical order validated for colour-vision deficiency; see the dataviz reference palette)
  const PAL = {
    light: { bg: '#FFFFFF', ink: '#14213D', ink2: '#3D4A5C', muted: '#6B7482', grid: '#ECE8DE', axis: '#C9C3B4', bar: '#14213D', accent: '#B4561A', land: '#E7E3D8', landLine: '#FFFFFF',
      cat: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'], seq: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'] },
    dark: { bg: '#161F33', ink: '#ECE8DE', ink2: '#C9CED8', muted: '#9AA3B2', grid: '#222C45', axis: '#38446A', bar: '#C9CED8', accent: '#E58C4F', land: '#26314C', landLine: '#161F33',
      cat: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'], seq: ['#104281', '#184f95', '#1c5cab', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'] }
  };
  CH.PAL = PAL;
  const dark = () => { const th = document.documentElement.getAttribute('data-theme'); return th === 'dark' || (th !== 'light' && root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches); };
  const fmtN = v => { if (v === null || v === undefined || isNaN(v)) return ''; const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (a >= 1e4) return Math.round(v / 1e3) + 'K'; if (a >= 1000) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100); };
  const niceTicks = (lo, hi, n) => { if (hi <= lo) hi = lo + 1; const span = hi - lo; const step0 = span / (n || 5); const mag = Math.pow(10, Math.floor(Math.log10(step0))); const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
    const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.round(v * 1e6) / 1e6); return out; };
  const trunc = (s, n) => { s = String(s === null || s === undefined ? 'NA' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const tw = (s, fs) => String(s).length * fs * 0.56;      // text width estimate
  function frame(W, H, P, body, title) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="IBM Plex Sans, IBM Plex Sans Arabic, Arial, sans-serif" role="img" aria-label="${esc(title || '')}">` +
      `<rect width="${W}" height="${H}" fill="${P.bg}"/>` + body + '</svg>';
  }
  const T = (x, y, s, P, o) => { o = o || {}; return `<text x="${x}" y="${y}" font-size="${o.fs || 11}" fill="${o.fill || P.ink2}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''}>${esc(s)}</text>`; };
  const tip = s => ` data-tip="${esc(s)}"`;
  function titleBlock(spec, W, P, fs) { return spec.title ? T(12, 20, spec.title, P, { fs: fs + 2, fill: P.ink, weight: 600 }) : ''; }

  // ---- horizontal bars (ranked categories)
  function bar(spec, W, P, fs) {
    const xs = spec.x.map(v => trunc(v, W < 500 ? 26 : 48)); const ys = spec.y.map(Number); const n = xs.length;
    const lw = Math.min(W * 0.48, Math.max(...xs.map(s => tw(s, fs))) + 10); const top = spec.title ? 34 : 10; const row = Math.max(20, fs * 2); const H = top + n * row + 30;
    const max = Math.max(...ys, 0) || 1; const x0 = lw + 8, x1 = W - 40; const sx = v => x0 + (x1 - x0) * v / max;
    const col = spec.colour === 'accent' ? P.accent : P.bar;
    let b = titleBlock(spec, W, P, fs);
    niceTicks(0, max, 4).forEach(v => { b += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top}" y2="${top + n * row}" stroke="${P.grid}"/>` + T(sx(v), top + n * row + 14, fmtN(v), P, { anchor: 'middle', fs: fs - 1, fill: P.muted }); });
    xs.forEach((s, i) => { const y = top + i * row; const w = Math.max(1, sx(ys[i]) - x0); const bh = Math.min(16, row - 6);
      b += T(lw, y + row / 2 + fs / 3, s, P, { anchor: 'end', fs: fs }) + `<path d="M${x0} ${y + (row - bh) / 2}h${Math.max(0, w - 3)}a3 3 0 0 1 3 3v${bh - 6}a3 3 0 0 1 -3 3h${-Math.max(0, w - 3)}z" fill="${col}"${tip(spec.x[i] + ': ' + fmtN(ys[i]))}/>` +
        T(x0 + w + 4, y + row / 2 + fs / 3, fmtN(ys[i]), P, { fs: fs - 1, fill: P.muted }); });
    b += `<line x1="${x0}" x2="${x0}" y1="${top}" y2="${top + n * row}" stroke="${P.axis}"/>` + (spec.ylab ? T(x1, H - 4, spec.ylab, P, { anchor: 'end', fs: fs - 1, fill: P.muted }) : '');
    return frame(W, H, P, b, spec.title);
  }
  // ---- x/y plots: line, area, lines, rpys
  function xy(spec, W, P, fs, series, opts) {
    opts = opts || {}; const top = (spec.title ? 34 : 12) + (spec.ylab ? 14 : 0); const legendH = series.length > 1 ? Math.ceil(series.length / Math.max(1, Math.floor(W / 170))) * (fs + 8) + 6 : 0;
    const H = Math.round(Math.min(420, Math.max(220, W * 0.55))) + legendH; const L = 46, R = 14, B = 34 + legendH; const xsAll = [].concat(...series.map(s => s.points.map(p => p[0]))).map(Number).filter(v => !isNaN(v));
    const ysAll = [].concat(...series.map(s => s.points.map(p => p[1]))).map(Number).filter(v => !isNaN(v));
    let xmin = Math.min(...xsAll), xmax = Math.max(...xsAll); if (xmin === xmax) { xmin -= 1; xmax += 1; }
    let ymin = Math.min(0, ...ysAll), ymax = Math.max(...ysAll); if (ymax === ymin) ymax = ymin + 1;
    const sx = v => L + (W - L - R) * (v - xmin) / (xmax - xmin); const sy = v => top + (H - top - B) * (1 - (v - ymin) / (ymax - ymin));
    let b = titleBlock(spec, W, P, fs);
    niceTicks(ymin, ymax, 5).forEach(v => { b += `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="${P.grid}"/>` + T(L - 6, sy(v) + 4, fmtN(v) + (spec.percent ? '%' : ''), P, { anchor: 'end', fs: fs - 1, fill: P.muted }); });
    const xt = niceTicks(xmin, xmax, Math.max(3, Math.floor(W / 90))).filter(v => !opts.intX || Number.isInteger(v));
    xt.forEach(v => { b += T(sx(v), H - B + 16, opts.intX ? String(v) : fmtN(v), P, { anchor: 'middle', fs: fs - 1, fill: P.muted }); });
    b += `<line x1="${L}" x2="${W - R}" y1="${sy(Math.max(0, ymin))}" y2="${sy(Math.max(0, ymin))}" stroke="${P.axis}"/>`;
    if (spec.ylab) b += T(L - 40, top - 10, spec.ylab, P, { fs: fs - 1, fill: P.muted });
    if (spec.xlab) b += T(W - R, H - B + 30, spec.xlab, P, { anchor: 'end', fs: fs - 1, fill: P.muted });
    if (opts.bars) { const bw = Math.max(2, Math.min(18, (W - L - R) / Math.max(1, (xmax - xmin + 1)) - 2)); opts.bars.points.forEach(p => { const x = sx(p[0]), y = sy(Math.max(0, p[1])), y0 = sy(0);
      b += `<rect x="${x - bw / 2}" y="${Math.min(y, y0)}" width="${bw}" height="${Math.abs(y0 - y)}" fill="${opts.bars.color}" rx="1.5"${tip(p[0] + ': ' + fmtN(p[1]))}/>`; }); }
    series.forEach((s, k) => { const pts = s.points.filter(p => p[1] !== null && !isNaN(p[1]) && p[0] !== null);
      const c = s.color || (series.length === 1 ? P.accent : P.cat[k % P.cat.length]); const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
      if (opts.area && pts.length) b += `<path d="${d}L${sx(pts[pts.length - 1][0])} ${sy(Math.max(0, ymin))}L${sx(pts[0][0])} ${sy(Math.max(0, ymin))}Z" fill="${c}" fill-opacity="0.12"/>`;
      b += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
      if (pts.length <= 60) pts.forEach(p => { b += `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="${series.length > 3 ? 2.5 : 3.5}" fill="${c}" stroke="${P.bg}" stroke-width="1.5"${tip((s.name ? s.name + ' · ' : '') + p[0] + ': ' + fmtN(p[1]) + (spec.percent ? '%' : ''))}/>`; }); });
    if (series.length > 1) { let lx = L, ly = H - legendH + 4; series.forEach((s, k) => { const lab = trunc(s.name, 22); const w = 24 + tw(lab, fs - 1);
      if (lx + w > W - R) { lx = L; ly += fs + 8; } const c = s.color || P.cat[k % P.cat.length]; b += `<line x1="${lx}" x2="${lx + 14}" y1="${ly + 6}" y2="${ly + 6}" stroke="${c}" stroke-width="3"${s.dash ? ' stroke-dasharray="4 3"' : ''}/>` + T(lx + 18, ly + 10, lab, P, { fs: fs - 1 }); lx += w + 10; }); }
    return frame(W, H, P, b, spec.title);
  }
  function stacked(spec, W, P, fs) {
    const n = spec.x.length; const top = spec.title ? 34 : 10; const row = Math.max(20, fs * 2); const lw = Math.min(W * 0.4, Math.max(...spec.x.map(s => tw(trunc(s, 24), fs))) + 10);
    const H = top + n * row + 52; const tot = spec.x.map((_, i) => spec.series.reduce((s, se) => s + (se.values[i] || 0), 0)); const max = Math.max(...tot, 1); const x0 = lw + 8, x1 = W - 34; const sx = v => (x1 - x0) * v / max;
    let b = titleBlock(spec, W, P, fs);
    spec.x.forEach((lab, i) => { const y = top + i * row; let acc = 0; const bh = Math.min(16, row - 6); b += T(lw, y + row / 2 + fs / 3, trunc(lab, 24), P, { anchor: 'end', fs: fs });
      spec.series.forEach((se, k) => { const v = se.values[i] || 0; const w = sx(v); if (w > 0) b += `<rect x="${x0 + acc + (acc ? 1 : 0)}" y="${y + (row - bh) / 2}" width="${Math.max(0.5, w - (acc ? 1 : 0))}" height="${bh}" fill="${P.cat[k]}"${tip(lab + ' · ' + se.name + ': ' + v)}/>`; acc += w; });
      b += T(x0 + acc + 4, y + row / 2 + fs / 3, fmtN(tot[i]), P, { fs: fs - 1, fill: P.muted }); });
    let lx = 12, ly = H - 30; spec.series.forEach((se, k) => { b += `<rect x="${lx}" y="${ly}" width="10" height="10" rx="2" fill="${P.cat[k]}"/>` + T(lx + 14, ly + 9, trunc(se.name, 40), P, { fs: fs - 1 }); ly += fs + 6; });
    return frame(W, H, P, b, spec.title);
  }
  function bradford(spec, W, P, fs) {
    const n = Math.min(spec.labels.length, 30); const z = spec.zone || []; const core = z.filter(x => x === 'Zone 1').length;
    const s = { title: spec.title, x: spec.labels.slice(0, n).map((l, i) => (i < core ? '★ ' : '') + l), y: spec.freq.slice(0, n), ylab: 'Documents (★ = core sources, zone 1)' };
    return bar(s, W, P, fs);
  }
  function authortime(spec, W, P, fs) {
    const authors = spec.authors; const pts = spec.points; const yrs = pts.map(p => p.year); const y0 = Math.min(...yrs), y1 = Math.max(...yrs);
    const lw = Math.min(W * 0.36, Math.max(...authors.map(a => tw(a, fs))) + 10); const top = spec.title ? 34 : 10; const row = 30; const H = top + authors.length * row + 30;
    const sx = v => lw + 14 + (W - lw - 30) * (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)); const maxF = Math.max(...pts.map(p => p.freq)); const maxT = Math.max(...pts.map(p => p.TCpY), 1e-9);
    let b = titleBlock(spec, W, P, fs);
    authors.forEach((a, i) => { const y = top + i * row + row / 2; b += T(lw, y + 4, trunc(a, 22), P, { anchor: 'end', fs: fs }); const mine = pts.filter(p => p.Author === a).sort((p, q) => p.year - q.year);
      if (mine.length) b += `<line x1="${sx(mine[0].year)}" x2="${sx(mine[mine.length - 1].year)}" y1="${y}" y2="${y}" stroke="${P.axis}" stroke-width="1.5"/>`;
      mine.forEach(p => { b += `<circle cx="${sx(p.year)}" cy="${y}" r="${3 + 8 * Math.sqrt(p.freq / maxF)}" fill="${P.accent}" fill-opacity="${0.25 + 0.75 * p.TCpY / maxT}" stroke="${P.bg}" stroke-width="1.5"${tip(`${a} · ${p.year}: ${p.freq} doc(s), ${fmtN(p.TC)} citations`)}/>`; }); });
    niceTicks(y0, y1, Math.max(3, Math.floor(W / 100))).filter(Number.isInteger).forEach(v => { b += T(sx(v), H - 10, String(v), P, { anchor: 'middle', fs: fs - 1, fill: P.muted }); });
    return frame(W, H, P, b, spec.title);
  }
  function wordcloud(spec, W, P, fs) {
    const words = spec.words.slice(0, 70); const H = Math.round(W * 0.62); const max = words.length ? words[0][1] : 1; const min = words.length ? words[words.length - 1][1] : 0;
    const placed = []; let b = ''; const cx = W / 2, cy = H / 2;
    words.forEach(([w, n], i) => { const size = Math.round((W < 500 ? 10 : 12) + (W < 500 ? 22 : 34) * (max === min ? 0.5 : (n - min) / (max - min))); const ww = tw(w, size) * 0.98, hh = size * 0.9;
      for (let k = 0; k < 2400; k++) { const a = 0.35 * k, r = 2.2 * Math.sqrt(k) * 2; const x = cx + r * Math.cos(a) * 1.5 - ww / 2, y = cy + r * Math.sin(a) + hh / 3;
        if (x < 4 || x + ww > W - 4 || y - hh < 4 || y > H - 4) continue;
        if (placed.every(p => x + ww < p[0] || p[0] + p[2] < x || y < p[1] - p[3] || p[1] < y - hh)) { placed.push([x, y, ww, hh]);
          b += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${i < 8 ? 600 : 400}" fill="${i < 8 ? P.accent : i % 3 ? P.ink : P.ink2}"${tip(w + ': ' + n)}>${esc(w.toLowerCase())}</text>`; break; } } });
    return frame(W, H, P, b, 'Word cloud');
  }
  function treemap(spec, W, P, fs) {
    const items = spec.items.slice(0, 30).map(r => ({ name: r[0], v: r[1], pct: r[2] })); const H = Math.round(W * 0.62); const tot = items.reduce((s, x) => s + x.v, 0) || 1; let b = '';
    // squarified layout
    const rects = []; let rest = items.map(x => Object.assign({}, x, { a: x.v / tot * W * H })); let box = { x: 0, y: 0, w: W, h: H };
    const worst = (row, s) => { const sum = row.reduce((t, r) => t + r.a, 0); const mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(s * s * mx / (sum * sum), sum * sum / (s * s * mn)); };
    while (rest.length) { const s = Math.min(box.w, box.h); let row = [rest[0]]; let i = 1; while (i < rest.length && worst(row.concat([rest[i]]), s) <= worst(row, s)) { row.push(rest[i]); i++; }
      const sum = row.reduce((t, r) => t + r.a, 0); if (box.w >= box.h) { const w = sum / box.h; let y = box.y; row.forEach(r => { const hh = r.a / w; rects.push(Object.assign(r, { x: box.x, y: y, w: w, h: hh })); y += hh; }); box = { x: box.x + w, y: box.y, w: box.w - w, h: box.h }; }
      else { const hh = sum / box.w; let x = box.x; row.forEach(r => { const w = r.a / hh; rects.push(Object.assign(r, { x: x, y: box.y, w: w, h: hh })); x += w; }); box = { x: box.x, y: box.y + hh, w: box.w, h: box.h - hh }; }
      rest = rest.slice(i); }
    const seq = P.seq; const lum = hx => { const n = parseInt(hx.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
    rects.forEach((r, k) => { const c = seq[Math.max(1, 6 - Math.floor(k / Math.max(1, rects.length / 6)))]; const light = lum(c) > 0.55;
      b += `<rect x="${r.x + 1}" y="${r.y + 1}" width="${Math.max(0, r.w - 2)}" height="${Math.max(0, r.h - 2)}" rx="3" fill="${c}"${tip(`${r.name}: ${r.v} (${r.pct}%)`)}/>`;
      if (r.w > tw(trunc(r.name, 18), fs) + 8 && r.h > fs + 8) b += T(r.x + 6, r.y + fs + 5, trunc(r.name.toLowerCase(), 18), P, { fs: fs, fill: light ? '#0b0b0b' : '#FFFFFF' }) + (r.h > 2 * fs + 12 ? T(r.x + 6, r.y + 2 * fs + 8, r.pct + '%', P, { fs: fs - 1, fill: light ? '#0b0b0b' : '#FFFFFF' }) : ''); });
    return frame(W, H, P, b, 'Tree map');
  }
  function trend(spec, W, P, fs) {
    const it = spec.items; if (!it.length) return frame(W, 60, P, T(12, 30, 'No trend topics (items need at least 3 occurrences).', P), '');
    const lw = Math.min(W * 0.38, Math.max(...it.map(x => tw(trunc(x.item, 24), fs))) + 10); const top = spec.title ? 34 : 10; const row = 22; const H = top + it.length * row + 28;
    const y0 = Math.min(...it.map(x => x.year_q1)), y1 = Math.max(...it.map(x => x.year_q3)); const sx = v => lw + 14 + (W - lw - 30) * (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)); const mf = Math.max(...it.map(x => x.freq));
    let b = titleBlock(spec, W, P, fs);
    niceTicks(y0, y1, Math.max(3, Math.floor(W / 100))).filter(Number.isInteger).forEach(v => { b += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top}" y2="${H - 24}" stroke="${P.grid}"/>` + T(sx(v), H - 8, String(v), P, { anchor: 'middle', fs: fs - 1, fill: P.muted }); });
    it.forEach((x, i) => { const y = top + i * row + row / 2; b += T(lw, y + 4, trunc(x.item, 24), P, { anchor: 'end', fs: fs }) + `<line x1="${sx(x.year_q1)}" x2="${sx(x.year_q3)}" y1="${y}" y2="${y}" stroke="${P.axis}" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="${sx(x.year_med)}" cy="${y}" r="${3 + 6 * Math.sqrt(x.freq / mf)}" fill="${P.accent}" stroke="${P.bg}" stroke-width="1.5"${tip(`${x.item}: ${x.freq} · median ${x.year_med} (${x.year_q1}-${x.year_q3})`)}/>`; });
    return frame(W, H, P, b, spec.title);
  }
  function network(spec, W, P, fs) {
    const nodes = spec.nodes, edges = spec.edges; const H = Math.round(W * (W < 500 ? 0.95 : 0.7)); const top = spec.title ? 30 : 6; const pad = 30;
    if (!nodes.length) return frame(W, 60, P, T(12, 30, 'No links between the selected items.', P), '');
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = v => pad + (W - 2 * pad) * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)), sy = v => top + pad + (H - top - 2 * pad) * (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0));
    const size = nodes.map(n => n.occ || n.deg || 1); const ms = Math.max(...size); const mw = Math.max(...edges.map(e => e[2]), 1);
    let b = titleBlock(spec, W, P, fs);
    edges.forEach(e => { const a = nodes[e[0]], c = nodes[e[1]]; const same = a.cluster === c.cluster; b += `<line x1="${sx(a.x).toFixed(1)}" y1="${sy(a.y).toFixed(1)}" x2="${sx(c.x).toFixed(1)}" y2="${sy(c.y).toFixed(1)}" stroke="${same ? N.color(a.cluster) : P.axis}" stroke-opacity="${same ? 0.35 : 0.3}" stroke-width="${(0.6 + 2.4 * e[2] / mw).toFixed(2)}"/>`; });
    const order = nodes.map((_, i) => i).sort((a, c) => size[a] - size[c]); const labelled = new Set(nodes.map((_, i) => i).sort((a, c) => size[c] - size[a]).slice(0, W < 500 ? 18 : 35));
    order.forEach(i => { const n = nodes[i]; const r = 3 + 11 * Math.sqrt(size[i] / ms); b += `<circle cx="${sx(n.x).toFixed(1)}" cy="${sy(n.y).toFixed(1)}" r="${r.toFixed(1)}" fill="${N.color(n.cluster)}" stroke="${P.bg}" stroke-width="1.5"${tip(`${n.name} · cluster ${n.cluster} · degree ${n.deg}`)}/>`; });
    order.filter(i => labelled.has(i)).forEach(i => { const n = nodes[i]; const r = 3 + 11 * Math.sqrt(size[i] / ms); b += T(sx(n.x), sy(n.y) - r - 3, trunc(n.name, 26), P, { anchor: 'middle', fs: fs - 1, fill: P.ink }); });
    return frame(W, H, P, b, spec.title);
  }
  const N = { color: k => root.NET ? root.NET.color(k) : '#999' };
  function quadrant(spec, W, P, fs) {
    const pts = spec.points; const H = Math.round(Math.max(300, W * 0.75)); const top = spec.title ? 34 : 12, L = 30, R = 14, B = 34;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const px = Math.max(0.5, (Math.max(...xs) - Math.min(...xs)) * 0.12), py = Math.max(0.5, (Math.max(...ys) - Math.min(...ys)) * 0.12);
    const x0 = Math.min(...xs) - px, x1 = Math.max(...xs) + px, y0 = Math.min(...ys) - py, y1 = Math.max(...ys) + py;
    const sx = v => L + (W - L - R) * (v - x0) / (x1 - x0), sy = v => top + (H - top - B) * (1 - (v - y0) / (y1 - y0)); const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
    const msz = Math.max(...pts.map(p => p.size), 1);
    let b = titleBlock(spec, W, P, fs) + `<line x1="${sx(mx)}" x2="${sx(mx)}" y1="${top}" y2="${H - B}" stroke="${P.axis}"/><line x1="${L}" x2="${W - R}" y1="${sy(my)}" y2="${sy(my)}" stroke="${P.axis}"/>`;
    if (spec.quadrants) { const q = spec.quadrants; b += T(L + 4, H - B - 6, q[0], P, { fs: fs - 1, fill: P.muted }) + T(L + 4, top + 12, q[1], P, { fs: fs - 1, fill: P.muted }) + T(W - R - 4, H - B - 6, q[2], P, { fs: fs - 1, fill: P.muted, anchor: 'end' }) + T(W - R - 4, top + 12, q[3], P, { fs: fs - 1, fill: P.muted, anchor: 'end' }); }
    pts.slice().sort((a, c) => c.size - a.size).forEach(p => { const r = 6 + 22 * Math.sqrt(p.size / msz); b += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${r}" fill="${N.color(p.cluster)}" fill-opacity="0.55" stroke="${N.color(p.cluster)}" stroke-width="1.5"${tip(p.label + '\n' + (p.words || []).slice(0, 8).join('\n'))}/>`; });
    // labels below, above, right or left of each bubble, whichever is free; a label that fits nowhere is left to the tooltip and table
    const boxes = []; const hit = q => boxes.some(o => q[0] < o[2] && o[0] < q[2] && q[1] < o[3] && o[1] < q[3]);
    if (spec.quadrants) { const qw = x => tw(x, fs - 1); boxes.push([L, H - B - 6 - fs, L + 4 + qw(spec.quadrants[0]), H - B], [L, top, L + 4 + qw(spec.quadrants[1]), top + 14], [W - R - 4 - qw(spec.quadrants[2]), H - B - 6 - fs, W - R, H - B], [W - R - 4 - qw(spec.quadrants[3]), top, W - R, top + 14]); }
    pts.forEach(p => { const r = 6 + 22 * Math.sqrt(p.size / msz); boxes.push([sx(p.x) - r * 0.7, sy(p.y) - r * 0.7, sx(p.x) + r * 0.7, sy(p.y) + r * 0.7]); });
    pts.slice().sort((a, c) => c.size - a.size).forEach(p => { const lab = trunc(p.label, W < 500 ? 16 : 30); const r = 6 + 22 * Math.sqrt(p.size / msz); const w = tw(lab, fs - 1), cx = sx(p.x), cy = sy(p.y);
      const cand = [[cx - w / 2, cy + r + 2], [cx - w / 2, cy - r - fs - 2], [cx + r + 3, cy - fs / 2], [cx - r - 3 - w, cy - fs / 2]];
      for (const [x, y] of cand) { const q = [x, y, x + w, y + fs]; if (x < L || x + w > W - R || y < top || y + fs > H - B) continue; if (hit(q)) continue; boxes.push(q); b += T(x, y + fs - 2, lab, P, { fs: fs - 1, fill: P.ink }); break; } });
    b += T(W - R, H - 8, spec.xlab || '', P, { anchor: 'end', fs: fs - 1, fill: P.muted }) + T(12, top + (H - top - B) / 2, spec.ylab || '', P, { anchor: 'middle', fs: fs - 1, fill: P.muted, rot: -90 });
    return frame(W, H, P, b, spec.title);
  }
  function sankey(spec, W, P, fs) {
    const nodes = spec.nodes.map((n, i) => Object.assign({ i: i, v: 0 }, n)); const used = new Set(spec.used); spec.flows.forEach(f => { nodes[f.from].vo = (nodes[f.from].vo || 0) + f.value; nodes[f.to].vi = (nodes[f.to].vi || 0) + f.value; });
    nodes.forEach(n => { n.v = Math.max(n.vo || 0, n.vi || 0); }); const top = spec.title ? 52 : 26; const H = Math.round(Math.max(360, W * 1.0)); const colW = 10; const xs = [12, W / 2 - colW / 2, W - 12 - colW];
    let b = titleBlock(spec, W, P, fs); ['AU', 'DE', 'SO'].forEach((_, k) => { b += T(xs[k] + (k === 2 ? colW : 0), top - 10, (spec.fields || [])[k] || '', P, { fs: fs, weight: 600, fill: P.ink, anchor: k === 0 ? 'start' : k === 2 ? 'end' : 'middle' }); });
    const lv = [0, 1, 2].map(l => nodes.filter(n => n.level === l && used.has(n.i)).sort((a, c) => c.v - a.v)); const gap = 4;
    const scale = Math.min(...lv.map(col => (H - top - 10 - gap * (col.length - 1)) / Math.max(1, col.reduce((s, n) => s + n.v, 0))));
    lv.forEach((col, l) => { let y = top; col.forEach(n => { n.x = xs[l]; n.y = y; n.h = Math.max(2, n.v * scale); n.oo = 0; n.io = 0; y += n.h + gap; }); });
    spec.flows.slice().sort((a, c) => c.value - a.value).forEach(f => { const a = nodes[f.from], c = nodes[f.to]; const h = f.value * scale; const y0 = a.y + a.oo + h / 2, y1 = c.y + c.io + h / 2; a.oo += h; c.io += h;
      const xa = a.x + colW, xc = c.x; b += `<path d="M${xa} ${y0}C${(xa + xc) / 2} ${y0} ${(xa + xc) / 2} ${y1} ${xc} ${y1}" fill="none" stroke="${P.cat[a.level === 0 ? 0 : 1]}" stroke-opacity="0.22" stroke-width="${Math.max(1, h)}"${tip(`${a.name} → ${c.name}: ${f.value}`)}/>`; });
    lv.forEach((col, l) => col.forEach(n => { b += `<rect x="${n.x}" y="${n.y}" width="${colW}" height="${n.h}" fill="${P.ink2}" rx="2"/>`;
      b += T(l === 2 ? n.x - 4 : n.x + colW + 4, n.y + n.h / 2 + 4, trunc(n.name, W < 500 ? 16 : 26), P, { fs: fs - 1, anchor: l === 2 ? 'end' : 'start', fill: P.ink }); }));
    return frame(W, H, P, b, spec.title);
  }
  function mapBase(W, P, fill, tipFor) {
    const Wd = root.ANCHOR_WORLD; const k = W / Wd.width; const H = Math.round(Wd.height * k); let b = `<g transform="scale(${k.toFixed(4)})">`;
    for (const name of Object.keys(Wd.paths)) { const f = fill(name); b += `<path d="${Wd.paths[name]}" fill="${f || P.land}" stroke="${P.landLine}" stroke-width="${(0.6 / k).toFixed(2)}"${f && tipFor ? tip(tipFor(name)) : ''}/>`; }
    return { b: b + '</g>', H: H, k: k };
  }
  const MAPNAME = { 'UNITED STATES': 'USA', 'UNITED KINGDOM': 'UNITED KINGDOM', ENGLAND: 'UNITED KINGDOM', SCOTLAND: 'UNITED KINGDOM', WALES: 'UNITED KINGDOM', 'NORTHERN IRELAND': 'UNITED KINGDOM', UK: 'UNITED KINGDOM' };
  const mapKey = n => { const u = String(n).toUpperCase(); return MAPNAME[u] || u; };
  function countrymap(spec, W, P, fs) {
    const vals = new Map(); spec.values.forEach(([c, n]) => { const k = mapKey(c); vals.set(k, (vals.get(k) || 0) + n); }); const max = Math.max(...vals.values(), 1);
    const step = v => P.seq[Math.min(6, Math.floor(6 * Math.log(1 + v) / Math.log(1 + max)))];
    const m = mapBase(W, P, name => vals.has(name) ? step(vals.get(name)) : null, name => `${name}: ${vals.get(name)}`);
    let b = m.b; const Wd = root.ANCHOR_WORLD; const mapped = new Set(Object.keys(Wd.paths));
    // small countries without an outline get a dot at their centre
    (BXC() || []).forEach(c => { if (vals.has(c.name) && !mapped.has(c.name)) { const p = Wd.project(c.lon, c.lat); b += `<circle cx="${p[0] * m.k}" cy="${p[1] * m.k}" r="4" fill="${step(vals.get(c.name))}" stroke="${P.bg}"${tip(c.name + ': ' + vals.get(c.name))}/>`; } });
    const lx = 12, ly = m.H + 10; let leg = ''; P.seq.forEach((c, i) => { leg += `<rect x="${lx + i * 26}" y="${ly}" width="24" height="10" fill="${c}"/>`; }); leg += T(lx, ly + 24, '1', P, { fs: fs - 1, fill: P.muted }) + T(lx + 7 * 26, ly + 24, fmtN(max), P, { fs: fs - 1, fill: P.muted, anchor: 'end' }) + T(lx + 7 * 26 + 10, ly + 9, 'author appearances (log scale)', P, { fs: fs - 1, fill: P.muted });
    return frame(W, m.H + 40, P, b + leg, spec.title);
  }
  const BXC = () => root.BX && root.BX.COUNTRIES;
  function collabmap(spec, W, P, fs) {
    const cs = new Map((BXC() || []).map(c => [c.name, c])); const inv = new Set(); spec.links.forEach(l => { inv.add(mapKey(l[0])); inv.add(mapKey(l[1])); });
    const m = mapBase(W, P, name => inv.has(name) ? P.seq[2] : null, name => name); let b = m.b; const Wd = root.ANCHOR_WORLD; const mw = Math.max(...spec.links.map(l => l[2]), 1);
    spec.links.forEach(l => { const a = cs.get(l[0]), c = cs.get(l[1]); if (!a || !c) return; const p = Wd.project(a.lon, a.lat).map(v => v * m.k), q = Wd.project(c.lon, c.lat).map(v => v * m.k);
      const mxp = (p[0] + q[0]) / 2, myp = (p[1] + q[1]) / 2 - Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.25;
      b += `<path d="M${p[0]} ${p[1]}Q${mxp} ${myp} ${q[0]} ${q[1]}" fill="none" stroke="${P.accent}" stroke-opacity="0.55" stroke-width="${(0.8 + 3 * l[2] / mw).toFixed(2)}"${tip(`${l[0]} – ${l[1]}: ${l[2]}`)}/>`; });
    return frame(W, m.H, P, b, 'Countries’ collaboration');
  }
  function historiograph(spec, W, P, fs) {
    const nodes = spec.nodes; if (!nodes.length) return frame(W, 60, P, T(12, 30, 'No local citations among these documents.', P), '');
    const top = spec.title ? 34 : 10; const yrs = nodes.map(n => n.Year); const y0 = Math.min(...yrs), y1 = Math.max(...yrs); const byY = new Map(); nodes.forEach(n => { byY.set(n.Year, (byY.get(n.Year) || 0) + 1); });
    const rowH = 24; const H = top + 20 + nodes.length * rowH + 30; const pos = new Map(); const lw = Math.min(W * 0.42, 190);
    const sx = v => 16 + (W - lw - 40) * (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0));
    nodes.slice().sort((a, c) => a.Year - c.Year || c.LCS - a.LCS).forEach((n, k) => { pos.set(n._i, [sx(n.Year), top + 20 + k * rowH]); });
    let b = titleBlock(spec, W, P, fs); const ml = Math.max(...nodes.map(n => n.LCS), 1);
    spec.links.forEach(l => { const a = pos.get(l[0]), c = pos.get(l[1]); if (!a || !c) return; const mx = Math.min(a[0], c[0]) - 14 - Math.abs(a[1] - c[1]) * 0.15;
      b += `<path d="M${a[0]} ${a[1]}C${mx} ${a[1]} ${mx} ${c[1]} ${c[0]} ${c[1]}" fill="none" stroke="${P.axis}" stroke-width="1"/>`; });
    nodes.forEach(n => { const p = pos.get(n._i); const r = 3 + 6 * Math.sqrt(n.LCS / ml); const lab = String(n.Paper).split(/ DOI /)[0];
      b += `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${P.accent}" stroke="${P.bg}" stroke-width="1.5"${tip(`${n.Paper} \u00b7 LCS ${n.LCS}, GCS ${n.GCS}`)}/>` + T(p[0] + r + 5, p[1] + 4, trunc(lab, Math.floor(lw / (fs * 0.56))), P, { fs: fs - 1, fill: P.ink }); });
    niceTicks(y0, y1, Math.max(3, Math.floor((W - lw) / 80))).filter(Number.isInteger).forEach(v => { b += T(sx(v), H - 8, String(v), P, { anchor: 'middle', fs: fs - 1, fill: P.muted }); });
    return frame(W, H, P, b, spec.title);
  }

  CH.svg = function (spec, W, P) {
    W = Math.max(300, Math.round(W || 640)); P = P || PAL.light; const fs = W < 480 ? 11 : 12;
    switch (spec.type) {
      case 'bar': return bar(spec, W, P, fs);
      case 'area': return xy(spec, W, P, fs, [{ points: spec.x.map((x, i) => [x, spec.y[i]]) }], { area: true, intX: true });
      case 'line': return xy(spec, W, P, fs, [{ points: spec.x.map((x, i) => [x, spec.y[i]]) }], { intX: true });
      case 'lines': return xy(spec, W, P, fs, spec.series.slice(0, 8), { intX: true });
      case 'rpys': return xy(Object.assign({}, spec, { ylab: 'Cited references', xlab: 'Reference year' }), W, P, fs, [{ name: 'Deviation from the 5-year median', points: spec.x.map((x, i) => [x, spec.y2[i]]), color: P.accent }],
        { intX: true, bars: { points: spec.x.map((x, i) => [x, spec.y[i]]), color: P.axis } });
      case 'stacked': return stacked(spec, W, P, fs);
      case 'bradford': return bradford(spec, W, P, fs);
      case 'authortime': return authortime(spec, W, P, fs);
      case 'wordcloud': return wordcloud(spec, W, P, fs);
      case 'treemap': return treemap(spec, W, P, fs);
      case 'trend': return trend(spec, W, P, fs);
      case 'network': return network(spec, W, P, fs);
      case 'quadrant': return quadrant(spec, W, P, fs);
      case 'sankey': return sankey(spec, W, P, fs);
      case 'countrymap': return countrymap(spec, W, P, fs);
      case 'collabmap': return collabmap(spec, W, P, fs);
      case 'historiograph': return historiograph(spec, W, P, fs);
      default: return frame(W, 40, P, T(10, 24, 'No chart for this result.', P), '');
    }
  };
  // on screen: sized to the container, current theme, tap or hover for values
  CH.render = function (spec) {
    const box = U.h('div.chart'); const w = Math.min(860, (document.getElementById('main') || document.body).clientWidth - 40 || 340);
    box.innerHTML = CH.svg(spec, Math.max(300, w), dark() ? PAL.dark : PAL.light);
    const tipEl = U.h('div', { style: { position: 'fixed', zIndex: 40, background: 'var(--navy)', color: 'var(--navy-ink)', padding: '6px 10px', borderRadius: '8px', fontSize: '.8rem', pointerEvents: 'none', whiteSpace: 'pre-line', maxWidth: '260px', display: 'none' } });
    box.appendChild(tipEl);
    const show = e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tipEl.style.display = 'none'; return; } const p = e.touches ? e.touches[0] : e;
      tipEl.textContent = t.getAttribute('data-tip'); tipEl.style.display = 'block'; tipEl.style.left = Math.min(window.innerWidth - 270, p.clientX + 12) + 'px'; tipEl.style.top = (p.clientY + 14) + 'px'; };
    box.addEventListener('mousemove', show); box.addEventListener('click', show); box.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
    return box;
  };
  // PNG for reports and .anchor files (white background, as in the desktop app's figures)
  CH.png = function (spec, W) {
    const svg = CH.svg(spec, W || 1000, PAL.light);
    return new Promise((res, rej) => { const img = new Image(); const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      img.onload = () => { try { const c = document.createElement('canvas'); const s = 1.5; c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { if (!b) return rej(new Error('PNG failed')); b.arrayBuffer().then(a => res({ png: new Uint8Array(a), svg: svg, w: c.width, h: c.height })); }, 'image/png'); } catch (e) { rej(e); } };
      img.onerror = () => rej(new Error('The figure could not be drawn.')); img.src = url; });
  };
  root.CH = CH;
})(window);
