/* Netlify Function — onward research beyond the Element.
   Uses Anthropic's server-side web search through Netlify's AI Gateway. The
   point of this site is that the Element is a stepping stone: this endpoint
   goes looking for what has been written since and around it.
   Nothing is stored or logged. */

const MODEL = process.env.EXPLORE_MODEL || "claude-sonnet-4-6";
const MAX_SEARCHES = Number(process.env.EXPLORE_SEARCHES || 6);

const SYSTEM = `You help a reader move outward from one short book: Eric Schwitzgebel, "AI and Consciousness: A Skeptical Overview" (Cambridge Elements in Philosophy and AI, 2026). It is an introduction, and the reader wants to know what lies beyond it.

Method, and it is not optional:
1. You must actually search. Do not answer from memory. Every substantive claim about what exists, who argued what, or when something appeared must rest on a page you retrieved in this conversation.
2. Give real, complete URLs that you retrieved. Never construct a URL from a pattern, never guess a DOI, and never cite a paper you did not find. If a search returns nothing usable, say so — that is a result, not a failure.
3. Prefer, in this order: the Stanford Encyclopedia of Philosophy and other reference works for orientation; peer-reviewed articles and university-press books for substance; PhilPapers, arXiv and author preprints for what is too recent to be indexed; reputable venues for anything else. Name the venue and the year every time.
4. Say what is recent. The reader is coming from a 2026 introduction, so work from 2024 onward is the interesting part — and where the field has moved since, say so plainly.
5. Represent disagreement as disagreement. Schwitzgebel argues for a considered agnosticism about AI consciousness; there are stronger and weaker positions on both sides, and the reader is entitled to the range rather than a consensus that does not exist.
6. Distinguish clearly between what the Element itself says and what you found on the web. The reader has the Element; what they need from you is everything else.

Form: three to six short paragraphs, or a short annotated list where a list genuinely helps. For each source: author, year, venue, the URL you retrieved, and one sentence on why it is worth the reader's time. No filler, no encouragement, and no summary of what the reader already has in front of them.

If asked something the searches cannot settle, say what would settle it and where you would look.`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Malformed JSON." }, 400); }

  const frage = String(body.frage || "").slice(0, 1200).trim();
  const kontext = String(body.kontext || "").slice(0, 1200).trim();
  if (frage.length < 4) return json({ error: "Send a formulated question." }, 400);

  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  if (!key) {
    return json({
      error: "No access to the Anthropic endpoint is configured. In Netlify, enable AI Gateway under " +
             "Project configuration → AI Gateway. Everything else on this site works without it."
    }, 503);
  }

  const payload = {
    model: MODEL,
    max_tokens: 2200,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{
      role: "user",
      content: kontext
        ? `The reader is working through this part of the Element:\n\n${kontext}\n\nTheir question:\n${frage}`
        : frage,
    }],
  };

  try {
    const r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      return json({ error: `The endpoint reports: ${r.status} ${(await r.text()).slice(0, 400)}` }, 502);
    }
    const d = await r.json();
    const text = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
    /* The searches the model actually ran, so the reader can see what was asked. */
    const suchen = (d.content || [])
      .filter(c => c.type === "server_tool_use" && c.name === "web_search")
      .map(c => (c.input && c.input.query) || "").filter(Boolean);
    const quellen = [];
    for (const c of d.content || []) {
      if (c.type === "web_search_tool_result" && Array.isArray(c.content)) {
        for (const it of c.content) {
          if (it && it.url) quellen.push({ url: it.url, titel: it.title || it.url });
        }
      }
    }
    return json({ antwort: text || "(empty answer)", suchen, quellen: quellen.slice(0, 40) });
  } catch (e) {
    return json({ error: "The endpoint is not reachable: " + (e && e.message ? e.message : e) }, 502);
  }
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = { path: "/api/explore" };
