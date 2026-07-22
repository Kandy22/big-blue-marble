# The Big Blue Marble

An AI-curated, day-grouped AI-news feed. A from-scratch rebuild of the
[HuggingNews](https://huggingnews.com/about) architecture (which is closed-source —
this reimplements the *system* they describe, not their code), reskinned as
**The Big Blue Marble**.

- **Repo:** `github.com/Kandy22/big-blue-marble` · **Local folder:** `~/kingsfield/big-blue-marble`
- **Serves at:** http://localhost:4400 (`npm run serve`)

```
ingest (sources) ──▶ cluster (same event) ──▶ generate (1 story/cluster) ──▶ serve (curated feed)
```

## Run it

```bash
npm install
cp .env.example .env      # optional — add ANTHROPIC_API_KEY for real writing
npm run pipeline          # ingest → cluster → generate → data/store.json
npm run serve             # feed at http://localhost:4400
```

With **no API key** the writer uses a deterministic offline pass: it strips
markdown/HTML out of source text, writes clean summaries, and collapses noisy
release feeds (e.g. GitHub build tags → *"llama.cpp ships 7 new builds"*). The
whole pipeline runs offline this way. Add `ANTHROPIC_API_KEY` to `.env` for
LLM-written headlines/articles grounded in the sources.

> **Note:** the environment's Claude Pro / Claude Code session cannot be used
> headlessly for generation — a nested `claude` CLI call returns `401` because
> the OAuth token isn't exposed to subprocesses. Real LLM writing needs an
> `ANTHROPIC_API_KEY`; without one, the offline writer above is what runs.

## Adding topics — the one knob

Everything topic-related lives in [`config/topics.json`](config/topics.json).
To add a topic, append one object — **no code changes**:

```jsonc
{
  "id": "biotech",
  "label": "Biotech",
  "sources": [
    { "type": "rss", "url": "https://www.fiercebiotech.com/rss/xml" },
    { "type": "github", "repo": "some/repo" }
  ],
  "tags": ["fda-approval", "trial-result", "funding", "m&a"]
}
```

- `sources` decides **what gets ingested** for the topic.
- `tags` is the controlled vocabulary the writer may assign (keeps topic pages filterable).

Then `npm run pipeline` again. The new topic gets its own tab automatically.

## About the source list (mirroring HuggingNews)

HuggingNews **does not publish its exact list of followed accounts.** Its
[about page](https://huggingnews.com/about) states only that it follows "X
accounts, labs, companies, projects, reporters, and researchers," and publishes
its **topic taxonomy**: Models, Research, Open Source, Chips, Infrastructure,
Agents, Funding, Policy, Security, Industry.

So the `ai` topic in `config/topics.json` reconstructs their scope: their exact
tag taxonomy + the real, validated feed universe that matches it —

- **Labs/companies:** OpenAI, Google DeepMind, Google Research, Hugging Face, Microsoft Research, Cohere, Stability, BAIR
- **Chips/infra:** NVIDIA, SemiAnalysis
- **Press/reporters:** The Verge, Ars Technica, VentureBeat, MIT Tech Review, Wired, The Register, IEEE Spectrum
- **Researchers/commentary:** Simon Willison, Import AI (Jack Clark)
- **Papers:** arXiv cs.AI / cs.CL / cs.LG
- **Open source:** transformers, vLLM, llama.cpp, ollama, langchain, pytorch, vscode + HF Hub trending
- **X accounts (staged):** OpenAI, AnthropicAI, claudeai, GoogleDeepMind, huggingface, AIatMeta, MistralAI, cohere, nvidia, sama, karpathy, ylecun, bcherny, cursor_ai, github, swyx

**X is HuggingNews's primary source**, but the X API is paid — those entries
no-op until you set `X_BEARER_TOKEN`. Every `rss`/`github`/`hfhub` source is
keyless and works now.

Beyond `ai`, the shipped config also includes a **`legal-ai`** topic and a
**`courts`** topic. `courts` sources CourtWatch News (federal filings, indictments,
dockets) and Damien Charlotin's *Artificial Authority* (AI-in-court sanctions and
hallucinations) — both keyless RSS. See [`config/topics.json`](config/topics.json).

## Syndication — add the feed to another website

The server exposes standard feeds and a drop-in widget so any site can show the stories:

| Endpoint | Format | Notes |
|----------|--------|-------|
| `/embed.js` | Widget | **Two-line drop-in insert** (renders itself). |
| `/rss.xml` | RSS 2.0 | Newest 50 stories. `application/rss+xml`. |
| `/feed.json` | JSON Feed 1.1 | Same data, for custom code. |
| `/demo` | HTML | Live example of the widget on a plain page. |

All honor the site filters: `/rss.xml?tag=research`, `/feed.json?entity=OpenAI`,
or `data-tag="research"` on the widget. Feed pages are auto-discoverable
(`<link rel="alternate">` in `<head>`).

**Deploy first.** `localhost` isn't reachable by your website — host the server
(Render/Railway/Fly/VPS) and set `PUBLIC_URL=https://news.yoursite.com` so links
are absolute. Keep it fresh by running `npm run pipeline` on a cron (every ~30
min); the server serves whatever's in `data/store.json`.

### The insert (recommended)

Paste these two lines wherever you want the feed. That's it:

```html
<div id="bbm-feed"></div>
<script src="https://news.yoursite.com/embed.js" data-limit="8" data-title="AI News"></script>
```

- `data-limit` — how many headlines (default 8)
- `data-tag` — filter to one topic, e.g. `data-tag="research"`
- `data-title` — heading text (default "AI News")

The widget injects its own scoped CSS (won't clash with your site), links each
headline to the story, and adds "Full feed" / "RSS" links. See it live at `/demo`.

### Other ways to embed

- **RSS widget** — point a WordPress RSS block, Squarespace/Webflow RSS element,
  or RSS.app/Elfsight at `https://news.yoursite.com/rss.xml`.
- **Custom JS** — `fetch("https://news.yoursite.com/feed.json")` and render the
  `items` array yourself.
- **iframe** — drop the whole styled feed in: `<iframe src="https://news.yoursite.com/">`.
- **Static file** — no server on your host? `curl https://.../rss.xml > rss.xml`
  on a cron and serve it from any static host/CDN.

## Source adapters

| type     | keyless? | notes |
|----------|----------|-------|
| `rss`    | ✅        | RSS 2.0 + Atom. The workhorse. |
| `github` | ✅        | Repo releases via public API (low rate limit). |
| `hfhub`  | ✅        | Trending models/datasets from the HF Hub API. |
| `x`      | ❌        | Stub — needs a paid `X_BEARER_TOKEN`. Returns `[]` until wired. |

Add a new source type in [`src/sources/`](src/sources/) and one `case` in
[`src/sources/index.ts`](src/sources/index.ts).

## How the pieces map to the code

| Stage     | File | What it does |
|-----------|------|--------------|
| Ingest    | `src/sources/*` | Each adapter → normalized `RawItem[]`. One failing source never sinks the run. |
| Cluster   | `src/similarity.ts` | Embedding-free TF-IDF + cosine. Groups items about the same event. Swap in real embeddings for semantic matching — clustering only needs `sim()`. |
| Generate  | `src/pipeline/generate.ts` | One LLM call per cluster → headline/article/tags/entities. Offline fallback cleans markdown/HTML and collapses release-feed titles. |
| Store     | `src/store.ts` | JSON file, upsert by story id. Swap the 4 functions for Postgres/Supabase and nothing else changes. |
| Serve     | `src/server.ts` | Curated day-grouped feed + story detail pages. Server-rendered, zero frontend build. See *Front page* below. |

## Front page: curation & ranking

The feed presents like a curated front page rather than dumping every ingested
item — all in [`src/server.ts`](src/server.ts):

- **Recent window** — only the most recent `MAX_DAYS` (default **3**) day sections render, so the page stays light (~70 KB) even with thousands of stories in the store.
- **Per-day cap** — each day shows its top `MAX_PER_DAY` (default **45**) stories.
- **Ranking** — within a day, stories are ordered by corroboration: distinct **source count**, then breadth (**entities**), then recency. Multi-source stories float to the top; the top 3 get a rust accent bar.
- **Per-day topic breakdown** in each date header (e.g. `Models 12 · Open-Source 8 · …`).
- **TL;DR** — two-column digest of the biggest stories across the corpus.
- **Theme** — light/stone body with a blue "Big Blue Marble" header band; every in-content accent (NEW badge, active filters, accent bars, topic chips) is **rust** — blue is confined to the header. A light/dark toggle persists in `localStorage`.

## Tuning

- `MAX_DAYS` / `MAX_PER_DAY` in `src/server.ts` — how many recent day sections
  render, and how many stories per day. Raise for a denser feed, lower for a
  tighter test window. The store keeps **all** stories regardless, so you can
  re-weight against the full corpus without re-ingesting.
- The per-day ranking sort in `src/server.ts` (`ranked` in the `/` handler) —
  change the weighting (source count → entities → recency) to reprioritize what
  surfaces to the top of each day.
- `MIN_SOURCES` in `src/pipeline/run.ts` — set to `2` to require multi-source
  corroboration before a cluster becomes a story (HuggingNews-style).
- `threshold` in `clusterItems()` (`src/similarity.ts`) — higher = tighter clusters.
- Run `npm run pipeline` on a cron (every 15–30 min) for a live feed; `seen.json`
  prevents re-generating the same news.

## Not included (deliberately, for an MVP)

- Real embeddings (semantic clustering) — lexical is fine to start.
- Per-user personalization (HuggingNews personalizes via your HF profile).
- The X firehose (paid API).
- Auth, a real DB, image handling.
