/* app.js — router, data and views. */
import * as C from "./corpus.js";
import { renderDialogue } from "./dialogue.js";
import { viewWelfare, viewWelfareRefs } from "./welfare.js";

export const D = {};
const view = document.getElementById("view");

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const nf = n => new Intl.NumberFormat("en-GB").format(n);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const HUE = ["#c9a227", "#9db8a4", "#c07a5a", "#a89bc4", "#7fa9c9", "#c9968f",
             "#8fb3a0", "#b9a06a", "#a0b6c9", "#c4a0b4", "#93a97f"];
const secColor = i => HUE[i % HUE.length];
const secOf = nr => (D.sections || []).find(s => String(s.nr) === String(nr));

async function boot() {
  const names = ["korpus", "sections", "terms", "keyness", "biblio", "sep", "anchors",
                 "welfare_text", "welfare_sections", "welfare_biblio"];
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  names.forEach((n, i) => D[n] = res[i]);
  try { await C.restore(D.sections, D.anchors); } catch (e) { console.warn("restore failed", e); }
  refreshBadge();
  window.addEventListener("hashchange", route);
  route();
}

const ROUTES = {
  overview: viewOverview, sections: viewSections, vocabulary: viewVocabulary,
  references: viewReferences, onward: viewOnward, search: viewSearch,
  concordance: viewConcordance, method: viewMethod, privacy: viewPrivacy, imprint: viewImprint,
  dialogue: a => renderDialogue(view, a),
  welfare: viewWelfare, "welfare-refs": viewWelfareRefs,
};
function route() {
  const h = (location.hash || "#/overview").slice(2).split("/");
  const name = (h[0] || "overview").split("?")[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.v === name));
  view.innerHTML = ""; window.scrollTo(0, 0);
  (ROUTES[name] || viewOverview)(h.slice(1));
}

export function citeChip(cite) {
  if (!cite) return "";
  return `<a class="cite" href="#/sections/${cite.sec ?? ""}" title="${esc(cite.titel || "")}">${esc(cite.label)}</a>`;
}
function secBars(values, { height = 40, labels = false } = {}) {
  const max = Math.max(1, ...values);
  return `<div class="volbars" style="--h:${height}px">${values.map((v, i) => {
    const s = D.sections[i];
    return `<div class="vb" title="§${s.nr} ${esc(s.titel)} · ${nf(v)}">
      <i style="height:${Math.round(v / max * height)}px;background:${secColor(i)}"></i>
      ${labels ? `<span>${s.nr}</span>` : ""}</div>`;
  }).join("")}</div>`;
}
function sepList(key) {
  const rows = (D.sep || {})[String(key)] || [];
  if (!rows.length) return "";
  return `<ul class="seplist">${rows.map(r => `<li>
    <a href="${r.url}" target="_blank" rel="noopener">${esc(r.titel)}</a>
    <span class="fine">${esc(r.warum)}</span></li>`).join("")}</ul>`;
}

/* ============================================================ OVERVIEW */
function viewOverview() {
  const k = D.korpus;
  const sepCount = new Set(Object.values(D.sep).flat().map(r => r.slug)).size;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">A stepping stone</span>
      <h1>AI and Consciousness</h1>
      <p class="lede">Eric Schwitzgebel's Cambridge Element runs to seventy-one pages and is deliberately
      introductory: it argues that we do not know whether AI systems are conscious, that we may not know for
      a long time, and that the tools we have for finding out are weaker than they look. This apparatus takes
      it for what it is — a starting point — and is built to get you off it.</p></div>

    <div class="grid g4" style="margin-bottom:1.6rem">
      <div class="kpi"><b>11</b><span>sections</span></div>
      <div class="kpi"><b>${k.printed_to}</b><span>pages of argument</span></div>
      <div class="kpi"><b>${nf(k.tokens)}</b><span>running words</span></div>
      <div class="kpi"><b>${nf(k.references)}</b><span>works cited</span></div>
      <div class="kpi"><b>${sepCount}</b><span>encyclopedia entries mapped</span></div>
      <div class="kpi"><b>live</b><span>search of current work</span></div>
    </div>

    <div class="card" style="margin-bottom:1.6rem;border-left:3px solid #9db8a4">
      <span class="tag">New — the second Element</span>
      <h3>Emerging Questions in AI Welfare</h3>
      <p style="font-size:.92rem;color:var(--fg2)">Keeling and Street take the step Schwitzgebel's
      skepticism leaves open: if we cannot rule consciousness out, could AI systems be <em>welfare
      subjects</em> — and what would a precautionary ethics owe them? Their Element is open access
      (CC BY-NC 4.0), so this site carries it in full: seven sections, ${nf((D.welfare_sections || []).reduce((a, s) => a + s.tokens, 0))}
      words, searchable and citable by printed page.</p>
      <p><a class="btn" href="#/welfare">Read the second Element →</a></p>
    </div>

    <div class="grid g2" style="margin-bottom:2rem">
      <div class="card">
        <span class="tag">Getting oriented</span>
        <h3>What the Element argues</h3>
        <p style="font-size:.92rem;color:var(--fg2)">Eleven sections, each with the vocabulary that carries
        it and the encyclopedia entries that treat the same problem at length. Read a section, then follow it
        outward.</p>
        <p><a class="btn" href="#/sections">The argument, section by section →</a></p>
      </div>
      <div class="card">
        <span class="tag">Getting past it</span>
        <h3>What has happened since</h3>
        <p style="font-size:.92rem;color:var(--fg2)">A search that actually goes to the web, retrieves
        sources and hands you their URLs — for a question of yours, or for the section you are stuck in.
        What it reports comes from pages it fetched, not from a model's memory.</p>
        <p><a class="btn" href="#/search">Search the current literature →</a></p>
      </div>
    </div>

    <h2>The eleven sections</h2>
    <div class="grid g3" id="seclist" style="margin-bottom:2.2rem"></div>

    <div class="chartbox">
      <span class="tag">Where the weight lies — running words per section</span>
      ${secBars(D.sections.map(s => s.tokens), { height: 84, labels: true })}
      <p class="fine">Sections 8 and 9, on the empirical theories of consciousness, take up nearly a third of
      the Element between them. Section 1 is three pages of scene-setting.</p>
    </div>
  </div>`));

  const sl = view.querySelector("#seclist");
  D.sections.forEach((s, i) => {
    const keys = (D.keyness[String(s.nr)] || []).slice(0, 5).map(x => x[0]);
    const card = el(`<div class="workcard" style="border-top:3px solid ${secColor(i)}">
      <h3>§${s.nr} · ${esc(s.titel)}</h3>
      <p class="fine" style="margin:0">pp. ${s.seite_von}–${s.seite_bis} · ${nf(s.tokens)} words</p>
      <p style="font-size:.88rem;color:var(--fg2);margin:.35rem 0 0">${keys.map(esc).join(" · ")}</p>
    </div>`);
    card.onclick = () => location.hash = `#/sections/${s.nr}`;
    sl.append(card);
  });
}

/* ============================================================ SECTIONS */
function viewSections(args) {
  if (args && args[0]) return viewSection(args[0]);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Structure</span>
      <h1>The argument in eleven sections</h1>
      <p class="lede">The Element's own division, with the measures computed from each part and the words
      that distinguish it from the rest.</p></div>
    <div id="sl"></div>
  </div>`));
  const box = view.querySelector("#sl");
  D.sections.forEach(s => {
    const keys = (D.keyness[String(s.nr)] || []).slice(0, 12);
    box.append(el(`<div class="termrow">
      <div class="th">
        <a class="tw" href="#/sections/${s.nr}">§${s.nr} · ${esc(s.titel)}</a>
        <span class="fine">pp. ${s.seite_von}–${s.seite_bis} · ${nf(s.tokens)} words ·
          ${nf(s.sentences)} sentences · LIX ${s.lix.toFixed(0)}</span>
      </div>
      <div class="chips" style="margin-top:.5rem">${keys.map(([w]) =>
        `<a class="chip" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)}</a>`).join("")}</div>
    </div>`));
  });
}

function viewSection(nr) {
  const s = secOf(nr);
  if (!s) { location.hash = "#/sections"; return; }
  const keys = D.keyness[String(s.nr)] || [];
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">§${s.nr}</span>
      <h1>${esc(s.titel)}</h1>
      <p class="lede">Printed pages ${s.seite_von} to ${s.seite_bis} · ${nf(s.tokens)} words ·
      ${nf(s.sentences)} sentences.</p></div>

    <div class="panel"><h2>What distinguishes this section</h2>
      <p class="readable">Log-likelihood keyness against the other ten sections: the words that carry this
      part of the argument rather than the Element as a whole.</p>
      <div class="chips">${keys.slice(0, 22).map(([w, sc]) =>
        `<a class="chip" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)} <b>${sc.toFixed(0)}</b></a>`).join("")}</div>
    </div>

    <div class="panel"><h2>Where to read further</h2>
      <p class="readable">Entries in the Stanford Encyclopedia of Philosophy that treat the same problem at
      length. Each was checked to exist; the note says why it is worth the detour from here.</p>
      ${sepList(s.nr) || "<p class='fine'>No entry mapped to this section.</p>"}
    </div>

    <div class="panel"><h2>Take it further</h2>
      <p class="readable">The encyclopedia gives you the settled state of a debate. For what has been argued
      since — and this Element is itself from 2026 — use the
      <a href="#/search?sec=${s.nr}">live search</a>, which retrieves real sources and hands you their
      URLs.</p>
    </div>
  </div>`));
}

/* ========================================================== VOCABULARY */
function viewVocabulary() {
  const entries = Object.entries(D.terms).sort((a, b) => b[1].f - a[1].f);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Vocabulary</span>
      <h1>The words the argument runs on</h1>
      <p class="lede">The ${entries.length} most frequent content words and how they spread across the eleven
      sections. A flat profile means a term the whole Element leans on; a single spike means a term that
      belongs to one argument.</p></div>
    <div class="toolbar"><input type="search" id="tq" placeholder="Find a word…" autocomplete="off"></div>
    <div id="tl" class="termlist"></div>
  </div>`));
  const q = view.querySelector("#tq"), list = view.querySelector("#tl");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    list.innerHTML = entries.filter(([w]) => !t || w.includes(t)).slice(0, 100).map(([w, d]) =>
      `<div class="termrow"><div class="th">
        <a class="tw" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)}</a>
        <span class="fine">${nf(d.f)} occurrences · ${d.abschnitte} of 11 sections</span></div>
        ${secBars(d.dist)}</div>`).join("");
  };
  q.oninput = debounce(draw, 120); draw();
}

/* ========================================================== REFERENCES */
function viewReferences() {
  const b = D.biblio;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Bibliography</span>
      <h1>What the Element cites</h1>
      <p class="lede">All ${nf(b.length)} works in its reference list, parsed from the Element itself. This
      is the shortest route out of an introduction: the argument you want to follow is usually already cited
      here.</p></div>
    <div class="toolbar">
      <input type="search" id="bq" placeholder="Author, title or venue…" autocomplete="off">
      <select id="by"><option value="">Any year</option>
        <option value="2024">2024 and later</option>
        <option value="2020">2020 and later</option>
        <option value="2010">2010 and later</option></select>
    </div>
    <div id="bl" class="biblist"></div><p class="fine" id="bc"></p>
  </div>`));
  const q = view.querySelector("#bq"), y = view.querySelector("#by");
  const list = view.querySelector("#bl"), cnt = view.querySelector("#bc");
  const draw = () => {
    const t = q.value.trim().toLowerCase(), from = parseInt(y.value || "0", 10);
    const rows = b.filter(e => {
      const jahr = parseInt(String(e.jahr).slice(0, 4), 10);
      return (!t || (e.autoren + " " + e.rest).toLowerCase().includes(t)) && (!from || jahr >= from);
    });
    list.innerHTML = rows.slice(0, 260).map(e => `<div class="bib">
      <span class="ba">${esc(e.autoren)}</span> <span class="bj">(${esc(e.jahr)})</span>
      <span class="br">${esc(e.rest)}</span></div>`).join("");
    cnt.textContent = `${rows.length} of ${b.length} entries${rows.length > 260 ? " · first 260 shown" : ""}`;
  };
  q.oninput = debounce(draw, 140); y.onchange = draw; draw();
}

/* ============================================================== ONWARD */
function viewOnward() {
  const bySlug = new Map();
  for (const [sec, rows] of Object.entries(D.sep)) {
    for (const r of rows) {
      if (!bySlug.has(r.slug)) bySlug.set(r.slug, { ...r, secs: [] });
      if (sec !== "0") bySlug.get(r.slug).secs.push(sec);
    }
  }
  const all = [...bySlug.values()].sort((a, b) => b.secs.length - a.secs.length || a.titel.localeCompare(b.titel));
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Onward</span>
      <h1>Where to go from here</h1>
      <p class="lede">The Element is an overview, and an overview is a map rather than a destination. These
      ${all.length} entries in the Stanford Encyclopedia of Philosophy carry the debates it can only gesture
      at. Every one was checked to exist and is linked directly; the notes are mine.</p></div>

    <div class="panel"><h2>Start here</h2>${sepList("0")}</div>

    <div class="panel"><h2>By the section that sends you there</h2>
      <p class="readable">An entry appearing under several sections is one the Element keeps returning to.</p>
      <div class="septable">${all.map(r => `<div class="seprow">
        <a href="${r.url}" target="_blank" rel="noopener">${esc(r.titel)}</a>
        <span class="secs">${r.secs.length ? r.secs.map(s =>
          `<a class="chip sm" href="#/sections/${s}">§${s}</a>`).join("") : "<span class='fine'>general</span>"}</span>
      </div>`).join("")}</div>
    </div>

    <div class="panel"><h2>What the encyclopedia cannot give you</h2>
      <p class="readable">Two of the theories the Element spends longest on — integrated information and the
      global workspace — have <strong>no dedicated entry</strong>. They are treated inside
      <a href="https://plato.stanford.edu/entries/consciousness/" target="_blank" rel="noopener">Consciousness</a>
      (§9.1 and §9.6) and in <a href="https://plato.stanford.edu/entries/consciousness-neuroscience/"
      target="_blank" rel="noopener">The Neuroscience of Consciousness</a>. Worth knowing before you go
      looking for a page that does not exist.</p>
      <p class="readable">The encyclopedia is also, by design, behind the front. For work of the last two or
      three years — which on this topic is much of it — use the <a href="#/search">live search</a> or the
      Element's own <a href="#/references">reference list</a>.</p>
    </div>
  </div>`));
}

/* ========================================================= LIVE SEARCH */
function viewSearch() {
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const s = params.get("sec") ? secOf(params.get("sec")) : null;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Live search</span>
      <h1>What has been argued since</h1>
      <p class="lede">This goes to the open web, retrieves sources and reports what it found, with the URLs
      it retrieved. It is instructed to search rather than recall and not to invent a citation — but a
      language model can still misread a page, so treat every result as a lead.</p></div>

    <div class="statebox warn" style="margin-bottom:1rem">
      <strong>Before you type.</strong> Your question is turned into search queries and sent to the model
      provider's search infrastructure. Put nothing in it you would not type into a search engine — no
      unpublished work of your own, nothing about identifiable people.
    </div>

    <div class="panel">
      ${s ? `<p class="readable"><strong>Context:</strong> §${s.nr} · ${esc(s.titel)}
             (pp. ${s.seite_von}–${s.seite_bis}). The search will be told you are working through this part.
             <a href="#/search">Drop the context</a></p>` : ""}
      <textarea id="sq" rows="3" placeholder="${s
        ? "e.g. Which replies to this section&#39;s argument have appeared since 2024?"
        : "e.g. What has been published since 2024 on whether large language models meet global workspace criteria?"}"></textarea>
      <div class="btnrow">
        <button class="primary" id="sgo">Search the literature</button>
        <span class="fine" id="sstate"></span>
      </div>
      <p class="fine">Try: ${["What is the strongest published objection to the mimicry argument?",
         "Which empirical tests of AI consciousness have been proposed since 2024?",
         "Who defends a confident position, either way, on LLM consciousness?"]
        .map(x => `<a href="#" class="sug">${esc(x)}</a>`).join(" · ")}</p>
    </div>
    <div id="sout"></div>
  </div>`));

  const q = view.querySelector("#sq"), btn = view.querySelector("#sgo");
  const state = view.querySelector("#sstate"), out = view.querySelector("#sout");
  view.querySelectorAll(".sug").forEach(a => a.onclick = e => { e.preventDefault(); q.value = a.textContent; q.focus(); });

  btn.onclick = async () => {
    const frage = q.value.trim();
    if (frage.length < 4) { state.textContent = "Please formulate a question."; return; }
    btn.disabled = true; state.textContent = "Searching the web — this takes a moment …";
    let data;
    try {
      const kontext = s
        ? `Section ${s.nr} of the Element, "${s.titel}", pp. ${s.seite_von}–${s.seite_bis}. ` +
          `Its distinctive vocabulary: ${(D.keyness[String(s.nr)] || []).slice(0, 10).map(x => x[0]).join(", ")}.`
        : "";
      const r = await fetch("/api/explore", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ frage, kontext }),
      });
      data = await r.json();
    } catch (e) { data = { error: String(e && e.message ? e.message : e) }; }
    btn.disabled = false; state.textContent = "";
    if (data.error) { out.prepend(el(`<div class="statebox warn">${esc(data.error)}</div>`)); return; }
    out.prepend(el(`<div class="panel answer">
      <h2>${esc(frage)}</h2>
      <div class="readable">${data.antwort.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}</div>
      ${data.suchen && data.suchen.length ? `<details class="evidence">
        <summary>${data.suchen.length} searches were run</summary>
        <ul>${data.suchen.map(x => `<li class="mono">${esc(x)}</li>`).join("")}</ul></details>` : ""}
      ${data.quellen && data.quellen.length ? `<details class="evidence">
        <summary>${data.quellen.length} pages retrieved</summary>
        <ul>${data.quellen.map(x =>
          `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titel)}</a></li>`).join("")}</ul></details>` : ""}
      <p class="fine">Retrieved from the open web. Check each source before you cite it.</p>
    </div>`));
    q.value = "";
  };
}

/* ========================================================= CONCORDANCE */
function viewConcordance() {
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("q") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Concordance</span>
      <h1>Keyword in context</h1>
      <p class="lede">Every hit carries the section and the printed page it falls on. This runs against the
      copy you opened; nothing is sent anywhere.</p></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="A word or phrase…" value="${esc(pre)}" autocomplete="off"></div>
    <div id="cd"></div><div id="co"></div>
  </div>`));
  const q = view.querySelector("#cq"), out = view.querySelector("#co"), dist = view.querySelector("#cd");
  if (!C.isOpen()) {
    const b = el(`<div class="locked"><strong>Full text not shipped</strong>
      <p style="margin:.3rem 0 .9rem;font-size:.9rem">The concordance reads the text of your own copy. Open
      it once and it stays on this device.</p><button class="primary">Open your own copy</button></div>`);
    b.querySelector("button").onclick = openUnlock;
    out.append(b); return;
  }
  const draw = () => {
    const t = q.value.trim();
    if (t.length < 2) { out.innerHTML = ""; dist.innerHTML = ""; return; }
    const counts = C.hitCounts(t);
    dist.innerHTML = `<div class="chartbox"><span class="tag">Distribution across the sections</span>
      ${secBars(D.sections.map(s => counts[s.nr] || 0), { height: 56, labels: true })}</div>`;
    const hits = C.kwic(t, { limit: 300 });
    out.innerHTML = hits.length
      ? `<p class="fine">${hits.length} occurrences</p><table class="kwic"><tbody>${hits.map(h =>
          `<tr><td class="l">${esc(h.l)}</td><td class="k">${esc(h.k)}</td>
           <td class="r">${esc(h.r)}</td><td class="c">${citeChip(h.cite)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="fine">No occurrence found.</p>`;
  };
  q.oninput = debounce(draw, 200);
  if (pre) draw();
}

/* ============================================================== METHOD */
function viewMethod() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Transparency</span>
      <h1>Method, sources and limits</h1>
      <p class="lede">What was computed, from what, and where it does not carry.</p></div>

    <div class="panel"><h2>Rights, and what follows</h2>
      <p class="readable">The Element is in copyright: © Eric Schwitzgebel 2026, published by Cambridge
      University Press. This site therefore ships none of its text. What it ships is derived — section
      structure, page anchors, counts, term distributions and the reference list — plus editorial matter and
      the reading map written here. The concordance and the evidence mode of the dialogue run against a copy
      the reader supplies, read in the browser and stored on the reader's own device.</p>
      <p class="readable">One detail worth naming: a PDF downloaded from Cambridge Core carries a watermark
      on every page giving the DOI, a timestamp and <strong>the IP address of whoever downloaded it</strong>.
      That is personal data. It is stripped when the text is read, it is not counted, and it never leaves the
      reader's device — but anyone passing such a file around should know it is in there.</p>
    </div>

    <div class="panel"><h2>The second Element: full text under CC BY-NC</h2>
      <p class="readable">The rights position of the two Elements differs, and the site treats them
      differently. Keeling and Street's <em>Emerging Questions in AI Welfare</em> is published, in its
      online edition, under CC BY-NC 4.0 — non-commercial re-use with attribution and an indication of
      changes. This site is non-commercial, so it carries the full text: seven sections, 154 paragraphs,
      each anchored to its printed page, with the Element's 23 footnotes attached in place and its
      bibliography parsed. The changes made are stated with the text: the page layout, running heads and
      the per-download watermark were removed, end-of-line hyphenation was joined, and paragraph numbers
      were added editorially; the figures and tables are not reproduced. Schwitzgebel's Element carries no
      such licence, and for it the bring-your-own-book model stands unchanged.</p>
      <p class="readable">The watermark point applies here too: the source PDF carried the downloader's IP
      address on every page. It was removed before any file was committed, and no copy of it exists in the
      repository or its history.</p>
    </div>

    <div class="panel"><h2>Structure and page anchors</h2>
      <p class="readable">The eleven sections come from the PDF's own bookmarks. Printed page numbers were
      read from the running heads: 83 of the 94 pages carry one, and across all 83 the offset between PDF
      page and printed page is a constant six. Where a page has no running head — section openings and front
      matter — that constant is applied rather than a number guessed at, so a citation reads
      <span class="mono">§7, p. 34</span> and can be checked against the book.</p>
    </div>

    <div class="panel"><h2>Counts and keyness</h2>
      <p class="readable">Counts run over the eleven sections only; front matter, references and
      acknowledgements are excluded, and hyphenation across line breaks is resolved before counting. Keyness
      is log-likelihood against the other sections — good for what makes a section distinctive, poor as a
      guide to what it is about, since rare technical terms rise simply for being rare. With
      ${nf(D.korpus.tokens)} words in total this is a small corpus: single occurrences move the numbers, and
      nothing here should be reported as a finding about philosophical prose in general.</p>
    </div>

    <div class="panel"><h2>The reading map</h2>
      <p class="readable">The encyclopedia entries were not produced from a list held in memory. Each
      candidate slug was requested over HTTP and kept only if it answered; the titles are the ones the pages
      themselves carry. That is how the absence of a dedicated entry for integrated information and for the
      global workspace was established rather than assumed. The assignment of entries to sections, and the
      one-line notes, are editorial and therefore arguable — one reader's route, not a canon.</p>
    </div>

    <div class="panel"><h2>The live search</h2>
      <p class="readable">The search module uses the model provider's server-side web search. It is
      instructed to search rather than recall, to give only URLs it retrieved, and to say when a search comes
      back empty. Both the queries it ran and the pages it retrieved are shown with every answer, so the
      ground is visible rather than taken on trust. It can still misread a page, and a retrieved URL is not
      an endorsement of what is on it.</p>
    </div>

    <div class="panel"><h2>Known limits</h2>
      <ul style="color:var(--fg2);font-size:.93rem">
        <li>The reference parser reads a fixed pattern of author, year and remainder. It reports
          ${nf(D.korpus.references)} entries; a few unusual ones may be split or joined wrongly.</li>
        <li>The concordance searches the text as extracted. Ligatures and dashes are normalised, but a phrase
          broken across a page boundary will not be found.</li>
        <li>Nothing here distinguishes Schwitzgebel's own claims from positions he reports in order to
          reject. A hit is a hit.</li>
        <li>The page anchors were built against this printing. Against a differently paginated copy the
          search still works but the page numbers will not line up.</li>
      </ul>
    </div>
  </div>`));
}

/* ===================================================== PRIVACY, IMPRINT */
function viewPrivacy() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Privacy</span>
      <h1>Privacy notice</h1>
      <p class="lede">What this site does with data, at the level of detail at which it is actually true.
      Every claim below describes code you can read in this page's source.</p></div>

    <div class="panel"><h2>Who is responsible</h2>
      <p class="readable">Operated by a private individual from the United States; details in the
      <a href="#/imprint">legal notice</a>. A personal research project, not run on behalf of any
      institution, employer or publisher. Because it is reachable from the European Economic Area, this
      notice is written to satisfy the GDPR as well as United States law; where the GDPR applies, the
      operator is the controller within the meaning of Article 4(7).</p>
    </div>

    <div class="panel"><h2>What this site is, technically</h2>
      <p class="readable">Static files with two server functions. No accounts, no login, no contact form, no
      newsletter. <strong>No cookies whatsoever</strong>, no analytics, no tag manager, no advertising, no
      session recording. <strong>Nothing is loaded from third-party servers</strong>: pdf.js is served from
      this site, as are all data files. Opening a page contacts exactly one host — the one in your address
      bar.</p>
    </div>

    <div class="panel"><h2>Server logs</h2>
      <p class="readable">Hosting is by Netlify, whose infrastructure records the requests it serves — IP
      address, timestamp, URL, status, bytes, user-agent and referrer. Unavoidable in delivering a website
      and the only server-side collection here; it serves operation and security, is not analysed by the
      operator, and is retained per Netlify's own periods. Legal basis: Article 6(1)(f) GDPR. The site is
      operated and hosted in the United States, so for readers in the EEA this is processing outside the
      EEA.</p>
    </div>

    <div class="panel"><h2>Your copy of the Element</h2>
      <p class="readable">When you open it, pdf.js reads the text layer in your browser and stores the
      extracted text — with the file name and the time — in your browser's own <strong>IndexedDB</strong>
      database, named <span class="mono">ai-and-consciousness</span>. The PDF is never uploaded and neither
      is the text. The Cambridge Core watermark, which carries the downloader's IP address, is removed during
      reading and is not stored.</p>
      <p class="readable">The storage is <strong>persistent</strong> and, like all browser storage,
      unencrypted; on a shared machine another person with access to that browser profile could read it. The
      button in the top right clears it, as does clearing site data for this domain.</p>
    </div>

    <div class="panel"><h2>The two things that send data outward</h2>
      <p class="readable"><strong>The dialogue.</strong> On submitting a question it sends: your question, up
      to 4,000 characters; at most twenty retrieved passages of at most 2,600 characters each, with their
      citations; and at most the last six turns. Never the whole Element — only the passages retrieval picks
      for the question in front of you. Since those come from your copy, text from your own file does leave
      your device at that moment.</p>
      <p class="readable"><strong>The live search.</strong> This one differs in kind, and the difference
      matters. Your question is not merely processed: it is <strong>turned into search queries and executed
      against the open web</strong> through the model provider's search infrastructure, which then fetches
      pages. Your wording therefore leaves the traces a search query normally leaves, at a provider neither
      you nor the operator of this site controls. Nothing from your copy of the Element is sent by this
      module — only what you type, and the section heading if you came from one.</p>
      <p class="readable">Both go through Netlify's AI Gateway to Anthropic, so there are two recipients in
      the United States: Netlify Inc. and Anthropic PBC. Answers return to your browser and are written
      nowhere: the functions keep no log, no database and no copy, and their responses carry
      <span class="mono">cache-control: no-store</span>. Legal basis: Article 6(1)(b) and (f) GDPR. The
      sections, vocabulary, references and reading map never leave your browser at all.</p>
    </div>

    <div class="panel"><h2>Rights of readers in the European Economic Area</h2>
      <p class="readable">Where the GDPR applies you have the rights of access (Art. 15), rectification
      (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20) and objection (Art. 21), and
      the right to complain to a supervisory authority under Article 77. Requests go to the address in the
      <a href="#/imprint">legal notice</a>. The answer will be short: apart from the server logs nothing
      about you is held here.</p>
      <p class="readable">No representative in the Union has been designated under Article 27, on the
      exemption in Article 27(2)(a): the processing is occasional, involves no large-scale processing of
      special categories of data, and is unlikely to result in a risk to the rights and freedoms of natural
      persons.</p>
    </div>

    <div class="panel"><h2>Notice for California residents</h2>
      <p class="readable">Under CalOPPA (Cal. Bus. &amp; Prof. Code §§ 22575–22579): the information
      collected is network activity information in the form of the server logs above. No name, postal
      address, email address or telephone number is collected — there is no field for them. Text you submit
      to either module is transmitted to the model provider and is not retained by this site. Recipients are
      Netlify Inc. and Anthropic PBC; nothing is sold, rented or shared for marketing. No accounts and no
      stored profiles, so no record to review or amend. <strong>Do Not Track:</strong> this site does not
      track visitors over time or across third-party sites and so does not change behaviour on the signal —
      there is no tracking to disable, and no third-party content is loaded. Material changes are posted here
      with a revised date.</p>
    </div>

    <div class="panel"><h2>Children · Changes</h2>
      <p class="readable">Addressed to adult readers; not directed to children, and no information is
      knowingly collected from them. Effective 15 August 2026. Where this notice and the site's behaviour
      ever diverge, the notice is wrong and will be corrected — the description follows the code, not the
      other way round.</p>
    </div>
  </div>`));
}

function viewImprint() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Legal notice</span>
      <h1>Legal notice</h1>
      <p class="lede">Who operates this site, and how to reach them.</p></div>
    <div class="panel"><h2>Operator</h2>
      <p class="readable">Dr. Pantaleon Fassbender<br>16751 NE 5th Street<br>Williston, FL 32696<br>United States</p>
      <p class="readable">Email: <a href="mailto:pantaleonfassbender@gmail.com">pantaleonfassbender@gmail.com</a></p>
      <p class="readable">A personal research project, operated and hosted in the United States by a private
      individual, not on behalf of any institution, employer or publisher. No company behind it, no
      advertising, no sponsorship. Responsible for the content: Dr. Pantaleon Fassbender, at the address
      above.</p>
    </div>
    <div class="panel"><h2>Rights in the text</h2>
      <p class="readable">An independent reader's apparatus, <strong>not affiliated with, endorsed by, or
      connected to</strong> Eric Schwitzgebel, Cambridge University Press, or the editors of the Elements
      series. It contains no text of the Element: only derived data and editorial matter written here.
      Reference: Eric Schwitzgebel, <em>AI and Consciousness: A Skeptical Overview</em>, Elements in
      Philosophy and AI (Cambridge University Press, 2026), doi:10.1017/9781009694285. All rights rest with
      the author and the publisher. If you hold rights in this work and consider anything here to exceed what
      derived data and scholarly citation permit, write to the address above and it will be dealt with
      promptly.</p>
    </div>
    <div class="panel"><h2>Links and warranty</h2>
      <p class="readable">This site links outward, and the live search retrieves pages it has not vetted.
      Content at the other end is the responsibility of its operators. Everything here is offered free of
      charge and without warranty: the measures can mislead, the reading map is one reader's judgement, and
      generated answers can be wrong. The limits are set out under <a href="#/method">Method</a>, and they
      are part of the tool rather than a disclaimer beside it.</p>
    </div>
  </div>`));
}

/* ============================================================ UNLOCKING */
const modal = document.getElementById("unlockModal");
function openUnlock() { modal.hidden = false; }
document.getElementById("unlockBtn").onclick = openUnlock;
document.getElementById("closeUnlock").onclick = () => { modal.hidden = true; };
modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });

const input = document.getElementById("pdfInput"), drop = document.getElementById("drop");
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); handleFile(e.dataTransfer.files[0]); });
input.onchange = () => handleFile(input.files[0]);

async function handleFile(file) {
  if (!file || (file.type && file.type !== "application/pdf")) return;
  const st = document.getElementById("unlockState"), prog = document.getElementById("unlockProgress");
  const fill = document.getElementById("barFill"), ptxt = document.getElementById("progressText");
  st.className = "statebox"; st.textContent = "";
  prog.hidden = false; fill.style.width = "0%"; ptxt.textContent = `Reading ${file.name} …`;
  try {
    const pages = await C.readPdf(file, (i, n) => {
      fill.style.width = (i / n * 100).toFixed(1) + "%";
      ptxt.textContent = `${file.name} — page ${i} of ${n}`;
    });
    const meta = await C.install(pages, file.name);
    st.className = "statebox ok";
    st.innerHTML = meta.seitenOk
      ? `Opened: ${nf(meta.n)} pages, matching the printing these anchors were built against. Page citations
         will line up.`
      : `Opened: ${nf(meta.n)} pages — the anchors were built against a printing of ${nf(C.EXPECTED_PAGES)}.
         Search works; <strong>page citations will not be reliable</strong>.`;
  } catch (e) {
    st.className = "statebox warn";
    st.textContent = "Could not read this file: " + (e && e.message ? e.message : e);
  } finally { prog.hidden = true; refreshBadge(); }
}

document.getElementById("forgetBtn").onclick = async () => {
  await C.forget();
  const st = document.getElementById("unlockState");
  st.className = "statebox"; st.textContent = "Stored text cleared.";
  refreshBadge();
  if (location.hash.startsWith("#/concordance")) route();
};

function refreshBadge() {
  const open = C.isOpen();
  document.getElementById("unlockDot").classList.toggle("on", open);
  document.getElementById("unlockLabel").textContent = open ? "your copy is open" : "locked";
}

boot();
