/* ANCHOR Mobile - reading the uploaded article (port of the desktop app's article.R). PDF text comes from pdf.js on the
   device; Word (.docx) text from the document XML; plain text as is. The file never leaves the device. */
(function (root) {
  'use strict';
  const A = {};
  A.pdfText = async function (bytes) {
    const lib = root.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const doc = await lib.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i); const tc = await pg.getTextContent();
      // group text pieces into lines by their baseline; a gap of more than ~1.6 line heights starts a new paragraph
      const lines = []; let cur = null;
      for (const it of tc.items) { if (!('str' in it)) continue; const y = it.transform[5], x = it.transform[4], hgt = Math.abs(it.transform[3]) || it.height || 10;
        if (!cur || Math.abs(cur.y - y) > hgt * 0.5) { cur = { y: y, h: hgt, parts: [] }; lines.push(cur); }
        cur.parts.push({ x: x, s: it.str, w: it.width || 0 }); }
      let out = ''; let prev = null;
      for (const ln of lines) { ln.parts.sort((a, b) => a.x - b.x); let s = ''; let end = null;
        for (const p of ln.parts) { if (end !== null && p.x - end > 1.5 && !/\s$/.test(s) && !/^\s/.test(p.s)) s += ' '; s += p.s; end = p.x + p.w; }
        if (prev && (prev.y - ln.y) > Math.max(prev.h, ln.h) * 1.6) out += '\n';
        out += s.replace(/\s+$/, '') + '\n'; prev = ln; }
      pages.push(out);
    }
    const meta = await doc.getMetadata().catch(() => ({}));
    return { text: pages.join('\n\f\n'), pages: doc.numPages, meta_title: (meta && meta.info && meta.info.Title) || '' };
  };
  A.docxText = async function (bytes) {
    const zip = await root.JSZip.loadAsync(bytes); const f = zip.file('word/document.xml'); if (!f) throw new Error(t('This Word file has no document text.'));
    const xml = await f.async('string');
    return xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  };
  A.read = async function (file) {
    const name = file.name || 'article'; const ext = (name.split('.').pop() || '').toLowerCase(); const bytes = new Uint8Array(await U.readFile(file));
    const info = { file: name };
    if (ext === 'pdf' || (bytes[0] === 0x25 && bytes[1] === 0x50)) { const r = await A.pdfText(bytes); info.text = r.text; info.pages = r.pages; info.meta_title = r.meta_title; }
    else if (ext === 'docx') info.text = await A.docxText(bytes);
    else if (ext === 'txt' || ext === 'md') info.text = new TextDecoder('utf-8').decode(bytes);
    else throw new Error(t('Please upload the article as PDF, DOCX or TXT.'));
    info.doi = A.detectDoi(info.text); info.title_guess = A.guessTitle(info.text, info.meta_title || ''); info.abstract = A.extractAbstract(info.text);
    info.references = A.extractReferences(info.text); info.words = info.text.split(/\s+/).filter(Boolean).length; info.scanned = info.text.replace(/\s/g, '').length < 500;
    return info;
  };
  A.detectDoi = function (txt) { txt = txt.replace(/[‐‑‒–−]/g, '-'); const m = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/.exec(txt); return m ? m[0].replace(/[.,;)]+$/, '') : ''; };
  A.guessTitle = function (txt, meta) {
    if (meta && meta.length > 10 && !/^untitled|\.docx?$|microsoft|_|\.\./i.test(meta)) return meta;
    const blocks = txt.slice(0, 4000).split(/\n\s*\n/);
    for (const b of blocks.slice(0, 8)) { const b1 = b.replace(/\s*\n\s*/g, ' ').trim();
      if (!b1 || /doi|http|©|copyright|received|accepted|published|licen[cs]e|abstract|^#|\(\d{4}\)\s*\d+:/i.test(b1)) continue;
      if (/@/.test(b1) || (/&| and /.test(b1) && /\d/.test(b1) && b1.length < 120)) continue;
      if (b1.length >= 20 && b1.length <= 250) return b1; }
    return '';
  };
  A.extractAbstract = function (txt) {
    const m = /abstract\s*[:.]?\s*([\s\S]{200,2500}?)(\n\s*\n|keywords|jel|1\s+introduction|introduction)/i.exec(txt);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };
  A.extractReferences = function (txt) {
    const re = /^\s*(references|bibliography|literature cited)\s*$/gim; let last = -1, m; while ((m = re.exec(txt))) last = m.index; if (last < 0) return [];
    let ref = txt.slice(last).replace(/^\s*(references|bibliography|literature cited)\s*$/im, '').replace(/\f/g, '\n');
    const lines = ref.split('\n').map(s => s.trim()).filter(Boolean);
    const start = lines.map(l => /^[A-Z][A-Za-z'`-]+(,| )\s*([A-Z]\.|[A-Z][a-z]+,)/.test(l)); if (!start.some(Boolean)) return [];
    const refs = []; let cur = null; lines.forEach((l, i) => { if (start[i]) { if (cur !== null) refs.push(cur); cur = l; } else if (cur !== null) cur += ' ' + l; }); if (cur !== null) refs.push(cur);
    return refs.map(r => r.replace(/-\s+([a-z])/g, '$1')).filter(r => r.length > 30 && r.length < 800 && /(19|20)\d{2}/.test(r));
  };
  // the article's own reference list as bibliometric records (authors, year, title, source)
  A.refsToRecords = function (refs) {
    const STOPW = new Set(['AND', 'ET', 'AL', 'EDS', 'ED', 'VAN', 'VON', 'DE', 'DER']);
    return refs.map(r0 => { const r = r0.replace(/[–—]/g, '-');
      const ym = /\(?(19|20)\d{2}[a-z]?\)?/.exec(r); const yr = /(19|20)\d{2}/.exec(r);
      const auPart = ym ? r.slice(0, ym.index) : r;
      const words = auPart.match(/[A-Z][a-z'-]+(?:[A-Z][a-z]+)?|[A-Z]{2,}(?![a-z.])/g) || [];
      const surn = Array.from(new Set(words.map(w => w.toUpperCase()))).filter(w => !STOPW.has(w));
      const after = ym ? r.slice(ym.index + ym[0].length).replace(/^[).,:\s]+/, '').trim() : '';
      const srcm = after.match(/([A-Z][A-Za-z&:'\- ]{3,}?)(?=,?\s+\d+\s*(\(|:|,|$))/g) || [];
      let so = srcm.length ? srcm[srcm.length - 1].trim() : '';
      let ti = so ? after.slice(0, Math.max(0, after.indexOf(so))).replace(/[.?!]?\s*$/, '').trim() : after.replace(/([.?!])\s[\s\S]*$/, '$1').trim();
      if (!so) so = /working paper/i.test(after) ? 'WORKING PAPER' : after.replace(/^[^.?!]*[.?!]\s*/, '').replace(/,[\s\S]*$/, '').trim();
      return { AU: surn.slice(0, 10).join(';'), PY: yr ? Number(yr[0]) : null, TI: ti.toUpperCase(), SO: so.toUpperCase(), DT: 'ARTICLE', TC: null, DB: 'ARTICLE_REFS', DE: null, ID: null, CR: null, C1: null }; });
  };
  root.ART = A;
})(window);
