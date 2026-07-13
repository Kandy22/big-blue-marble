# HuggingNews clone

A from-scratch rebuild of the [HuggingNews](https://huggingnews.com/about) architecture:
an AI-curated, day-grouped news feed. HuggingNews itself is closed-source — this
reimplements the *system* they describe, not their code.

```
ingest (sources) ──▶ cluster (same event) ──▶ generate (1 story/cluster) ──▶ serve (feed)
```

## Run it

```bash
npm install
cp .env.example .env      # optional — add ANTHROPIC_API_KEY for real writing
npm run pipeline          # ingest → cluster → generate → data/store.json
npm run serve             # feed at http://localhost:4400
```

With **no API key** the writer uses a deterministic mock so the whole pipeline
still runs offline. Add `ANTHROPIC_API_KEY` to `.env` for real, objective story
generation grounded in the sources.

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
keyless and works now (29 distinct sources currently feed the pipeline).

## Syndication — add the feed to another website

The server exposes standard feeds so any site/reader can pull the stories:

| Endpoint | Format | Notes |
|----------|--------|-------|
| `/rss.xml` | RSS 2.0 | Newest 50 stories. `application/rss+xml`. |
| `/feed.json` | JSON Feed 1.1 | Same data, for custom JS embeds. |

Both honor the site filters: `/rss.xml?tag=research`, `/feed.json?entity=OpenAI`.
The feed pages are also auto-discoverable (`<link rel="alternate">` in `<head>`).

**Deploy first.** `localhost` isn't reachable by your website — host the server
(Render/Railway/Fly/VPS) and set `PUBLIC_URL=https://news.yoursite.com` so feed
links are absolute. Keep it fresh by running `npm run pipeline` on a cron
(every ~30 min); the server serves whatever's in `data/store.json`.

**Ways to embed on your site:**

1. **RSS widget** (easiest) — point a WordPress RSS block, Squarespace/Webflow
   RSS element, or RSS.app/Elfsight widget at `https://news.yoursite.com/rss.xml`.

2. **Custom JS** — fetch the JSON Feed and render it yourself:
   ```html
   <div id="ai-news"></div>
   <script>
   fetch("https://news.yoursite.com/feed.json")
     .then(r => r.json())
     .then(f => {
       document.getElementById("ai-news").innerHTML = f.items.slice(0, 10)
         .map(i => `<a href="${i.url}">${i.title}</a>`).join("<br>");
     });
   </script>
   ```

3. **iframe** — drop the whole feed in: `<iframe src="https://news.yoursite.com/" ...>`.

4. **Static file** — no server on your host? `curl https://.../rss.xml > rss.xml`
   on a cron and serve the file from any static host/CDN.

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
| Generate  | `src/pipeline/generate.ts` | One LLM call per cluster → headline/article/tags/entities. Mock fallback offline. |
| Store     | `src/store.ts` | JSON file. Swap the 4 functions for Postgres/Supabase and nothing else changes. |
| Serve     | `src/server.ts` | Day-grouped feed + story detail pages. Server-rendered, zero frontend build. |

## Tuning

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
