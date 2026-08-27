/* atlas.js — co-occurrence network across all indexed Elements. Reads
   data/atlas.json, which is registry-driven: when a further volume is added
   to tools/build-atlas.py and the file rebuilt, this view adapts — works,
   colors and link styles all come from the data. Derived data only. */
import { D, esc, nf } from "./app.js";

const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
let stopLoop = null;

export function viewAtlas() {
  if (stopLoop) { stopLoop(); stopLoop = null; }
  const A = D.atlas;
  const view = document.getElementById("view");
  if (!A || !A.nodes) {
    view.append(el(`<div><div class="viewhead"><h1>Atlas</h1>
      <p class="lede">No atlas data shipped in this build.</p></div></div>`));
    return;
  }
  const workOf = Object.fromEntries(A.works.map(w => [w.id, w]));
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Term network</span>
      <h1>Atlas</h1>
      <p class="lede">The ${A.nodes.length} leading content terms of the whole corpus —
      ${A.works.map(w => `<span style="color:${w.color}">${esc(w.label)}</span>`).join(" · ")} —
      linked where they occur in the same paragraph. Colour is the Element that uses the term most;
      size is frequency. Click a term for its neighbours and its places in both books. Built from
      derived counts only; when a further volume of the series is indexed, it joins this map.</p></div>
    <div class="toolbar">
      <label class="fine" for="adens">Density</label>
      <select id="adens">
        <option value="120">sparse</option>
        <option value="240" selected>medium</option>
        <option value="380">dense</option>
      </select>
      <span class="fine" id="ainfo"></span>
    </div>
    <div class="panel" style="padding:0;overflow:hidden"><canvas id="acv" style="width:100%;display:block;cursor:pointer"></canvas></div>
    <div id="asel"></div>
    <div class="panel" style="margin-top:1.2rem"><span class="tag">Bridge terms</span>
      <p class="readable" style="margin:.5rem 0 0;font-size:.92rem">The vocabulary the Elements share —
      where the consciousness question and the welfare question talk about the same things:
      ${A.bridges.map(b => `<button class="chip" data-ab="${esc(b)}">${esc(b)}</button>`).join(" ")}</p></div>
  </div>`));

  const cv = document.getElementById("acv");
  const selBox = document.getElementById("asel");
  const densSel = document.getElementById("adens");
  const Wd = Math.min(view.clientWidth || 900, 980), H = Math.max(440, Math.round(Wd * 0.6));
  const dpr = window.devicePixelRatio || 1;
  cv.width = Wd * dpr; cv.height = H * dpr; cv.style.height = H + "px";
  const cx = cv.getContext("2d"); cx.scale(dpr, dpr);

  const nodes = A.nodes.map(n => ({ ...n,
    x: Wd / 2 + (Math.random() - 0.5) * Wd * 0.8, y: H / 2 + (Math.random() - 0.5) * H * 0.8,
    vx: 0, vy: 0, r: 3 + Math.sqrt(n.f) * 0.85 }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  let edges = [], selected = null, tick = 0;

  function setDensity() {
    edges = A.edges.slice(0, +densSel.value).map(e => ({ ...e, a: byId[e.s], b: byId[e.t] }))
      .filter(e => e.a && e.b);
    document.getElementById("ainfo").textContent =
      `${nodes.length} terms · ${edges.length} links · from ${nf(A.n_units)} paragraphs across ${A.works.length} Elements`;
    tick = 0;
  }
  setDensity();
  densSel.onchange = setDensity;

  function step() {
    for (const n of nodes) { n.fx = 0; n.fy = 0; }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 40;
      const f = 1300 / d2, d = Math.sqrt(d2);
      dx /= d; dy /= d;
      a.fx += dx * f; a.fy += dy * f; b.fx -= dx * f; b.fy -= dy * f;
    }
    for (const e of edges) {
      let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const want = 58 + 650 / (e.w + 4);
      const f = (d - want) * 0.004 * Math.min(e.w, 6);
      dx /= d; dy /= d;
      e.a.fx += dx * f * d * 0.02; e.a.fy += dy * f * d * 0.02;
      e.b.fx -= dx * f * d * 0.02; e.b.fy -= dy * f * d * 0.02;
    }
    for (const n of nodes) {
      n.fx += (Wd / 2 - n.x) * 0.004; n.fy += (H / 2 - n.y) * 0.004;
      n.vx = (n.vx + n.fx) * 0.82; n.vy = (n.vy + n.fy) * 0.82;
      n.x = Math.max(14, Math.min(Wd - 14, n.x + n.vx));
      n.y = Math.max(14, Math.min(H - 14, n.y + n.vy));
    }
  }

  function draw() {
    cx.clearRect(0, 0, Wd, H);
    const neigh = new Set();
    if (selected) for (const e of edges) {
      if (e.a === selected) neigh.add(e.b);
      if (e.b === selected) neigh.add(e.a);
    }
    for (const e of edges) {
      const on = selected && (e.a === selected || e.b === selected);
      cx.strokeStyle = on ? "rgba(201,162,39,.6)" : "rgba(170,170,185,.13)";
      cx.lineWidth = on ? 1.4 : Math.min(1, 0.3 + e.w * 0.05);
      cx.beginPath(); cx.moveTo(e.a.x, e.a.y); cx.lineTo(e.b.x, e.b.y); cx.stroke();
    }
    for (const n of nodes) {
      const dimmed = selected && n !== selected && !neigh.has(n);
      cx.globalAlpha = dimmed ? 0.22 : 1;
      cx.fillStyle = (workOf[n.work] || {}).color || "#888";
      cx.beginPath(); cx.arc(n.x, n.y, n.r, 0, 7); cx.fill();
      if (n.both) { cx.strokeStyle = "rgba(255,255,255,.55)"; cx.lineWidth = 1; cx.stroke(); }
      if (n === selected) { cx.strokeStyle = "#fff"; cx.lineWidth = 1.6; cx.stroke(); }
      if (!dimmed && (n.f > 30 || n === selected || neigh.has(n))) {
        cx.fillStyle = "rgba(233,230,224,.92)";
        cx.font = (n === selected ? "600 " : "") + "11px system-ui, sans-serif";
        cx.textAlign = "center";
        cx.fillText(n.id, n.x, n.y - n.r - 4);
      }
      cx.globalAlpha = 1;
    }
  }

  let raf;
  (function loop() {
    if (tick < 240) { step(); tick++; }
    draw();
    raf = requestAnimationFrame(loop);
  })();
  stopLoop = () => cancelAnimationFrame(raf);
  window.addEventListener("hashchange", () => { if (stopLoop) { stopLoop(); stopLoop = null; } }, { once: true });

  function citeLinks(n) {
    return A.works.map(w => {
      const cs = n.cites.filter(c => c[0] === w.id);
      if (!cs.length) return "";
      const links = cs.map(c => {
        const [wid, sec, nn, p] = c;
        if (w.link === "welfare")
          return `<a class="cite" href="#/welfare/${sec}@${nn}">§${sec}, p. ${p}</a>`;
        return `<a class="cite" href="#/sections/${sec}" title="printed p. ${p}">§${sec}, p. ${p}</a>`;
      }).join(" ");
      const extra = w.link === "concordance"
        ? ` <a class="chip" href="#/concordance?q=${encodeURIComponent(n.id)}">in your copy →</a>` : "";
      return `<p class="fine" style="margin:.35rem 0 0"><span style="color:${w.color}">${esc(w.label)}</span>:
        ${links}${extra}</p>`;
    }).join("");
  }

  function select(n) {
    selected = n;
    selBox.innerHTML = "";
    if (!n) return;
    const co = edges.filter(e => e.a === n || e.b === n)
      .map(e => ({ o: e.a === n ? e.b : e.a, c: e.c })).sort((a, b) => b.c - a.c).slice(0, 14);
    const wk = Object.entries(n.works).sort((a, b) => b[1] - a[1]);
    selBox.append(el(`<div class="panel" style="margin-top:1.2rem">
      <div style="display:flex;gap:.8rem;align-items:baseline;flex-wrap:wrap">
        <h3 style="margin:0;color:${(workOf[n.work] || {}).color}">${esc(n.id)}</h3>
        <span class="fine">${nf(n.f)} paragraphs ·
          ${wk.map(([id, c]) => `${esc((workOf[id] || {}).label || id)}: ${c}`).join(" · ")}</span></div>
      <p style="margin:.5rem 0 0">${co.map(x =>
        `<button class="chip" data-ab="${esc(x.o.id)}">${esc(x.o.id)} <b>${x.c}</b></button>`).join(" ")}</p>
      ${citeLinks(n)}
    </div>`));
    selBox.querySelectorAll("[data-ab]").forEach(b => b.onclick = () => select(byId[b.dataset.ab]));
  }

  cv.onclick = ev => {
    const r = cv.getBoundingClientRect();
    const x = (ev.clientX - r.left) * (Wd / r.width), y = (ev.clientY - r.top) * (H / r.height);
    let best = null, bd = 400;
    for (const n of nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd && d < (n.r + 10) ** 2) { best = n; bd = d; }
    }
    select(best);
  };
  view.querySelectorAll("[data-ab]").forEach(b => b.onclick = () => select(byId[b.dataset.ab]));
}
