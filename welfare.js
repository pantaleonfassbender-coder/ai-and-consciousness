/* welfare.js — the second Element: Keeling & Street, Emerging Questions in
   AI Welfare (CC BY-NC 4.0, full text). Static views only; the Netlify
   functions are untouched. */
import { D, esc, nf, debounce } from "./app.js";

const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const W = () => D.welfare_text;

export function licenceBlock(compact = false) {
  const w = W();
  return `<div class="panel" style="border-left:3px solid #9db8a4">
    <span class="tag">Open access</span>
    <p class="readable" style="margin-top:.4rem">${esc(w.autoren)},
    <em>${esc(w.titel)}</em>, ${esc(w.reihe)} (${esc(w.verlag)}),
    <a href="https://doi.org/${esc(w.doi)}" target="_blank" rel="noopener">doi:${esc(w.doi)}</a>.
    The online edition is published under
    <a href="${esc(w.lizenz_url)}" target="_blank" rel="noopener">${esc(w.lizenz)}</a>, which permits
    non-commercial re-use with attribution and an indication of changes. This site is non-commercial.</p>
    ${compact ? "" : `<p class="fine">Changes made for this presentation: ${esc(w.aenderungen)}</p>`}
  </div>`;
}

export function viewWelfare(args) {
  if (args && args[0]) return viewWelfareSection(args[0]);
  const w = W();
  const stats = D.welfare_sections;
  const words = stats.reduce((a, s) => a + s.tokens, 0);
  view().append(el(`<div>
    <div class="viewhead"><span class="tag">The second Element</span>
      <h1>Emerging Questions in AI Welfare</h1>
      <p class="lede">Where Schwitzgebel asks whether machines could be conscious, Keeling and Street ask
      what would follow: could AI systems be <em>welfare subjects</em> — entities for which things can go
      better or worse? Their Element examines the arguments from behaviour, from consciousness, agency and
      relationships, and what a precautionary practical ethics would look like. Because its online edition
      is open access, this site can carry the full text — bring-your-own-book stays for the first Element,
      which is not.</p></div>

    <div class="grid g4" style="margin-bottom:1.6rem">
      <div class="kpi"><b>7</b><span>sections</span></div>
      <div class="kpi"><b>65</b><span>pages of argument</span></div>
      <div class="kpi"><b>${nf(words)}</b><span>running words</span></div>
      <div class="kpi"><b>${nf(D.welfare_biblio.length)}</b><span>works cited</span></div>
    </div>

    ${licenceBlock()}

    <div class="toolbar" style="margin:1.4rem 0 .4rem">
      <input type="search" id="wq" placeholder="Search the full text…" autocomplete="off">
    </div>
    <div id="wout"></div>

    <h2 style="margin-top:1.6rem">The seven sections</h2>
    <div id="wsecs"></div>

    <p class="fine" style="margin-top:1.4rem">
      <a href="#/welfare-refs">The Element's bibliography (${nf(D.welfare_biblio.length)} entries) →</a></p>
  </div>`));

  const box = document.getElementById("wsecs");
  stats.forEach(s => {
    const sec = w.sections.find(x => x.nr === s.nr);
    const subs = sec.units.filter(u => u.sub).map(u => u.sub.replace(/^\d[\.\d]*\s+/, ""));
    box.append(el(`<div class="termrow">
      <div class="th">
        <a class="tw" href="#/welfare/${s.nr}">§${s.nr} · ${esc(s.titel)}</a>
        <span class="fine">pp. ${s.seite_von}–${s.seite_bis} · ${nf(s.tokens)} words · ${s.paras} paragraphs</span>
      </div>
      ${subs.length ? `<p class="fine" style="margin:.35rem 0 0">${subs.map(esc).join(" · ")}</p>` : ""}
    </div>`));
  });

  const q = document.getElementById("wq"), out = document.getElementById("wout");
  const run = () => {
    const t = q.value.trim();
    out.innerHTML = "";
    if (t.length < 3) return;
    const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let hits = 0;
    for (const sec of w.sections) {
      for (const u of sec.units) {
        rx.lastIndex = 0;
        const m = rx.exec(u.txt);
        if (!m) continue;
        if (++hits > 60) break;
        const a = Math.max(0, m.index - 90), b = Math.min(u.txt.length, m.index + t.length + 130);
        out.append(el(`<div class="termrow">
          <a class="cite" href="#/welfare/${sec.nr}@${u.n}">§${sec.nr}, p. ${u.p}</a>
          <span style="font-size:.92rem">…${esc(u.txt.slice(a, b)).replace(rx, x => `<mark>${x}</mark>`)}…</span>
        </div>`));
      }
    }
    out.prepend(el(`<p class="fine">${hits}${hits > 60 ? "+ (first 60 shown)" : ""} passages.</p>`));
  };
  q.oninput = debounce(run, 160);
}

function viewWelfareSection(arg) {
  const [nrS, anchor] = String(arg).split("@");
  const w = W();
  const i = w.sections.findIndex(s => String(s.nr) === nrS);
  if (i < 0) { location.hash = "#/welfare"; return; }
  const s = w.sections[i];
  const prev = w.sections[(i - 1 + w.sections.length) % w.sections.length];
  const next = w.sections[(i + 1) % w.sections.length];
  const st = D.welfare_sections.find(x => x.nr === s.nr);
  view().append(el(`<div>
    <p class="fine"><a href="#/welfare">← Emerging Questions in AI Welfare</a> ·
      <a href="#/welfare/${prev.nr}">§${prev.nr}</a> · <a href="#/welfare/${next.nr}">§${next.nr}</a></p>
    <div class="viewhead"><span class="tag">§${s.nr}</span>
      <h1>${esc(s.titel)}</h1>
      <p class="lede">Printed pages ${st.seite_von} to ${st.seite_bis} · ${nf(st.tokens)} words.
      Cite by the printed page shown beside each paragraph.</p></div>
    <div id="wbody"></div>
    ${licenceBlock(true)}
  </div>`));
  const body = document.getElementById("wbody");
  body.innerHTML = s.units.map(u => `
    ${u.sub ? `<h2 class="wsub">${esc(u.sub)}</h2>` : ""}
    <div class="termrow" id="w${u.n}">
      <a class="cite" href="#/welfare/${s.nr}@${u.n}" title="Keeling & Street, p. ${u.p}">p. ${u.p}</a>
      <p class="readable" style="margin:.3rem 0 0">${esc(u.txt)}</p>
      ${(u.fn || []).map(f => `<p class="fine" style="color:#9db8a4">Footnote ${f.nr}: ${esc(f.txt)}</p>`).join("")}
    </div>`).join("");
  if (anchor) document.getElementById("w" + anchor)?.scrollIntoView();
}

export function viewWelfareRefs() {
  const b = D.welfare_biblio;
  view().append(el(`<div>
    <p class="fine"><a href="#/welfare">← Emerging Questions in AI Welfare</a></p>
    <div class="viewhead"><span class="tag">Bibliography</span>
      <h1>What Keeling &amp; Street cite</h1>
      <p class="lede">The ${nf(b.length)} entries of the Element's reference list, parsed from the
      open-access edition. Where the parse merges or splits an entry, the printed bibliography
      (pp. 66 ff.) governs.</p></div>
    <div class="toolbar"><input type="search" id="wbq" placeholder="Author, title or venue…" autocomplete="off"></div>
    <div id="wbl" class="biblist"></div><p class="fine" id="wbc"></p>
  </div>`));
  const q = document.getElementById("wbq"), list = document.getElementById("wbl"), cnt = document.getElementById("wbc");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const rows = b.filter(e => !t || e.toLowerCase().includes(t));
    list.innerHTML = rows.slice(0, 200).map(e => `<div class="bib"><span class="br">${esc(e)}</span></div>`).join("");
    cnt.textContent = `${rows.length} of ${b.length} entries${rows.length > 200 ? " · first 200 shown" : ""}`;
  };
  q.oninput = debounce(draw, 140); draw();
}

const view = () => document.getElementById("view");
