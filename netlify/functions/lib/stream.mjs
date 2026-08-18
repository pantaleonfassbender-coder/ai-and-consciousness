/* Shared plumbing for the two answering endpoints.

   Both of them talk to a language model, and both can take longer than half a
   minute — the live search especially, since it really does go and fetch pages.
   Netlify's edge closes a connection that has sent no bytes for thirty seconds
   and substitutes an HTML "Inactivity Timeout" page, which is not JSON and
   cannot be parsed as JSON. So neither endpoint waits: each opens a stream at
   once, keeps it warm with heartbeats while the model works, and forwards the
   answer as it arrives. */

/** Newline-delimited JSON. One object per line, each with a `t` tag. */
export const NDJSON = "application/x-ndjson; charset=utf-8";

/** Heartbeat interval, comfortably inside the edge's thirty-second patience. */
const PING_MS = 5000;

/** A synchronous function is killed at sixty seconds. Stop well before that,
    under our own control, so the stream is always closed off properly and the
    reader keeps whatever had been written by then. */
const DEADLINE_MS = Number(process.env.ANSWER_DEADLINE_MS || 48000);

export function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Opens an NDJSON stream and hands `run` a writer that keeps it alive.
    Errors become an in-stream `error` event: by the time they happen the
    response has already begun, so there is no status code left to set. */
export function ndjson(run) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = o => { if (open) controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); };
      const ping = setInterval(() => send({ t: "ping" }), PING_MS);
      const ac = new AbortController();
      const deadline = Date.now() + DEADLINE_MS;
      /* Aborting the signal is not on its own enough — a body already being
         read does not reliably stop — so the read loop enforces the deadline
         too. This just stops a request that has not answered at all. */
      const cutoff = setTimeout(() => ac.abort(), DEADLINE_MS);
      try {
        send({ t: "open" });
        await run({ send, signal: ac.signal, deadline });
      } catch (e) {
        send({ t: "error", error: message(e) });
      } finally {
        clearInterval(ping); clearTimeout(cutoff);
        open = false;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": NDJSON,
      "cache-control": "no-store",
      /* Ask every hop in front of us not to buffer the stream into a lump. */
      "x-accel-buffering": "no",
    },
  });
}

export const message = e =>
  e && e.name === "AbortError"
    ? "The answer took longer than this endpoint is allowed to wait."
    : String(e && e.message ? e.message : e);

/** Where the AI Gateway puts the Anthropic endpoint, and the key it injects. */
export function gateway() {
  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  return { key, base };
}

/** POST to /v1/messages with `stream: true`. Resolves once the upstream has
    accepted the request, so a rejected model can still be swapped for another
    before a single token has been written downstream. */
export async function open(base, key, payload, signal) {
  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.text()).slice(0, 300); } catch { /* nothing to add */ }
    const err = new Error(`${r.status} ${detail}`.trim());
    err.status = r.status;
    throw err;
  }
  return r;
}

/** Reads Anthropic's server-sent events and reports the pieces we care about:
    text as it is generated, the searches the model actually ran, and the pages
    those searches returned. Returns `{ truncated }` — true when the deadline
    arrived first, in which case everything reported up to then still stands. */
export async function consume(res, { onText, onSearch, onSource, deadline } = {}) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const blocks = new Map();
  let buf = "";

  for (;;) {
    const { value, done, expired, failed } = await next(reader, deadline);
    if (failed) throw failed;
    if (expired) {
      await reader.cancel().catch(() => { /* already gone */ });
      return { truncated: true };
    }
    if (done) break;
    buf += dec.decode(value, { stream: true });
    /* SSE frames are separated by a blank line; keep any partial tail. */
    const frames = buf.split(/\r?\n\r?\n/);
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let ev;
        try { ev = JSON.parse(raw); } catch { continue; }
        handle(ev, blocks, { onText, onSearch, onSource });
      }
    }
  }
  return { truncated: false };
}

/** One read, resolved either by the stream or by the deadline. */
function next(reader, deadline) {
  const read = reader.read();
  if (!deadline) return read;
  const left = deadline - Date.now();
  if (left <= 0) return Promise.resolve({ expired: true });
  return new Promise(resolve => {
    const t = setTimeout(() => resolve({ expired: true }), left);
    read.then(
      r => { clearTimeout(t); resolve(r); },
      e => { clearTimeout(t); resolve({ failed: e }); },
    );
  });
}

function handle(ev, blocks, { onText, onSearch, onSource }) {
  switch (ev.type) {
    case "content_block_start": {
      const b = ev.content_block || {};
      blocks.set(ev.index, { type: b.type, name: b.name, partial: "" });
      /* Server-side tool results arrive whole rather than token by token. */
      if (b.type === "web_search_tool_result" && Array.isArray(b.content) && onSource) {
        for (const it of b.content) if (it && it.url) onSource({ url: it.url, titel: it.title || it.url });
      }
      break;
    }
    case "content_block_delta": {
      const d = ev.delta || {};
      if (d.type === "text_delta" && d.text && onText) onText(d.text);
      else if (d.type === "input_json_delta") {
        const b = blocks.get(ev.index);
        if (b) b.partial += d.partial_json || "";
      }
      break;
    }
    case "content_block_stop": {
      const b = blocks.get(ev.index);
      if (b && b.type === "server_tool_use" && b.name === "web_search" && onSearch) {
        try {
          const q = JSON.parse(b.partial || "{}").query;
          if (q) onSearch(String(q));
        } catch { /* a query we cannot recover is not worth failing over */ }
      }
      blocks.delete(ev.index);
      break;
    }
    case "error":
      throw new Error((ev.error && ev.error.message) || "The model reported an error.");
  }
}
