/* ANCHOR Mobile - network tools behind the bibliometric maps: node selection as in bibliometrix::networkPlot,
   Louvain and Walktrap communities, betweenness, closeness, PageRank and a Fruchterman-Reingold layout.
   Graphs are undirected multigraphs: edge weight = number of parallel edges (bibliometrix builds them that way). */
(function (root) {
  'use strict';
  const N = {};
  // bibliometrix's cluster colours (colorlist()), used for networks and maps
  N.COLORS = ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#A65628', '#F781BF', '#999999', '#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#B3B3B3', '#A6CEE3',
    '#1F78B4', '#B2DF8A', '#33A02C', '#FB9A99', '#E31A1C', '#FDBF6F', '#FF7F00', '#CAB2D6', '#6A3D9A', '#B15928', '#8DD3C7', '#BEBADA', '#FB8072', '#80B1D3', '#FDB462', '#B3DE69', '#D9D9D9', '#BC80BD', '#CCEBC5'];
  N.color = k => (k >= 1 && k <= N.COLORS.length ? N.COLORS[k - 1] : '#D3D3D3');
  // seeded random numbers so maps are reproducible
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  N.rng = rng;

  // ---------- networkPlot(NetMatrix, n, remove.isolates = TRUE, remove.multiple = FALSE, noloops = TRUE)
  // net = {names, adj: Array<Map(j -> count)>} (symmetric, diagonal = occurrences)
  N.select = function (net, opts = {}) {
    const k = net.names.length; const names = net.names.map(x => String(x).toLowerCase());
    // igraph degree of graph.adjacency(undirected): off-diagonal counts + 2 x diagonal (loops count twice)
    // weighted graphs (bibliometrix weighted = TRUE) have one edge per non-zero cell, so degree counts neighbours
    const deg = net.adj.map((m, i) => { let d = 0; m.forEach((v, j) => { if (!(v > 0)) return; const c = opts.weighted ? 1 : v; d += (i === j ? 2 * c : c); }); return d; });
    let keep = Array.from({ length: k }, (_, i) => i);
    if (opts.n) { const n = Math.min(opts.n, k);
      const order = keep.slice().sort((a, b) => deg[b] - deg[a] || a - b);  // R: names(sort(deg, decreasing = TRUE)[1:n]) - stable
      const top = new Set(order.slice(0, n)); keep = keep.filter(i => top.has(i)); }
    const pos = new Map(keep.map((i, p) => [i, p]));
    let edges = [];
    keep.forEach(i => net.adj[i].forEach((v, j) => { if (j > i && pos.has(j) && v > 0) edges.push([pos.get(i), pos.get(j), v]); }));
    let nodes = keep.map(i => ({ name: names[i], deg: deg[i], occ: net.adj[i].get(i) || 0 }));
    if (opts.edgesMin > 1) edges = edges.filter(e => e[2] >= opts.edgesMin);
    if (opts.removeIsolates !== false) { const used = new Set(); edges.forEach(e => { used.add(e[0]); used.add(e[1]); });
      const map = new Map(); const nn = []; nodes.forEach((n, i) => { if (used.has(i)) { map.set(i, nn.length); nn.push(n); } });
      nodes = nn; edges = edges.map(e => [map.get(e[0]), map.get(e[1]), e[2]]); }
    return { nodes: nodes, edges: edges, weighted: !!opts.weighted };
  };
  function adjacency(g) { const a = g.nodes.map(() => []); for (const [i, j, w] of g.edges) { a[i].push([j, w]); a[j].push([i, w]); } return a; }
  N.adjacency = adjacency;

  // ---------- Louvain (Blondel et al., 2008), weights = edge multiplicity
  N.louvain = function (g, seed = 1) {
    const rand = rng(seed); const n = g.nodes.length; if (!n) return [];
    let comm = Array.from({ length: n }, (_, i) => i);
    let level = { n: n, adj: adjacency(g), self: new Array(n).fill(0) };
    let mapping = Array.from({ length: n }, (_, i) => i);
    for (let pass = 0; pass < 50; pass++) {
      const L = level; const k = new Array(L.n).fill(0); let m2 = 0;
      for (let i = 0; i < L.n; i++) { for (const [, w] of L.adj[i]) k[i] += w; k[i] += 2 * L.self[i]; m2 += k[i]; }
      if (m2 === 0) break;
      const c = Array.from({ length: L.n }, (_, i) => i); const tot = k.slice();
      let improved = false, moved = true; let guard = 0;
      while (moved && guard++ < 100) { moved = false;
        const order = Array.from({ length: L.n }, (_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        for (const i of order) { const ci = c[i]; const w = new Map(); for (const [j, wt] of L.adj[i]) { if (j === i) continue; w.set(c[j], (w.get(c[j]) || 0) + wt); }
          tot[ci] -= k[i]; let best = ci, bestGain = (w.get(ci) || 0) - tot[ci] * k[i] / m2;
          for (const [cj, wij] of w) { const gain = wij - tot[cj] * k[i] / m2; if (gain > bestGain + 1e-12) { bestGain = gain; best = cj; } }
          c[i] = best; tot[best] += k[i]; if (best !== ci) { moved = true; improved = true; } } }
      // renumber, aggregate
      const ids = new Map(); c.forEach(x => { if (!ids.has(x)) ids.set(x, ids.size); });
      mapping = mapping.map(x => ids.get(c[x]));
      if (!improved) break;
      const nn = ids.size; const adj = Array.from({ length: nn }, () => new Map()); const self = new Array(nn).fill(0);
      for (let i = 0; i < L.n; i++) { const ci = ids.get(c[i]); self[ci] += L.self[i];
        for (const [j, w] of L.adj[i]) { const cj = ids.get(c[j]); if (ci === cj) { if (i < j) self[ci] += w; } else adj[ci].set(cj, (adj[ci].get(cj) || 0) + w); } }
      level = { n: nn, adj: adj.map(m => Array.from(m.entries())), self: self };
    }
    return relabel(mapping);
  };
  // communities numbered 1.. by first appearance
  function relabel(m) { const ids = new Map(); return m.map(x => { if (!ids.has(x)) ids.set(x, ids.size + 1); return ids.get(x); }); }
  N.relabel = relabel;
  N.modularity = function (g, memb) { const a = adjacency(g); const k = a.map(l => l.reduce((s, e) => s + e[1], 0)); const m2 = k.reduce((s, x) => s + x, 0); if (!m2) return 0;
    let q = 0; const tot = new Map(); memb.forEach((c, i) => tot.set(c, (tot.get(c) || 0) + k[i]));
    for (const [i, j, w] of g.edges) if (memb[i] === memb[j]) q += 2 * w; q /= m2; for (const t of tot.values()) q -= (t / m2) ** 2; return q; };

  // ---------- Walktrap (Pons & Latapy, 2005), random walks of length 4, cut at maximum modularity (igraph's default)
  N.walktrap = function (g, steps = 4, weighted = false) {
    const n = g.nodes.length; if (!n) return [];
    const a = adjacency(g).map(l => l.slice());
    // igraph's walktrap adds a loop to every vertex weighing the mean weight of its edges (1 when unweighted or isolated);
    // in an unweighted multigraph every parallel edge counts as one edge of weight 1
    for (let i = 0; i < n; i++) { const deg = a[i].reduce((s, e) => s + (weighted ? 1 : e[1]), 0); const tw = a[i].reduce((s, e) => s + e[1], 0); a[i].push([i, deg ? tw / deg : 1]); }
    const d = a.map(l => l.reduce((s, e) => s + e[1], 0)); const tw = d.reduce((s, x) => s + x, 0);
    // probability vectors are dense (n is at most a few hundred); distances between neighbouring communities are cached
    const walk = start => { let p = new Float64Array(n); p[start] = 1; for (let s = 0; s < steps; s++) { const q = new Float64Array(n); for (let i = 0; i < n; i++) { const v = p[i]; if (!v) continue; for (const [j, w] of a[i]) q[j] += v * w / d[i]; } p = q; } return p; };
    const comms = new Map(); for (let i = 0; i < n; i++) comms.set(i, { size: 1, P: walk(i), members: [i] });
    const dist2 = (A, Bc) => { let s = 0; const x = A.P, y = Bc.P; for (let k = 0; k < n; k++) { const v = x[k] - y[k]; if (v) s += v * v / d[k]; } return s; };
    const cache = new Map(); const key = (x, y) => x < y ? x * 1e6 + y : y * 1e6 + x;
    const delta = (ci, cj) => { const k = key(ci, cj); let v = cache.get(k); if (v === undefined) { const A = comms.get(ci), Bc = comms.get(cj); v = (A.size * Bc.size / (A.size + Bc.size)) * dist2(A, Bc) / n; cache.set(k, v); } return v; };
    // neighbouring communities only
    const nb = new Map(); for (let i = 0; i < n; i++) nb.set(i, new Set(a[i].map(e => e[0]).filter(j => j !== i)));
    const memb = Array.from({ length: n }, (_, i) => i); let bestQ = -Infinity, bestMemb = memb.slice(); let next = n;
    const created = new Map(); let step = 0; let bestCreated = new Map();
    // modularity from community totals (same value as N.modularity)
    const ka = g.nodes.map(() => 0); for (const [i, j, w] of g.edges) { ka[i] += w; ka[j] += w; } const m2 = ka.reduce((x, y) => x + y, 0);
    const Q = () => { if (!m2) return 0; let q = 0; const tot = new Map(); memb.forEach((c, i) => tot.set(c, (tot.get(c) || 0) + ka[i]));
      for (const [i, j, w] of g.edges) if (memb[i] === memb[j]) q += 2 * w; q /= m2; for (const t of tot.values()) q -= (t / m2) ** 2; return q; };
    { const q = Q(); bestQ = q; bestMemb = memb.slice(); }
    while (comms.size > 1) {
      let best = null;
      for (const [ci] of comms) for (const cj of nb.get(ci)) { if (cj <= ci) continue; const dl = delta(ci, cj); if (!best || dl < best[2] - 1e-15) best = [ci, cj, dl]; }
      if (!best) break;
      const [ci, cj] = best; const A = comms.get(ci), Bc = comms.get(cj); const s = A.size + Bc.size; const P2 = new Float64Array(n);
      for (let k = 0; k < n; k++) P2[k] = (A.P[k] * A.size + Bc.P[k] * Bc.size) / s;
      const id = next++; created.set(id, step++); comms.set(id, { size: s, P: P2, members: A.members.concat(Bc.members) }); comms.delete(ci); comms.delete(cj);
      const nbs = new Set([...nb.get(ci), ...nb.get(cj)]); nbs.delete(ci); nbs.delete(cj); nb.set(id, nbs); nb.delete(ci); nb.delete(cj);
      for (const x of nbs) { const s2 = nb.get(x); s2.delete(ci); s2.delete(cj); s2.add(id); }
      for (const m of comms.get(id).members) memb[m] = id;
      const q = Q(); if (q > bestQ + 1e-12) { bestQ = q; bestMemb = memb.slice(); bestCreated = new Map(created); }
    }
    // number communities as igraph's community_to_membership does: the most recently formed first, then single vertices in order
    const ids = Array.from(new Set(bestMemb)); const merged = ids.filter(c => bestCreated.has(c)).sort((a, b) => bestCreated.get(b) - bestCreated.get(a));
    const single = ids.filter(c => !bestCreated.has(c)).sort((a, b) => bestMemb.indexOf(a) - bestMemb.indexOf(b));
    const num = new Map(merged.concat(single).map((c, k) => [c, k + 1])); return bestMemb.map(c => num.get(c));
  };

  // ---------- centralities on the multigraph, as igraph computes them in bibliometrix::networkPlot: parallel edges are separate
  // paths, and edge lengths are the layout weights (10 inside a community, 1 between, from community.repulsion = 0.1)
  N.edgeLengths = function (g, memb, within = 10, between = 1) { return g.edges.map(([i, j]) => (memb && memb[i] === memb[j] ? within : between)); };
  // weighted graphs: one edge, length = weight (igraph reads weights as lengths); multigraphs: multiplicity m, length from len
  function wadj(g, len) { const a = g.nodes.map(() => []); g.edges.forEach(([i, j, m], k) => { const L = g.weighted ? m : (len ? len[k] : 1); const mm = g.weighted ? 1 : m; a[i].push([j, mm, L]); a[j].push([i, mm, L]); }); return a; }
  function dijkstra(a, s) { // returns order of settling, dist, sigma, preds (with multiplicity)
    const n = a.length; const dist = new Array(n).fill(Infinity), sigma = new Array(n).fill(0), P = Array.from({ length: n }, () => []), done = new Array(n).fill(false); const S = [];
    dist[s] = 0; sigma[s] = 1; const heap = [[0, s]];
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) { const [d, v] = pop(); if (done[v] || d > dist[v]) continue; done[v] = true; S.push(v);
      for (const [w, mult, L] of a[v]) { const nd = d + L; if (nd < dist[w] - 1e-12) { dist[w] = nd; sigma[w] = sigma[v] * mult; P[w] = [[v, mult]]; push(nd, w); }
        else if (Math.abs(nd - dist[w]) <= 1e-12) { sigma[w] += sigma[v] * mult; P[w].push([v, mult]); } } }
    return { S, dist, sigma, P };
  }
  N.betweenness = function (g, len) {
    const a = wadj(g, len); const n = a.length; const cb = new Array(n).fill(0);
    for (let s = 0; s < n; s++) { const { S, sigma, P } = dijkstra(a, s); const delta = new Array(n).fill(0);
      while (S.length) { const w = S.pop(); for (const [v, mult] of P[w]) delta[v] += sigma[v] * mult / sigma[w] * (1 + delta[w]); if (w !== s) cb[w] += delta[w]; } }
    return cb.map(x => x / 2);
  };
  N.closeness = function (g, len) {
    const a = wadj(g, len);
    return a.map((_, s) => { const { dist } = dijkstra(a, s); let tot = 0, cnt = 0; dist.forEach((d, i) => { if (i !== s && isFinite(d)) { tot += d; cnt++; } }); return cnt ? 1 / tot : NaN; });
  };
  N.pagerank = function (g, len, damping = 0.85) {
    const a = wadj(g, len); const n = a.length; if (!n) return []; const k = a.map(l => l.reduce((s, e) => s + e[1] * e[2], 0));
    let pr = new Array(n).fill(1 / n);
    for (let it = 0; it < 2000; it++) { const nx = new Array(n).fill(0); let dangling = 0;
      for (let i = 0; i < n; i++) { if (!k[i]) { dangling += pr[i]; continue; } for (const [j, m, L] of a[i]) nx[j] += damping * pr[i] * m * L / k[i]; }
      let diff = 0; for (let i = 0; i < n; i++) { nx[i] += (1 - damping) / n + damping * dangling / n; diff += Math.abs(nx[i] - pr[i]); } pr = nx; if (diff < 1e-14) break; }
    const s = pr.reduce((x, y) => x + y, 0); return pr.map(x => x / s);
  };

  // ---------- Fruchterman-Reingold layout (seeded), normalised to [-1, 1]
  N.layoutFR = function (g, seed = 7, iterations = 500) {
    const n = g.nodes.length; const rand = rng(seed); if (!n) return [];
    const pos = g.nodes.map(() => [rand() * 2 - 1, rand() * 2 - 1]); if (n === 1) return [[0, 0]];
    const area = 4, kk = Math.sqrt(area / n); let t = 0.2;
    for (let it = 0; it < iterations; it++) {
      const disp = pos.map(() => [0, 0]);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1]; const dd = Math.max(1e-6, Math.hypot(dx, dy)); const f = kk * kk / dd;
        disp[i][0] += dx / dd * f; disp[i][1] += dy / dd * f; disp[j][0] -= dx / dd * f; disp[j][1] -= dy / dd * f; }
      for (const [i, j, w] of g.edges) { const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1]; const dd = Math.max(1e-6, Math.hypot(dx, dy)); const f = dd * dd / kk * Math.min(3, Math.log(1 + w));
        disp[i][0] -= dx / dd * f; disp[i][1] -= dy / dd * f; disp[j][0] += dx / dd * f; disp[j][1] += dy / dd * f; }
      for (let i = 0; i < n; i++) { const dl = Math.max(1e-9, Math.hypot(disp[i][0], disp[i][1])); pos[i][0] += disp[i][0] / dl * Math.min(dl, t); pos[i][1] += disp[i][1] / dl * Math.min(dl, t);
        pos[i][0] -= pos[i][0] * 0.01; pos[i][1] -= pos[i][1] * 0.01; }
      t *= 0.99;
    }
    const xs = pos.map(p => p[0]), ys = pos.map(p => p[1]); const nx = [Math.min(...xs), Math.max(...xs)], ny = [Math.min(...ys), Math.max(...ys)];
    return pos.map(p => [nx[1] > nx[0] ? (p[0] - nx[0]) / (nx[1] - nx[0]) * 2 - 1 : 0, ny[1] > ny[0] ? (p[1] - ny[0]) / (ny[1] - ny[0]) * 2 - 1 : 0]);
  };

  // networkPlot result: nodes with cluster, centralities and layout; cluster table like bibliometrix's cluster_res
  N.build = function (net, opts = {}) {
    const g = N.select(net, opts);
    let memb;
    if (opts.membershipByName) memb = g.nodes.map(nd => opts.membershipByName[nd.name] || 0);       // tests: reuse R's communities
    else memb = opts.cluster === 'walktrap' ? N.walktrap(g) : N.louvain(g, opts.seed || 1);
    const len = N.edgeLengths(g, memb);
    const btw = N.betweenness(g, len), clo = N.closeness(g, len), pr = N.pagerank(g, len); const lay = N.layoutFR(g, opts.seed || 7);
    g.nodes.forEach((nd, i) => Object.assign(nd, { cluster: memb[i], btw: btw[i], clo: clo[i], pr: pr[i], x: lay[i] ? lay[i][0] : 0, y: lay[i] ? lay[i][1] : 0 }));
    const order = g.nodes.map((_, i) => i).sort((a, b) => memb[a] - memb[b] || a - b);
    const table = { cols: ['Node', 'Cluster', 'Betweenness', 'Closeness', 'PageRank'], rows: order.map(i => { const nd = g.nodes[i]; return [nd.name, nd.cluster, round(nd.btw, 4), round(nd.clo, 4), round(nd.pr, 4)]; }) };
    return { nodes: g.nodes, edges: g.edges, table: table, modularity: N.modularity(g, memb) };
  };
  function round(x, d) { if (x === null || isNaN(x)) return null; const f = 10 ** d; return Math.round(x * f) / f; }
  N.round = round;

  if (typeof module !== 'undefined' && module.exports) module.exports = N; else root.NET = N;
})(typeof self !== 'undefined' ? self : this);
