# Notes — Big Blue Marble: CourtWatch/Courts addition & status

_Last updated: 2026-07-22_

## What this app is
This folder (`big-blue-marble/`, renamed from `huggingnews-clone/` on 2026-07-22
to match the `github.com/Kandy22/big-blue-marble` repo) **is** "The Big Blue
Marble" blog — a from-scratch clone of the HuggingNews architecture
(ingest → cluster → generate → serve). The branding lives in `src/server.ts`
(🌎 header, `bbm-feed` embed widget, blue header band). See `README.md` for the
full architecture, run steps, and the front-page curation/ranking knobs.

## Change made: added a "Courts" topic (CourtWatch News)
- **Only edit:** appended a `courts` topic to `config/topics.json`.
- **Source:** CourtWatch News (Seamus Hughes' federal-court-filings newsletter),
  which runs on beehiiv and exposes a full-text RSS 2.0 feed:
  `https://rss.beehiiv.com/feeds/BTVqUNjsIO.xml`
- Uses the existing keyless `rss` adapter — no code changes, no API key.
- Tags: `indictment`, `search-warrant`, `docket`, `ruling`, `filing`.

### Extended (2026-07-22): Artificial Authority feed
- Added a second keyless RSS source to the `courts` topic: Damien Charlotin's
  "Artificial Authority" Substack (`https://artificialauthority.ai/feed`), which
  feeds his AI-hallucination-in-court database.
- Added tags: `ai-hallucination`, `ai-sanctions`, `ai-court-rules`,
  `ai-discovery-privilege`.
- Verified the feed returns HTTP 200 RSS 2.0 (20 items) and parses cleanly
  through `fetchRss` with real titles.

### Verified working (2026-07-18)
- Ran `npm run pipeline` → CourtWatch's 20 items ingested and turned into stories.
- Confirmed in-browser: each Courts story renders with a blue "Courts" chip, a
  SOURCES section, and an attribution link back to `rss.beehiiv.com` (the original).
  Example story: "Alien Terrorist Removal Court Has Its First Case".
- Nav note: the top nav rows are built from **tags**, not topic names, so "Courts"
  shows as the per-story topic label, not as a top-level tab. (This is how the
  app already worked for AI/Legal AI too.)

## Licensing / republishing posture
CourtWatch's about page has **no explicit license or republishing terms**. This app
does NOT republish verbatim — the `generate` step writes a new summary grounded in
the source and links back. That's transformative + attributed = the defensible model.
If you ever switch to showing their headlines/full text verbatim, that becomes a
permissions question — revisit then.

## Current state (2026-07-22)
- **No `.env` / no API key.** Story prose comes from the deterministic offline
  writer — now cleans markdown/HTML and collapses release-feed titles (see below),
  so bodies read as plain summaries, not raw dumps.
- `data/store.json` was **reset and regenerated clean** (~1,435 stories);
  `data/seen.json` dedups so the same item isn't re-generated.
- Front page is curated: most recent **3 days**, **45 stories/day**, ranked by
  source count. Full corpus stays in the store for re-weighting.

## To run it again
```bash
cd ~/kingsfield/big-blue-marble
npm run serve        # feed at http://localhost:4400
# to re-ingest fresh items first:
npm run pipeline
```

## 2026-07-22 overhaul (what changed today)
- **Renamed** folder `huggingnews-clone/` → `big-blue-marble/` (matches the repo);
  `.claude/launch.json` config + `package.json` name updated to `big-blue-marble`.
- **`src/sources/rss.ts`** — `strip()` now unwraps attributed `<title>` objects,
  fixing the `[object Object]` headlines (was The Verge et al.). *(committed earlier)*
- **`config/topics.json`** — added the `courts` topic (CourtWatch) and extended it
  with *Artificial Authority* + AI-in-court tags. *(committed earlier)*
- **`src/pipeline/generate.ts`** — offline writer rewritten: `cleanText()` strips
  markdown/HTML/URLs, `firstSentences()` trims to readable prose, `mockHeadline()`
  collapses GitHub build tags → "repo ships N new builds". Kills the raw-markdown
  article dumps.
- **`src/server.ts`** — front-page curation (`MAX_DAYS=3`, `MAX_PER_DAY=45`),
  per-day corroboration ranking, per-day topic breakdown in date headers,
  two-column TL;DR, tighter spacing, wider column. Palette: **blue header only**,
  all in-content accents recolored **rust** (`--rust`).

## Optional upgrade: real LLM-written stories (deferred — your call)
The offline bodies are readable but not editorial. For LLM write-ups:
1. Create `.env` with `ANTHROPIC_API_KEY=...` (and `HN_MODEL=claude-sonnet-4-6`).
   `.env` is gitignored. `dotenv/config` is imported in `run.ts`/`server.ts`.
   (The sandbox's Claude Pro session can't be used headlessly — nested `claude`
   CLI returns 401; a real API key is required.)
2. Only *fresh* (unseen) items regenerate. To re-render existing stories, clear
   `data/seen.json` (`[]`) — a full clear regenerates **all** topics (many
   sequential model calls). `saveStories` upserts by id, so LLM stories replace
   offline ones cleanly. Scope to one topic to limit calls/cost.

## Fixed (2026-07-22)
The old `[object Object]` headline bug is resolved in `src/sources/rss.ts`, and the
store was regenerated, so no corrupted headlines remain.
