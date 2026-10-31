/* ANCHOR Mobile - R serialization (RDS, XDR format version 2 or 3): reader and writer.
   Reads any .anchor project the desktop app saves and writes it back faithfully: every node keeps its R type,
   attributes and flags, symbols are interned and environments keep their identity, so references are rebuilt the
   way R builds them. Byte code is kept as parsed and written back as it was read.
   Plain JavaScript values for the app come from toJS(); fromJS() turns them back into R nodes. */
(function (root) {
  'use strict';
  const T = { NIL: 0, SYM: 1, LIST: 2, CLO: 3, ENV: 4, PROM: 5, LANG: 6, SPECIAL: 7, BUILTIN: 8, CHAR: 9, LGL: 10, INT: 13, REAL: 14, CPLX: 15,
    STR: 16, DOT: 17, ANY: 18, VEC: 19, EXPR: 20, BCODE: 21, EXTPTR: 22, WEAKREF: 23, RAW: 24, S4: 25,
    ALTREP: 238, ATTRLIST: 239, ATTRLANG: 240, BASEENV: 241, EMPTYENV: 242, BCREPREF: 243, BCREPDEF: 244, GENERICREF: 245, CLASSREF: 246,
    PERSIST: 247, PACKAGE: 248, NAMESPACE: 249, BASENAMESPACE: 250, MISSINGARG: 251, UNBOUNDVALUE: 252, GLOBALENV: 253, NILVALUE: 254, REF: 255 };
  const NA_INT = -2147483648;
  const NA_REAL_HI = 0x7FF00000, NA_REAL_LO = 1954;          // R's NA_real_ bit pattern
  const SPECIAL_SINGLETONS = new Set([T.NILVALUE, T.GLOBALENV, T.EMPTYENV, T.BASEENV, T.BASENAMESPACE, T.UNBOUNDVALUE, T.MISSINGARG]);

  // ---------- nodes
  const NIL = { t: T.NILVALUE };
  const singletons = {};
  for (const s of SPECIAL_SINGLETONS) singletons[s] = s === T.NILVALUE ? NIL : { t: s };
  const symtab = new Map();
  function sym(name) { let s = symtab.get(name); if (!s) { s = { t: T.SYM, name: name }; symtab.set(name, s); } return s; }

  // ---------- reader
  function Reader(bytes) { this.b = bytes; this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.p = 0; this.refs = []; }
  Reader.prototype.int = function () { const v = this.dv.getInt32(this.p, false); this.p += 4; return v; };
  Reader.prototype.len = function () { const n = this.int(); if (n !== -1) return n; const hi = this.int(), lo = this.int(); return hi * 4294967296 + (lo >>> 0); };
  Reader.prototype.dbl = function () { const v = this.dv.getFloat64(this.p, false); const hi = this.dv.getUint32(this.p, false), lo = this.dv.getUint32(this.p + 4, false); this.p += 8;
    return (hi === NA_REAL_HI && lo === NA_REAL_LO) ? NA : v; };
  Reader.prototype.bytes = function (n) { const s = this.b.subarray(this.p, this.p + n); this.p += n; return s; };
  const NA = { na: true };                                          // NA_real_ marker (NaN payloads other than NA stay NaN)
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  const latin1 = typeof TextDecoder !== 'undefined' ? new TextDecoder('latin1') : null;

  Reader.prototype.strvec = function () { if (this.int() !== 0) throw new Error('RDS: bad string vector'); const n = this.int(); const out = []; for (let i = 0; i < n; i++) out.push(this.item()); return out; };

  Reader.prototype.item = function () {
    const flags = this.int(); const type = flags & 0xFF; const levels = flags >>> 12; const isObj = !!(flags & 256), hasAttr = !!(flags & 512), hasTag = !!(flags & 1024);
    if (SPECIAL_SINGLETONS.has(type)) return singletons[type];
    switch (type) {
      case T.REF: { let i = flags >>> 8; if (i === 0) i = this.int(); return this.refs[i - 1]; }
      case T.PERSIST: { const n = { t: T.PERSIST, names: this.strvec() }; this.refs.push(n); return n; }
      case T.SYM: { const c = this.item(); const s = sym(c.v === null ? 'NA' : c.v); s.cflags = c.flags; this.refs.push(s); return s; }
      case T.PACKAGE: case T.NAMESPACE: { const n = { t: type, info: this.strvec() }; this.refs.push(n); return n; }
      case T.ENV: { const n = { t: T.ENV, locked: this.int() }; this.refs.push(n); n.enclos = this.item(); n.frame = this.item(); n.hashtab = this.item(); n.attr = this.item(); return n; }
      case T.LIST: case T.LANG: case T.CLO: case T.PROM: case T.DOT: case T.ATTRLIST: case T.ATTRLANG: {
        // pairlists are read iteratively along the cdr chain
        const head = { t: type, flags: flags }; let cur = head, f = flags, ty = type;
        for (;;) {
          if (f & 512) cur.attr = this.item(); if (f & 1024) cur.tag = this.item();
          cur.car = this.item();
          if ((ty === T.LIST || ty === T.LANG || ty === T.DOT) ) {
            const save = this.p; const nf = this.int(); const nt = nf & 0xFF;
            if (nt === T.LIST || nt === T.LANG || nt === T.DOT) { const nx = { t: nt, flags: nf }; cur.cdr = nx; cur = nx; f = nf; ty = nt; continue; }
            this.p = save; cur.cdr = this.item(); break;
          }
          cur.cdr = this.item(); break;
        }
        return head;
      }
      case T.EXTPTR: { const n = { t: T.EXTPTR, flags: flags }; this.refs.push(n); n.prot = this.item(); n.tag = this.item(); if (hasAttr) n.attr = this.item(); return n; }
      case T.WEAKREF: { const n = { t: T.WEAKREF, flags: flags }; this.refs.push(n); if (hasAttr) n.attr = this.item(); return n; }
      case T.SPECIAL: case T.BUILTIN: { const len = this.int(); const n = { t: type, flags: flags, name: dec.decode(this.bytes(len)) }; if (hasAttr) n.attr = this.item(); return n; }
      case T.CHAR: { const len = this.int(); if (len === -1) return { t: T.CHAR, flags: flags, v: null };
        const by = this.bytes(len); const isLatin1 = !!(levels & 4); return { t: T.CHAR, flags: flags, v: (isLatin1 ? latin1 : dec).decode(by) }; }
      case T.LGL: case T.INT: { const n = this.len(); const v = new Array(n); for (let i = 0; i < n; i++) { const x = this.int(); v[i] = x === NA_INT ? null : (type === T.LGL ? x !== 0 : x); }
        const node = { t: type, flags: flags, v: v }; if (hasAttr) node.attr = this.item(); return node; }
      case T.REAL: { const n = this.len(); const v = new Array(n); for (let i = 0; i < n; i++) v[i] = this.dbl(); const node = { t: type, flags: flags, v: v }; if (hasAttr) node.attr = this.item(); return node; }
      case T.CPLX: { const n = this.len(); const v = new Array(n); for (let i = 0; i < n; i++) v[i] = [this.dbl(), this.dbl()]; const node = { t: type, flags: flags, v: v }; if (hasAttr) node.attr = this.item(); return node; }
      case T.STR: { const n = this.len(); const v = new Array(n); for (let i = 0; i < n; i++) v[i] = this.item(); const node = { t: type, flags: flags, v: v }; if (hasAttr) node.attr = this.item(); return node; }
      case T.VEC: case T.EXPR: { const n = this.len(); const v = new Array(n); for (let i = 0; i < n; i++) v[i] = this.item(); const node = { t: type, flags: flags, v: v }; if (hasAttr) node.attr = this.item(); return node; }
      case T.RAW: { const n = this.len(); const node = { t: type, flags: flags, v: this.bytes(n).slice() }; if (hasAttr) node.attr = this.item(); return node; }
      case T.S4: { const node = { t: type, flags: flags }; if (hasAttr) node.attr = this.item(); return node; }
      case T.BCODE: { const nreps = this.int(); const reps = new Array(nreps); const node = { t: T.BCODE, flags: flags, nreps: nreps, bc: this.bc1(reps) }; if (hasAttr) node.attr = this.item(); return node; }
      case T.ALTREP: { const node = { t: T.ALTREP, flags: flags }; node.info = this.item(); node.state = this.item(); node.attr = this.item(); return node; }
      default: throw new Error('RDS: unsupported type ' + type + ' at byte ' + this.p);
    }
  };
  Reader.prototype.bc1 = function (reps) {
    const code = this.item(); const n = this.int(); const consts = [];
    for (let i = 0; i < n; i++) { const type = this.int();
      if (type === T.BCODE) consts.push({ k: 'bc', type: type, v: this.bc1(reps) });
      else if ([T.LANG, T.LIST, T.BCREPDEF, T.BCREPREF, T.ATTRLANG, T.ATTRLIST].includes(type)) consts.push({ k: 'lang', type: type, v: this.bclang(type, reps) });
      else consts.push({ k: 'item', type: type, v: this.item() }); }
    return { code: code, consts: consts };
  };
  Reader.prototype.bclang = function (type, reps) {
    if (type === T.BCREPREF) { const i = this.int(); return { k: 'repref', i: i, target: reps[i] }; }
    if ([T.BCREPDEF, T.LANG, T.LIST, T.ATTRLANG, T.ATTRLIST].includes(type)) {
      let pos = -1; const n = { k: 'cell', origType: type };
      if (type === T.BCREPDEF) { pos = this.int(); type = this.int(); n.pos = pos; }
      n.type = type; if (pos >= 0) reps[pos] = n;
      if (type === T.ATTRLANG || type === T.ATTRLIST) n.attr = this.item();
      n.tag = this.item(); n.car = this.bclang(this.int(), reps); n.cdr = this.bclang(this.int(), reps); return n;
    }
    return { k: 'item', v: this.item() };
  };

  function parse(bytes) {
    const r = new Reader(bytes);
    const fmt = String.fromCharCode(bytes[0], bytes[1]); if (fmt !== 'X\n') throw new Error('Not an R XDR serialization (format ' + JSON.stringify(fmt) + ')');
    r.p = 2; const version = r.int(), rver = r.int(), minver = r.int(); let enc = null;
    if (version === 3) { const n = r.int(); enc = dec.decode(r.bytes(n)); }
    const value = r.item();
    return { version: version, rver: rver, minver: minver, encoding: enc, value: value };
  }

  // ---------- writer (mirrors R's WriteItem: references for symbols, environments, packages, namespaces, external and weak pointers)
  function Writer() { this.chunks = []; this.buf = new Uint8Array(1 << 16); this.dv = new DataView(this.buf.buffer); this.p = 0; this.refs = new Map(); this.nref = 0; }
  Writer.prototype.ensure = function (n) { if (this.p + n <= this.buf.length) return; let sz = this.buf.length * 2; while (sz < this.p + n) sz *= 2;
    const nb = new Uint8Array(sz); nb.set(this.buf.subarray(0, this.p)); this.buf = nb; this.dv = new DataView(nb.buffer); };
  Writer.prototype.int = function (v) { this.ensure(4); this.dv.setInt32(this.p, v, false); this.p += 4; };
  Writer.prototype.len = function (n) { if (n <= 2147483647) this.int(n); else { this.int(-1); this.int(Math.floor(n / 4294967296)); this.int(n % 4294967296 | 0); } };
  Writer.prototype.dbl = function (v) { this.ensure(8); if (v === NA || v === null) { this.dv.setUint32(this.p, NA_REAL_HI, false); this.dv.setUint32(this.p + 4, NA_REAL_LO, false); } else this.dv.setFloat64(this.p, v, false); this.p += 8; };
  Writer.prototype.raw = function (u8) { this.ensure(u8.length); this.buf.set(u8, this.p); this.p += u8.length; };
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  Writer.prototype.flags = function (type, levels, isObj, hasAttr, hasTag) { return type | (isObj ? 256 : 0) | (hasAttr ? 512 : 0) | (hasTag ? 1024 : 0) | (levels << 12); };
  function lv(n) { return n.flags !== undefined ? (n.flags >>> 12) : 0; }
  function isObjFlag(n) { return n.flags !== undefined ? !!(n.flags & 256) : hasClass(n); }
  function hasClass(n) { let a = n.attr; while (a && a !== NIL && a.t !== T.NILVALUE) { if (a.tag && a.tag.name === 'class') return true; a = a.cdr; } return false; }
  function hasAttrs(n) { return !!(n.attr && n.attr !== NIL && n.attr.t !== T.NILVALUE); }
  Writer.prototype.refOrAdd = function (n) { const i = this.refs.get(n); if (i !== undefined) { if (i > 8388607) { this.int(T.REF); this.int(i); } else this.int((i << 8) | T.REF); return true; }
    this.refs.set(n, ++this.nref); return false; };
  Writer.prototype.strvec = function (v) { this.int(0); this.int(v.length); for (const x of v) this.item(x); };
  Writer.prototype.char = function (n) {
    if (n.v === null) { this.int(this.flags(T.CHAR, n.flags !== undefined ? lv(n) : 0, false, false, false)); this.int(-1); return; }
    let levels = n.flags !== undefined ? lv(n) : 0; let by;
    if (levels & 4) { by = new Uint8Array(n.v.length); for (let i = 0; i < n.v.length; i++) by[i] = n.v.charCodeAt(i) & 0xFF; }
    else { by = enc.encode(n.v); if (n.flags === undefined) { let ascii = true; for (let i = 0; i < by.length; i++) if (by[i] > 127) { ascii = false; break; } levels = ascii ? 64 : 8; } }
    this.int(this.flags(T.CHAR, levels, false, false, false)); this.int(by.length); this.raw(by);
  };
  Writer.prototype.item = function (n) {
    if (n === undefined || n === null) n = NIL;
    if (SPECIAL_SINGLETONS.has(n.t)) { this.int(n.t); return; }
    switch (n.t) {
      case T.PERSIST: if (this.refOrAdd(n)) return; this.int(T.PERSIST); this.strvec(n.names); return;
      case T.SYM: if (this.refOrAdd(n)) return; this.int(T.SYM); this.char({ v: n.name, flags: n.cflags }); return;
      case T.PACKAGE: case T.NAMESPACE: if (this.refOrAdd(n)) return; this.int(n.t); this.strvec(n.info); return;
      case T.ENV: if (this.refOrAdd(n)) return; this.int(this.flags(T.ENV, 0, false, false, false)); this.int(n.locked || 0); this.item(n.enclos); this.item(n.frame); this.item(n.hashtab); this.item(n.attr); return;
      case T.LIST: case T.LANG: case T.CLO: case T.PROM: case T.DOT: case T.ATTRLIST: case T.ATTRLANG: {
        let cur = n;
        for (;;) {
          const ha = hasAttrs(cur), ht = !!(cur.tag && cur.tag !== NIL && cur.tag.t !== T.NILVALUE);
          this.int(this.flags(cur.t, lv(cur), isObjFlag(cur), ha, ht)); if (ha) this.item(cur.attr); if (ht) this.item(cur.tag); this.item(cur.car);
          const nx = cur.cdr;
          if ((cur.t === T.LIST || cur.t === T.LANG || cur.t === T.DOT) && nx && (nx.t === T.LIST || nx.t === T.LANG || nx.t === T.DOT) && !this.refs.has(nx)) { cur = nx; continue; }
          this.item(nx); return;
        }
      }
      case T.EXTPTR: if (this.refOrAdd(n)) return; this.int(this.flags(T.EXTPTR, lv(n), isObjFlag(n), hasAttrs(n), false)); this.item(n.prot); this.item(n.tag); if (hasAttrs(n)) this.item(n.attr); return;
      case T.WEAKREF: if (this.refOrAdd(n)) return; this.int(this.flags(T.WEAKREF, lv(n), isObjFlag(n), hasAttrs(n), false)); if (hasAttrs(n)) this.item(n.attr); return;
      case T.SPECIAL: case T.BUILTIN: { this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); const by = enc.encode(n.name); this.int(by.length); this.raw(by); if (hasAttrs(n)) this.item(n.attr); return; }
      case T.CHAR: this.char(n); return;
      case T.LGL: case T.INT: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); this.len(n.v.length);
        for (const x of n.v) this.int(x === null || x === undefined ? NA_INT : (n.t === T.LGL ? (x ? 1 : 0) : x)); if (hasAttrs(n)) this.item(n.attr); return;
      case T.REAL: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); this.len(n.v.length); for (const x of n.v) this.dbl(x); if (hasAttrs(n)) this.item(n.attr); return;
      case T.CPLX: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); this.len(n.v.length); for (const x of n.v) { this.dbl(x[0]); this.dbl(x[1]); } if (hasAttrs(n)) this.item(n.attr); return;
      case T.STR: case T.VEC: case T.EXPR: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); this.len(n.v.length); for (const x of n.v) this.item(x); if (hasAttrs(n)) this.item(n.attr); return;
      case T.RAW: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); this.len(n.v.length); this.raw(n.v); if (hasAttrs(n)) this.item(n.attr); return;
      case T.S4: this.int(this.flags(n.t, lv(n), isObjFlag(n), hasAttrs(n), false)); if (hasAttrs(n)) this.item(n.attr); return;
      case T.BCODE: this.int(this.flags(T.BCODE, lv(n), isObjFlag(n), hasAttrs(n), false)); this.int(n.nreps); this.bc1(n.bc); if (hasAttrs(n)) this.item(n.attr); return;
      case T.ALTREP: this.int(n.flags); this.item(n.info); this.item(n.state); this.item(n.attr); return;
      default: throw new Error('RDS writer: unsupported node type ' + n.t);
    }
  };
  Writer.prototype.bc1 = function (bc) { this.item(bc.code); this.int(bc.consts.length);
    for (const c of bc.consts) { this.int(c.type); if (c.k === 'bc') this.bc1(c.v); else if (c.k === 'lang') this.bclang(c.v); else this.item(c.v); } };
  Writer.prototype.bclang = function (n) {
    if (n.k === 'repref') { this.int(n.i); return; }        // type already written by the caller
    if (n.k === 'cell') { if (n.origType === T.BCREPDEF) { this.int(n.pos); this.int(n.type); }
      if (n.type === T.ATTRLANG || n.type === T.ATTRLIST) this.item(n.attr); this.item(n.tag);
      this.int(bcType(n.car)); this.bclang(n.car); this.int(bcType(n.cdr)); this.bclang(n.cdr); return; }
    this.item(n.v);
  };
  function bcType(n) { if (n.k === 'repref') return T.BCREPREF; if (n.k === 'cell') return n.origType; return 0; }

  function serialize(parsed) {
    const w = new Writer(); w.raw(new Uint8Array([88, 10])); const v = parsed.version || 3; w.int(v); w.int(parsed.rver || 263171); w.int(parsed.minver || (v === 3 ? 197888 : 131840));
    if (v === 3) { const e = enc.encode(parsed.encoding || 'UTF-8'); w.int(e.length); w.raw(e); }
    w.item(parsed.value); return w.buf.slice(0, w.p);
  }

  // ---------- attributes and plain values
  function attrGet(n, name) { let a = n.attr; while (a && a.t === T.LIST) { if (a.tag && a.tag.name === name) return a.car; a = a.cdr; } return undefined; }
  function attrsOf(n) { const out = []; let a = n.attr; while (a && a.t === T.LIST) { out.push([a.tag ? a.tag.name : '', a.car]); a = a.cdr; } return out; }
  function mkAttr(pairs) { let head = NIL; for (let i = pairs.length - 1; i >= 0; i--) head = { t: T.LIST, tag: sym(pairs[i][0]), car: pairs[i][1], cdr: head }; return head; }
  function strs(v) { return { t: T.STR, v: v.map(s => ({ t: T.CHAR, v: s === null || s === undefined ? null : String(s) })) }; }

  function expandAltrep(n) {
    const cls = n.info && n.info.car && n.info.car.name;
    if (cls === 'compact_intseq' || cls === 'compact_realseq') { const s = n.state.v; const len = Number(s[0] === NA ? 0 : s[0]), start = Number(s[1]), inc = Number(s[2]);
      const v = new Array(len); for (let i = 0; i < len; i++) v[i] = start + i * inc; return { t: cls === 'compact_intseq' ? T.INT : T.REAL, v: v, attr: n.attr }; }
    if (cls === 'deferred_string') { const arg = n.state.car; const v = (arg.v || []).map(x => x === null ? null : (arg.t === T.REAL && x === NA ? null : String(x)));
      return { t: T.STR, v: v.map(x => ({ t: T.CHAR, v: x })), attr: n.attr }; }
    if (cls && cls.indexOf('wrap_') === 0) { const inner = n.state.v[0]; return Object.assign({}, inner, { attr: n.attr && n.attr.t !== T.NILVALUE ? n.attr : inner.attr }); }
    return null;
  }

  // R value -> JS. Data frames become {__df:true, names, cols:[{type, v}], rownames}; named lists become objects; unnamed lists arrays.
  function toJS(n) {
    if (!n || n.t === T.NILVALUE) return null;
    if (n.t === T.ALTREP) { const e = expandAltrep(n); return e ? toJS(e) : { __r: n }; }
    const names = attrGet(n, 'names'); const cls = attrGet(n, 'class'); const clsv = cls ? cls.v.map(c => c.v) : [];
    if (n.t === T.VEC && clsv.includes('data.frame')) {
      const nm = names ? names.v.map(c => c.v) : []; const cols = n.v.map(c => colToJS(c));
      const rn = attrGet(n, 'row.names'); return { __df: true, names: nm, cols: cols, nrow: cols.length ? cols[0].v.length : rowCount(rn), class: clsv, rownames: rn };
    }
    if (n.t === T.VEC) { const v = n.v.map(toJS);
      if (names) { const o = {}; Object.defineProperty(o, '__order', { value: names.v.map(c => c.v), enumerable: false }); names.v.forEach((c, i) => { o[c.v] = v[i]; }); if (clsv.length) Object.defineProperty(o, '__class', { value: clsv, enumerable: false }); return o; }
      return v; }
    if (n.t === T.STR) { const v = n.v.map(c => c.v); return (v.length === 1 && !names) ? v[0] : withNames(v, names); }
    if (n.t === T.LGL || n.t === T.INT || n.t === T.REAL) { const v = n.v.map(x => x === NA ? null : x); if (clsv.includes('factor')) { const lev = attrGet(n, 'levels').v.map(c => c.v); return v.map(i => i === null ? null : lev[i - 1]); }
      return (v.length === 1 && !names) ? v[0] : withNames(v, names); }
    return { __r: n };                                             // anything else stays an R node
  }
  function withNames(v, names) { if (!names) return v; const o = {}; Object.defineProperty(o, '__order', { value: names.v.map(c => c.v), enumerable: false }); names.v.forEach((c, i) => { o[c.v] = v[i]; }); Object.defineProperty(o, '__vec', { value: true, enumerable: false }); return o; }
  function rowCount(rn) { if (!rn) return 0; if (rn.t === T.INT && rn.v.length === 2 && rn.v[0] === null) return Math.abs(rn.v[1]); return rn.v ? rn.v.length : 0; }
  function colToJS(c) {
    if (c.t === T.ALTREP) c = expandAltrep(c) || c;
    const cls = attrGet(c, 'class'); const clsv = cls ? cls.v.map(x => x.v) : [];
    if (clsv.includes('factor')) { const lev = attrGet(c, 'levels').v.map(x => x.v); return { type: 'str', v: c.v.map(i => i === null ? null : lev[i - 1]) }; }
    if (c.t === T.STR) return { type: 'str', v: c.v.map(x => x.v) };
    if (c.t === T.INT) return { type: 'int', v: c.v.slice() };
    if (c.t === T.REAL) return { type: 'real', v: c.v.map(x => x === NA ? null : x), class: clsv };
    if (c.t === T.LGL) return { type: 'lgl', v: c.v.slice() };
    return { type: 'r', v: c };
  }

  // JS -> R. Strings, numbers, booleans and arrays of them become vectors; objects named lists; {__df} data frames.
  function fromJS(x) {
    if (x === null || x === undefined) return NIL;
    if (x && x.__r) return x.__r;
    if (x && x.__df) return dfFromJS(x);
    if (typeof x === 'string') return strs([x]);
    if (typeof x === 'boolean') return { t: T.LGL, v: [x] };
    if (typeof x === 'number') return { t: T.REAL, v: [x] };
    if (Array.isArray(x)) {
      if (x.length && x.every(e => typeof e === 'string' || e === null) && x.some(e => typeof e === 'string')) return strs(x);
      if (x.length && x.every(e => typeof e === 'boolean' || e === null) && x.some(e => typeof e === 'boolean')) return { t: T.LGL, v: x.slice() };
      if (x.length && x.every(e => typeof e === 'number' || e === null) && x.some(e => typeof e === 'number')) return { t: T.REAL, v: x.map(e => e === null ? NA : e) };
      return { t: T.VEC, v: x.map(fromJS) };
    }
    if (x.__int) return { t: T.INT, v: x.__int.slice() };
    if (typeof x === 'object') {
      const keys = x.__order ? x.__order.filter(k => k in x).concat(Object.keys(x).filter(k => !x.__order.includes(k))) : Object.keys(x);
      if (x.__vec) { const vals = keys.map(k => x[k]); const base = fromJS(vals); base.attr = mkAttr([['names', strs(keys)]]); return base; }
      const node = { t: T.VEC, v: keys.map(k => fromJS(x[k])) };
      const at = [['names', strs(keys)]]; if (x.__class) at.push(['class', strs(x.__class)]); node.attr = mkAttr(at); return node;
    }
    throw new Error('Cannot convert value to R: ' + typeof x);
  }
  function dfFromJS(d) {
    const cols = d.cols.map(c => c.type === 'str' ? strs(c.v) : c.type === 'int' ? { t: T.INT, v: c.v.slice() } : c.type === 'lgl' ? { t: T.LGL, v: c.v.slice() } : c.type === 'r' ? c.v
      : Object.assign({ t: T.REAL, v: c.v.map(e => e === null ? NA : e) }, c.class && c.class.length ? { attr: mkAttr([['class', strs(c.class)]]) } : {}));
    const n = d.nrow !== undefined ? d.nrow : (cols[0] ? cols[0].v.length : 0);
    const keepRn = d.rownames && d.rownames.t === T.STR && d.rownames.v.length === n; const rn = keepRn ? d.rownames : { t: T.INT, v: [null, -n] };
    return { t: T.VEC, v: cols, attr: mkAttr([['names', strs(d.names)], ['class', strs(d.class || ['data.frame'])], ['row.names', rn]]) };
  }

  // named list access on the raw tree (keeps everything the app does not manage)
  function listGet(n, key) { const nm = attrGet(n, 'names'); if (!nm) return undefined; const i = nm.v.findIndex(c => c.v === key); return i < 0 ? undefined : n.v[i]; }
  function listSet(n, key, value) { const nm = attrGet(n, 'names'); const i = nm.v.findIndex(c => c.v === key);
    if (i >= 0) n.v[i] = value; else { n.v.push(value); nm.v.push({ t: T.CHAR, v: key }); } }
  function listKeys(n) { const nm = attrGet(n, 'names'); return nm ? nm.v.map(c => c.v) : []; }

  // ---------- gzip (browser streams or Node zlib)
  async function gunzip(u8) {
    if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8;
    if (typeof DecompressionStream !== 'undefined') { const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
    return new Uint8Array(require('zlib').gunzipSync(u8));
  }
  async function gzip(u8) {
    if (typeof CompressionStream !== 'undefined') { const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
    return new Uint8Array(require('zlib').gzipSync(u8, { level: 6 }));
  }
  async function readRDS(u8) { const raw = await gunzip(u8); if (raw[0] === 0x42 && raw[1] === 0x5a) throw new Error('This project is bzip2-compressed; save it again from ANCHOR Studio.'); return parse(raw); }
  async function writeRDS(parsed) { return gzip(serialize(parsed)); }

  const api = { T, NIL, NA, sym, parse, serialize, readRDS, writeRDS, toJS, fromJS, attrGet, attrsOf, mkAttr, strs, listGet, listSet, listKeys, gunzip, gzip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RDS = api;
})(typeof self !== 'undefined' ? self : this);
