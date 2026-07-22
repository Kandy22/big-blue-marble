# Notes — Big Blue Marble: CourtWatch/Courts addition & status

_Last updated: 2026-07-18_

## What this app is
This folder (`huggingnews-clone/`) **is** "The Big Blue Marble" blog — a from-scratch
clone of the HuggingNews architecture (ingest → cluster → generate → serve).
The "Big Blue Marble" branding lives in `src/server.ts` (🌎 header, `bbm-feed`
embed widget, neon-blue reskin). Folder name is just the original clone name.

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

## Current state
- **No `.env` / no API key.** Story prose is produced by the deterministic **mock
  writer** (short, templated bodies). The pipeline runs fully offline this way.
- `data/store.json` holds ~1371 accumulated stories; `data/seen.json` dedups so the
  same item isn't re-generated.
- Server is currently **stopped**.

## To run it again
```bash
cd huggingnews-clone
npm run serve        # feed at http://localhost:4400
# to re-ingest fresh items first:
npm run pipeline
```

## Optional upgrade: real LLM-written stories (deferred — your call)
The mock bodies are intentionally thin. For real, fuller write-ups:
1. Create `.env` with `ANTHROPIC_API_KEY=...` (and `HN_MODEL=claude-sonnet-4-6`).
   `.env` is gitignored. `dotenv/config` is imported in `run.ts`/`server.ts`.
2. Only *fresh* (unseen) items regenerate. To re-render existing stories with the
   real model you must clear `data/seen.json` (`[]`) — but note a full clear
   regenerates **all** topics (~150+ sequential model calls = slow + API cost).
   `saveStories` upserts by story id, so real stories replace mock ones cleanly.
   → If you only want Courts regenerated, scope it (e.g. temporarily point at a
   courts-only config) so you don't burn calls on AI/Legal AI.

## Known pre-existing bug (NOT from this change)
One AI story on the homepage renders its headline as `[object Object]` — a headline
field being stringified in the mock writer path. Unrelated to Courts. Fix separately
if desired.
