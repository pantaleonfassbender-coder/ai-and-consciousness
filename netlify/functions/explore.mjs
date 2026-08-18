/* Netlify Function — onward research beyond the Element.
   Uses Anthropic's server-side web search through Netlify's AI Gateway. The
   point of this site is that the Element is a stepping stone: this endpoint
   goes looking for what has been written since and around it.

   The answer is streamed. Searching the open web takes far longer than the
   thirty seconds of silence Netlify's edge tolerates, so the reply is opened
   immediately and written as it is produced.
   Nothing is stored or logged. */

import { json, ndjson, open, consume, gateway, message } from "./lib/stream.mjs";

const MODEL = process.env.EXPLORE_MODEL || "claude-sonnet-4-6";
/* Each search the model runs costs real seconds — it fetches and reads pages —
   and the whole reply has to land inside the function's sixty-second life.
   Three is what fits with an answer still written at the end of it. */
const MAX_SEARCHES = Number(process.env.EXPLORE_SEARCHES || 3);

const SYSTEM = `You help a reader move outward from one short book: Eric Schwitzgebel, "AI and Consciousness: A Skeptical Overview" (Cambridge Elements in Philosophy and AI, 2026). It is an introduction, and the reader wants to know what lies beyond it.

Method, and it is not optional:
1. You must actually search. Do not answer from memory. Every substantive claim about what exists, who argued what, or when something appeared must rest on a page you retrieved in this conversation.
2. Give real, complete URLs that you retrieved. Never construct a URL from a pattern, never guess a DOI, and never cite a paper you did not find. If a search returns nothing usable, say so — that is a result, not a failure.
3. Prefer, in this order: the Stanford Encyclopedia of Philosophy and other reference works for orientation; peer-reviewed articles and university-press books for substance; PhilPapers, arXiv and author preprints for what is too recent to be indexed; reputable venues for anything else. Name the venue and the year every time.
4. Say what is recent. The reader is coming from a 2026 introduction, so work from 2024 onward is the interesting part — and where the field has moved since, say so plainly.
5. Represent disagreement as disagreement. Schwitzgebel argues for a considered agnosticism about AI consciousness; there are stronger and weaker positions on both sides, and the reader is entitled to the range rather than a consensus that does not exist.
6. Distinguish clearly between what the Element itself says and what you found on the web. The reader has the Element; what they need from you is everything else.

Form: be compact, because there is a hard limit on how long you may take and an answer cut off mid-sentence is worth less to the reader than a short one that finishes. Three or four short paragraphs, or a short annotated list where a list genuinely helps. For each source: author, year, venue, the URL you retrieved, and one clause on why it is worth the reader's time. Six sources well chosen beat twelve listed. No filler, no encouragement, and no summary of what the reader already has in front of them.

If asked something the searches cannot settle, say what would settle it and where you would look.`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Malformed JSON." }, 400); }

  const frage = String(body.frage || "").slice(0, 1200).trim();
  const kontext = String(body.kontext || "").slice(0, 1200).trim();
  if (frage.length < 4) return json({ error: "Send a formulated question." }, 400);

  const { key, base } = gateway();
  if (!key) {
    return json({
      error: "No access to the Anthropic endpoint is configured. In Netlify, enable AI Gateway under " +
             "Project configuration → AI Gateway. Everything else on this site works without it."
    }, 503);
  }

  const payload = {
    model: MODEL,
    /* Sized so the writing finishes inside the deadline rather than being cut
       off by it: the searches themselves already take some twenty seconds. */
    max_tokens: 1100,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{
      role: "user",
      content: kontext
        ? `The reader is working through this part of the Element:\n\n${kontext}\n\nTheir question:\n${frage}`
        : frage,
    }],
  };

  return ndjson(async ({ send, signal, deadline }) => {
    /* The searches the model actually ran, so the reader can see what was asked. */
    const suchen = [], quellen = [], seen = new Set();
    let text = "";
    let res;
    try {
      res = await open(base, key, payload, signal);
    } catch (e) {
      send({ t: "error", error: `The endpoint reports: ${message(e)}` });
      return;
    }
    let truncated = false;
    try {
      ({ truncated } = await consume(res, {
        deadline,
        onText: t => { text += t; send({ t: "delta", text: t }); },
        onSearch: q => { suchen.push(q); send({ t: "search", query: q }); },
        onSource: s => {
          if (seen.has(s.url) || quellen.length >= 40) return;
          seen.add(s.url); quellen.push(s); send({ t: "source", ...s });
        },
      }));
    } catch (e) {
      /* Whatever arrived before the failure is still worth handing over. */
      send({ t: "error", error: message(e), teilweise: text });
      return;
    }
    send({
      t: "done", antwort: text.trim() || "(empty answer)", suchen, quellen,
      modell: MODEL, abgebrochen: truncated,
    });
  });
};

export const config = { path: "/api/explore" };
