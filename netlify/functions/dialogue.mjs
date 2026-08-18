/* Netlify Function — passage-bound answering over the reader's own copy.
   Netlify's AI Gateway injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL.

   The answer is streamed, so a long one cannot run into the thirty seconds of
   silence after which Netlify's edge abandons the connection.
   Nothing is stored or logged. */

import { json, ndjson, open, consume, gateway, message } from "./lib/stream.mjs";

const MODEL = process.env.DIALOG_MODEL || "claude-sonnet-4-6";
/* Both fallbacks must be models the AI Gateway actually serves; asking it for
   one it does not know is a 404 and burns a retry for nothing. */
const FALLBACK = ["claude-sonnet-4-5", "claude-haiku-4-5"];

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

  const { key, base } = gateway();
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

  return ndjson(async ({ send, signal, deadline }) => {
    /* Settle on a model before writing anything downstream: a rejected one can
       then still be swapped for the next without the reader seeing a false start. */
    let res = null, used = "", last = "";
    for (const model of [MODEL, ...FALLBACK]) {
      try {
        res = await open(base, key, { ...payload, model }, signal);
        used = model;
        break;
      } catch (e) {
        last = message(e);
        if (e.status !== 404 && e.status !== 400) break;
      }
    }
    if (!res) {
      send({ t: "error", error: "The answering endpoint reports: " + last });
      return;
    }

    send({ t: "modell", modell: used });
    let text = "", truncated = false;
    try {
      ({ truncated } = await consume(res, {
        deadline,
        onText: t => { text += t; send({ t: "delta", text: t }); },
      }));
    } catch (e) {
      send({ t: "error", error: message(e), teilweise: text });
      return;
    }
    send({
      t: "done", antwort: text.trim() || "(empty answer)",
      modell: used, passagen: passagen.length, abgebrochen: truncated,
    });
  });
};

/* A friendly path, as for /api/explore. Naming the default path here instead
   would leave the function unroutable — Netlify reserves the
   /.netlify/functions/ prefix and reports the route as both defined and
   uninvokable. */
export const config = { path: "/api/dialogue" };

