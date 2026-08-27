# AI and Consciousness — a stepping stone

A reader's apparatus for two Cambridge Elements on machine minds (both:
Elements in Philosophy and AI, ed. Herman Cappelen, 2026):

- Eric Schwitzgebel, *AI and Consciousness: A Skeptical Overview*
  (doi:10.1017/9781009694285) — **bring your own copy**;
- Geoff Keeling and Winnie Street, *Emerging Questions in AI Welfare*
  (doi:10.1017/9781009732000) — **carried in full**, because its online
  edition is open access under CC BY-NC 4.0.

Schwitzgebel's Element is seventy-one pages and deliberately introductory. This
site is built on that premise: it maps the argument, and then it is weighted
towards getting the reader **off** the Element and into the literature —
including into the second Element, which takes the step the first leaves open:
if consciousness cannot be ruled out, could AI systems be *welfare subjects*?

**No text of Schwitzgebel's Element is in this repository.** It is in
copyright. What ships under `data/` for it is derived — eleven sections with
page ranges and counts, page anchors, term distributions, log-likelihood
keyness per section, and the 216 works in its reference list.

**The full text of Keeling & Street is in this repository**
(`data/welfare_text.json`), under the terms of its CC BY-NC 4.0 online
edition: non-commercial, attributed, changes indicated. The changes: reflowed
from the PDF (layout, running heads and the per-download watermark removed,
hyphenation joined), footnotes attached to their paragraphs, editorial
paragraph numbers added, print-page anchors kept for citation; figures and
tables not reproduced. The site itself is and stays non-commercial.

## The Atlas

`#/atlas` draws a co-occurrence network over the **whole corpus** — currently
both Elements, automatically more when further volumes are indexed. It ships
derived data only (`data/atlas.json`: term pairs, counts, anchors), so it works
identically for the open-access text and the bring-your-own-book one: welfare
nodes link into the full text, Schwitzgebel nodes name section and printed page
and hand the term to the concordance. `tools/build-atlas.py` is registry-driven;
sources whose text may not ship (Schwitzgebel, and any future in-copyright
volume) are read from a local file next to the repository checkout
(`schwitzgebel-paras.json`, gitignored) and skipped with a warning if absent.

## What is weighted outward

- **Onward** — 27 entries in the Stanford Encyclopedia of Philosophy, mapped to
  the sections that send you there. Every slug was checked over HTTP and kept
  only if it answered; the titles are the ones the pages carry. That is how the
  *absence* of a dedicated entry for integrated information and for the global
  workspace was established rather than assumed.
- **Live search** — `netlify/functions/explore.mjs` uses Anthropic's
  server-side web search. It is instructed to search rather than recall, to give
  only URLs it retrieved, and to say when a search comes back empty. Every answer
  shows the queries that were run and the pages that were fetched, so the reader
  can check the ground instead of trusting the summary.
- **References** — the Element's own bibliography, filterable by year, since the
  fastest way out of an introduction is usually a work it already cites.

## Deployment

Netlify, straight from this repository; `netlify.toml` publishes the root and
picks up `netlify/functions/`. No build step, no dependencies.

Both functions need Anthropic credentials. On a logged-in, credit-based Netlify
account the **AI Gateway** injects `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL`
automatically — enable it under *Project configuration → AI Gateway*. Without it
everything else still works: sections, vocabulary, references, the reading map
and the concordance are entirely local.

## The watermark

A PDF downloaded from Cambridge Core carries a watermark on every page with the
DOI, a timestamp and **the IP address of whoever downloaded it**. The extraction
strips it, and the site strips it again when a reader opens their own copy.
Anyone passing such a file around should know it is in there.

## Limits

On the site's *Method* page: the corpus is small enough that single occurrences
move the numbers, the reference parser reads one fixed pattern, nothing
distinguishes Schwitzgebel's own claims from positions he reports in order to
reject, and the page anchors are tied to this printing.

Unaffiliated with Eric Schwitzgebel, Cambridge University Press, or the editors
of the Elements series.
