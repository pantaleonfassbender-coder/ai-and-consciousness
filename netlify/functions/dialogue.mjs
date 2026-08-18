/* Netlify Function — passage-bound answering over the reader's own copy.
   Netlify's AI Gateway injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL.
   Nothing is stored or logged. */

const MODEL = process.env.DIALOG_MODEL || "claude-sonnet-4-6";
const FALLBACK = ["claude-sonnet-4-5", "claude-3-7-sonnet-latest"];

const BASE = `You are a reading instrument for one short book: Eric Schwitzgebel, "AI and Consciousness: A Skeptical Overview" (Cambridge Elements in Philosophy and AI, 2026), an introductory treatment in eleven sections.

Binding rules:
1. Answer ONLY from the passages supplied. What is not in them, you do not assert — not even where you believe you know it. If the passages are thin, say so and name what is missing.
2. Attach a citation to every substantive claim, in the exact form given with each passage: [§7, p. 34]. Never invent a page or a section.
3. Quote at most a short phrase — roughly a dozen words — in quotation marks with a citation. Otherwise paraphrase. The text is under copyright and must not be reproduced at length.
4. Separate what Schwitzgebel argues from what he reports in order to reject. The Element surveys positions it does not hold, and a passage stating a view is not evidence that he holds it. Where the passages leave this unclear, say so rather than resolving it.
5. This is an introduction and says so. Do not present its formulations as the state of the field, and do not smooth over the places where it declines to decide — the declining is the argument.
6. Where a question runs past what the Element covers, say that plainly and stop. Do not fill the gap from memory; the reader has a live web search on this site for exactly that.
7. Scholarly English. Two to four paragraphs. No therapeutic or personal application, no speculation about particular AI products, no verdict on whether any system is conscious.`;

const MODES = {
  scholarly: "\n\nRegister: cautious and source-critical. Mark the limits of what the passages establish.",
  critical: "\n\nRegister: critical. Set out what the passages actually license as against what they are often taken to license, and name where the formulation is ambiguous.",
  developmental: "\n\nRegister: close reading. Stay with the wording of the passages — the distinctions drawn, the qualifiers used — rather than the position behind them.",
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Malformed JSON." }, 400); }

  const frage = String(body.frage || "").slice(0, 4000).trim();
  const modus = MODES[body.modus] ? body.modus : "scholarly";
  const passagen = Array.isArray(body.passagen) ? body.passagen.slice(0, 20) : [];
  const verlauf = Array.isArray(body.verlauf) ? body.verlauf.slice(-6) : [];

  if (frage.length < 5) return json({ error: "Send a formulated question." }, 400);
  if (!passagen.length) return json({ error: "No passages supplied." }, 400);

  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  if (!key) {
    return json({
      error: "No access to the Anthropic endpoint is configured. In Netlify, enable AI Gateway under " +
             "Project configuration → AI Gateway. Local retrieval and the concordance work regardless."
    }, 503);
  }

  const context = passagen.map((p, i) =>
    `[${i + 1}] ${p.zitat}${p.werk ? ` — ${p.werk}` : ""}\n${String(p.text || "").slice(0, 2600)}`
  ).join("\n\n---\n\n");

  const messages = [];
  for (const m of verlauf.slice(0, -1)) {
    if (!m || !m.text) continue;
    messages.push({ role: m.rolle === "user" ? "user" : "assistant", content: String(m.text).slice(0, 1600) });
  }
  messages.push({ role: "user", content: `PASSAGES\n\n${context}\n\n---\n\nQUESTION\n${frage}` });

  const payload = { model: MODEL, max_tokens: 1600, temperature: 0.2,
                    system: BASE + MODES[modus], messages };

  let last = "";
  for (const model of [MODEL, ...FALLBACK]) {
    payload.model = model;
    try {
      const r = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const d = await r.json();
        const antwort = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
        return json({ antwort: antwort || "(empty answer)", modell: model, passagen: passagen.length });
      }
      last = `${r.status} ${(await r.text()).slice(0, 300)}`;
      if (r.status !== 404 && r.status !== 400) break;
    } catch (e) { last = String(e && e.message ? e.message : e); break; }
  }
  return json({ error: "The answering endpoint reports: " + last }, 502);
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = { path: "/.netlify/functions/dialogue" };
