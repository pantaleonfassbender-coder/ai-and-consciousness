/* corpus.js — the local full-text layer.

   This site ships no running text of the Element. Everything below
   operates on a copy the reader opens: pdf.js reads it in the browser, the text
   is kept in IndexedDB on the reader's own device, and nothing is uploaded.
   The shipped anchor table maps every detected paragraph number to the page of
   the digital edition on which it begins, so hits can be cited canonically —
   by volume and paragraph, the way the Element are cited. */

const DB = "ai-and-consciousness", STORE = "text";
export const EXPECTED_PAGES = 94;

export const corpus = {
  pages: null,        // string[] — only present once a copy has been opened
  meta: null,         // {n, quelle, geladen, seitenOk}
  sections: null,     // sections.json
  anchors: null,      // {volumeNr: [[para, pdfPage], ...]}
  _inv: null,         // token -> page indices
  _chunks: [], _bm25: null,
};

/* ---------------------------------------------------------- IndexedDB */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
  const st = db.transaction(STORE, mode).objectStore(STORE);
  const rq = fn(st);
  rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
}));
const dbGet = k => tx("readonly", s => s.get(k)).catch(() => null);
const dbPut = (k, v) => tx("readwrite", s => s.put(v, k));
const dbDel = k => tx("readwrite", s => s.delete(k));

/* ---------------------------------------------------------- normalise */
export function normalize(s) {
  return s
    .replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/­/g, "").replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
    .replace(/ /g, " ");
}

const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be " +
  "been being it its this that these those he she they we you i his her their our your my me him " +
  "them us not no nor so such then than there here which who whom whose what when where while if " +
  "unless because shall should will would may might can could must let do does did done have has " +
  "had having more most much many other another same own also very just only even still yet upon " +
  "into unto out up down over under again further once all any both each few one two three thing " +
  "things way ways make made take taken give given go going come came say said see seen know known " +
  "think thought well good great little long new old cf ibid vol pp").split(" "));

export const tokens = s => (s.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ0-9'\-]{1,}/g) || []);

/* ------------------------------------------------------------- pdf.js */
export async function readPdf(file, onProgress) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = doc.numPages, pages = new Array(n);
  for (let i = 1; i <= n; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let last = null, out = "";
    for (const it of tc.items) {
      if (last !== null && Math.abs(it.transform[5] - last) > 2) out += "\n";
      out += it.str;
      if (it.hasEOL) out += "\n";
      last = it.transform[5];
    }
    pages[i - 1] = normalize(out)
      .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
      .replace(/[ \t]+/g, " ");
    if (onProgress && (i % 10 === 0 || i === n)) onProgress(i, n);
    if (i % 60 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return pages;
}

/* ------------------------------------------------------------ install */
export async function install(pages, filename) {
  const meta = {
    n: pages.length, quelle: filename, geladen: new Date().toISOString(),
    seitenOk: pages.length === EXPECTED_PAGES,
  };
  corpus.pages = pages; corpus.meta = meta;
  await dbPut("pages", pages);
  await dbPut("meta", meta);
  reindex();
  return meta;
}
export async function forget() {
  await dbDel("pages"); await dbDel("meta");
  corpus.pages = null; corpus.meta = null;
  corpus._inv = null; corpus._chunks = []; corpus._bm25 = null;
}
export async function restore(sections, anchors) {
  corpus.sections = sections; corpus.anchors = anchors;
  const pages = await dbGet("pages");
  const meta = await dbGet("meta");
  if (pages && meta) { corpus.pages = pages; corpus.meta = meta; reindex(); return true; }
  return false;
}
export const isOpen = () => !!corpus.pages;

/* ------------------------------------------------- canonical citation */
/** The Element is cited by printed page. The running heads give the mapping,
    and across all 83 pages that carry one the offset is a constant six —
    printed page = PDF page − 6. Where a page has no running head the offset is
    applied rather than guessed at, and the anchor table is consulted first. */
export function citeFor(p) {
  const anchors = corpus.anchors || {};
  const direct = anchors[String(p + 1)];
  const seite = direct != null ? direct : (p + 1) - 6;
  if (seite < 1 || seite > 71) return null;
  const sec = (corpus.sections || []).find(s => seite >= s.seite_von && seite <= s.seite_bis);
  return {
    seite, sec: sec ? sec.nr : null, titel: sec ? sec.titel : "",
    exact: direct != null,
    label: sec ? `§${sec.nr}, p. ${seite}` : `p. ${seite}`,
  };
}

/* ------------------------------------------------------------- index */
export function reindex() {
  corpus._inv = new Map(); corpus._chunks = [];
  if (!corpus.pages) return;
  corpus.pages.forEach((txt, p) => {
    if (!txt) return;
    for (const t of new Set(tokens(txt))) {
      if (t.length < 3) continue;
      let a = corpus._inv.get(t); if (!a) corpus._inv.set(t, (a = []));
      a.push(p);
    }
    const clean = txt.replace(/\s+/g, " ").trim();
    if (clean.length < 120) return;
    const sents = clean.split(/(?<=[.!?])\s+/);
    let cur = "";
    for (const s of sents) {
      if ((cur + " " + s).length > 1000 && cur.length > 260) {
        corpus._chunks.push({ page: p, text: cur.trim() }); cur = s;
      } else cur += " " + s;
    }
    if (cur.trim().length > 160) corpus._chunks.push({ page: p, text: cur.trim() });
  });
  buildBm25();
}

function buildBm25() {
  const df = new Map(); let total = 0;
  const docs = corpus._chunks.map(c => {
    const tf = new Map();
    const tk = tokens(c.text).filter(t => t.length > 2 && !STOP.has(t));
    for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    total += tk.length;
    return { tf, len: tk.length };
  });
  corpus._bm25 = { df, docs, avg: total / Math.max(1, docs.length), N: docs.length };
}

/* ------------------------------------------------------------ search */
function pagesWith(terms) {
  let cand = null;
  for (const t of terms) {
    const s = new Set(corpus._inv.get(t) || []);
    cand = cand === null ? s : new Set([...cand].filter(x => s.has(x)));
    if (!cand.size) break;
  }
  return [...(cand || [])].sort((a, b) => a - b);
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keyword in context, with a canonical citation on every hit. */
export function kwic(q, { win = 56, limit = 400 } = {}) {
  if (!corpus.pages) return [];
  const terms = tokens(q).filter(t => t.length > 2);
  if (!terms.length) return [];
  const rx = new RegExp("(" + q.trim().split(/\s+/).map(esc).join("\\s+") + ")", "gi");
  const out = [];
  for (const p of pagesWith(terms)) {
    const txt = corpus.pages[p].replace(/\s+/g, " ");
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(txt))) {
      out.push({
        l: txt.slice(Math.max(0, m.index - win), m.index),
        k: m[0],
        r: txt.slice(m.index + m[0].length, m.index + m[0].length + win),
        page: p, cite: citeFor(p),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function hitCounts(q) {
  const res = {};
  if (!corpus.pages) return res;
  const terms = tokens(q).filter(t => t.length > 2);
  const rx = new RegExp(q.trim().split(/\s+/).map(esc).join("\\s+"), "gi");
  for (const p of pagesWith(terms)) {
    const c = citeFor(p);
    if (!c || c.sec == null) continue;
    res[c.sec] = (res[c.sec] || 0) + (corpus.pages[p].replace(/\s+/g, " ").match(rx) || []).length;
  }
  return res;
}

/** BM25 retrieval, used to assemble the passages the dialogue is bound to. */
export function retrieve(query, k = 8) {
  if (!corpus._bm25 || !corpus._chunks.length) return [];
  const { df, docs, avg, N } = corpus._bm25;
  const q = tokens(query).filter(t => t.length > 2 && !STOP.has(t));
  if (!q.length) return [];
  const k1 = 1.4, b = 0.72, scored = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]; let s = 0;
    for (const t of q) {
      const f = d.tf.get(t); if (!f) continue;
      const n = df.get(t) || 0;
      s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) *
           (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avg));
    }
    if (s > 0) scored.push([i, s]);
  }
  scored.sort((a, c) => c[1] - a[1]);
  const perSec = new Map(), out = [];
  for (const [i, s] of scored) {
    const c = corpus._chunks[i];
    const cite = citeFor(c.page);
    const used = perSec.get(cite && cite.sec) || 0;
    if (used >= 3) continue;
    perSec.set(cite && cite.sec, used + 1);
    out.push({ ...c, score: +s.toFixed(2), cite });
    if (out.length >= k) break;
  }
  return out;
}
