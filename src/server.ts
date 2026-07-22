import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { getStories, getStory } from "./store.js";
import { loadTopics, DATA_DIR } from "./config.js";
import type { Story } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT || 4400);
const topics = loadTopics();
const topicLabel = (id: string) => topics.find((t) => t.id === id)?.label ?? id;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const enc = encodeURIComponent;
const cap = (s: string) => s.replace(/(^|[-\s])\w/g, (m) => m.toUpperCase());
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayLabel = (key: string) =>
  new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 12 * 3600_000;

// Count occurrences of a story field across the corpus, most frequent first.
function tally(stories: Story[], pick: (s: Story) => string[]): [string, number][] {
  const c = new Map<string, number>();
  for (const s of stories) for (const v of pick(s)) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

const DARK = `
  --bg:#0b1220; --panel:#111a2b; --ink:#f2f6ff; --fg:#c7d3e6;
  --muted:#7d8aa3; --muted2:#a9b6cc; --line:#1e2a40; --subtle:#111a2b;
  --acc:#18c8ff; --acc2:#2b6bff; --glow:rgba(24,200,255,.6); --mark:#04131f; --amber:#38bdf8; --rust:#e0975a;`;

// Layout & type from huggingnews.com's computed styles (Source Sans 3, stone bg),
// re-skinned to a neon-blue "Big Blue Marble" palette.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap');
:root{
  --bg:#fafaf9; --panel:#fff; --ink:#0c1524; --fg:#1f2937;
  --muted:#71717a; --muted2:#52525b; --line:#e7e5e4; --subtle:#f4f6fb;
  --acc:#12c2ff; --acc2:#2b6bff; --glow:rgba(20,180,255,.5); --mark:#04131f; --amber:#0a7fd4; --rust:#b45309;
}
:root[data-theme="dark"]{${DARK}}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){${DARK}} }
*{box-sizing:border-box}
:root{--font:"Source Sans 3",-apple-system,"Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif}
html,body,button,input{font-family:var(--font)}
body{margin:0;background:var(--bg);color:var(--fg);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
/* Every story surface explicitly uses the accurate font */
.row h3,.rowmeta,h1.headline,.article,.src .st,.day h2{font-family:var(--font)}
.wrap{max-width:1000px;margin:0 auto;padding:0 18px 90px}

/* Full-width neon-blue header band covering brand + search + actions */
.hdrband{position:sticky;top:0;z-index:9;width:100%;
  background:linear-gradient(100deg,var(--acc),var(--acc2));
  box-shadow:0 2px 18px var(--glow),0 0 0 1px rgba(255,255,255,.06) inset}
.hdrinner{max-width:1000px;margin:0 auto;padding:11px 18px;display:flex;align-items:center;gap:12px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;color:#fff;letter-spacing:-.01em;text-shadow:0 1px 2px rgba(0,20,40,.25)}
.mark{background:radial-gradient(circle at 30% 28%,#3b82f6,#04131f 78%);border:1px solid rgba(255,255,255,.55);box-shadow:0 0 10px rgba(0,30,60,.35);font-size:15px;width:28px;height:28px;border-radius:8px;display:grid;place-items:center}
.search{flex:1;max-width:320px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:6px 12px;color:rgba(255,255,255,.9);font-size:14px}
.spacer{flex:1}
.hlink{color:#fff;font-size:13.6px;font-weight:600}
.toggle{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:8px;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;font-size:14px;color:#fff}
.signin{background:#fff;color:var(--acc2);font-weight:700;font-size:13.6px;padding:6px 15px;border-radius:9px}

/* Nav rows: topics, entities, trending (regular weight, 14px — matches original) */
.nav{border-bottom:1px solid var(--line);padding:6px 0 10px}
.nrow{display:flex;flex-wrap:wrap;gap:3px 16px;align-items:baseline;padding:6px 0}
.f{font-size:14px;font-weight:400;color:var(--ink);white-space:nowrap}
.f .n{font-size:12px;color:var(--muted);font-weight:400;margin-left:3px}
.f.on,.f.on .n{color:var(--rust);font-weight:600}
.more{font-size:13px;color:var(--muted);font-weight:400}
.trend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:9px 0 2px}
.tlabel{font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted2);display:flex;align-items:center;gap:5px}
.pill{font-size:14px;font-weight:400;color:var(--fg);border:1px solid var(--line);border-radius:999px;padding:4px 13px;display:inline-flex;gap:6px;align-items:center;background:var(--panel)}
.pill .n{color:var(--muted)}
.pill.on{border-color:var(--rust);color:var(--rust);background:color-mix(in srgb,var(--rust) 13%,transparent)}
.clearbar{padding:8px 0 0;font-size:14px;color:var(--muted2)}
.clearbar a{color:var(--rust);font-weight:600}

/* TL;DR */
.tldr{border-top:1px solid var(--ink);border-bottom:1px solid var(--line);padding:13px 2px;margin-top:10px}
.tldr-h{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.tldr .tt{font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--ink)}
.tldr .tsub{font-size:13px;color:var(--muted)}
.tldr ol{margin:0;padding-left:22px;columns:2;column-gap:44px}
.tldr li{padding:2px 0;font-size:15px;line-height:1.3;color:var(--fg);break-inside:avoid}
.tldr li::marker{color:var(--muted);font-weight:600}
.tldr li a:hover{color:var(--rust)}

/* Day header */
.day{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:26px 0 4px;padding-bottom:8px;border-bottom:2px solid var(--ink)}
.day h2{font-size:17px;font-weight:700;color:var(--ink);margin:0}
.day .count{font-size:14px;color:var(--muted)}
.day a{font-size:13px;font-weight:400;color:var(--muted2);white-space:nowrap}
.day a .n{font-size:11px;color:var(--muted);margin-left:2px}
.day a.on{color:var(--rust);font-weight:600}
.day .more{font-size:12px;color:var(--muted);margin-left:auto}

/* Story rows */
.row{display:flex;gap:14px;align-items:flex-start;padding:8px 6px;border-bottom:1px solid var(--line)}
.row:hover{background:var(--subtle)}
.row .num{color:var(--muted);font-size:14px;font-weight:600;min-width:20px;text-align:right;padding-top:2px}
.row .accent{width:3px;align-self:stretch;border-radius:2px;background:transparent}
.row.lead .accent{background:var(--rust)}
.row .body{flex:1;min-width:0}
.row h3{font-size:16px;font-weight:600;color:var(--ink);margin:0;line-height:1.32}
.row:hover h3{color:var(--rust)}
.badge{font-size:11px;font-weight:800;color:var(--rust);letter-spacing:.04em;margin-right:7px;vertical-align:1px}
.arrow{color:var(--muted);margin-right:5px;font-weight:700}
.rowmeta{display:flex;gap:14px;align-items:baseline;margin-top:2px;font-size:13px;color:var(--muted)}
.rowmeta .topic{color:var(--muted2);font-weight:600}
.right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right;white-space:nowrap;padding-top:2px}
.right .time{font-size:13px;font-weight:700;color:var(--ink)}
.right .cnt{font-size:12px;color:var(--muted)}

/* Story detail */
.back{color:var(--muted);font-size:14px;font-weight:600;display:inline-block;margin:22px 0 6px}
.detail-meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:var(--muted);margin-top:8px}
.chip{font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;background:var(--subtle);border:1px solid var(--line);color:var(--muted2)}
.chip.topic{background:var(--rust);color:#fff;border-color:var(--rust)}
h1.headline{font-size:26px;line-height:1.25;font-weight:700;color:var(--ink);margin:14px 0 0;letter-spacing:-.01em}
.article{font-size:17px;line-height:1.7;color:var(--fg);white-space:pre-wrap;margin:20px 0}
.src{border-top:2px solid var(--ink);padding-top:14px;margin-top:26px}
.src h4{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 4px}
.src a.item{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.src a.item:hover .st{color:var(--rust)}
.src .st{font-size:15px;font-weight:600;color:var(--ink)}
.src .ss{font-size:13px;color:var(--muted);white-space:nowrap}
.empty{color:var(--muted);padding:48px 0;text-align:center}
@media(max-width:640px){.tldr ol{columns:1}.day .more{margin-left:0}}
`;

const THEME_JS = `
(function(){
  var r=document.documentElement, k='hn-theme';
  var saved=localStorage.getItem(k); if(saved) r.setAttribute('data-theme',saved);
  window.__toggle=function(){
    var cur=r.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    var next=cur==='dark'?'light':'dark';
    r.setAttribute('data-theme',next); localStorage.setItem(k,next);
    document.getElementById('ti').textContent=next==='dark'?'\\u2600\\uFE0F':'\\u{1F319}';
  };
})();`;

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="alternate" type="application/rss+xml" title="The Big Blue Marble — AI News" href="/rss.xml"><link rel="alternate" type="application/json" title="The Big Blue Marble — JSON Feed" href="/feed.json"><style>${CSS}</style><script>${THEME_JS}</script></head><body>${headerBand()}<div class="wrap">${body}</div></body></html>`;
}

// Full-width neon-blue band; its inner content is width-constrained to match .wrap.
function headerBand(): string {
  return `<div class="hdrband"><div class="hdrinner">
    <a href="/" class="brand"><span class="mark">🌎</span>The Big Blue Marble</a>
    <div class="search">Search AI news…</div>
    <div class="spacer"></div>
    <span class="hlink">About</span>
    <button class="toggle" onclick="__toggle()" title="Toggle theme"><span id="ti">☀️</span></button>
    <span class="signin">Sign in</span>
  </div></div>`;
}

// The three HuggingNews-style filter rows: topics (tags), entities, trending.
function nav(all: Story[], active: { tag?: string; entity?: string }): string {
  const tagCounts = tally(all, (s) => s.tags);
  const entCounts = tally(all, (s) => s.entities);

  const topicRow = tagCounts.slice(0, 10).map(([t, n]) => {
    const on = active.tag === t;
    return `<a class="f ${on ? "on" : ""}" href="${on ? "/" : "/?tag=" + enc(t)}">${esc(cap(t))}<span class="n">${n}</span></a>`;
  });
  if (tagCounts.length > 10) topicRow.push(`<span class="more">+${tagCounts.length - 10} more</span>`);

  const entRow = entCounts.slice(0, 10).map(([e, n]) => {
    const on = active.entity === e;
    return `<a class="f ${on ? "on" : ""}" href="${on ? "/" : "/?entity=" + enc(e)}">${esc(e)}<span class="n">${n}</span></a>`;
  });
  if (entCounts.length > 10) entRow.push(`<span class="more">+${entCounts.length - 10} more</span>`);

  const trendRow = entCounts.slice(0, 6).map(([e, n]) => {
    const on = active.entity === e;
    return `<a class="pill ${on ? "on" : ""}" href="${on ? "/" : "/?entity=" + enc(e)}">${esc(e)}<span class="n">${n}</span></a>`;
  });

  const filterMsg =
    active.tag || active.entity
      ? `<div class="clearbar">Filtered by <b>${esc(cap(active.tag ?? active.entity ?? ""))}</b> · <a href="/">clear</a></div>`
      : "";

  return `<div class="nav">
    <div class="nrow topics">${topicRow.join("")}</div>
    <div class="nrow ent">${entRow.join("")}</div>
    <div class="trend"><span class="tlabel">↗ TRENDING</span>${trendRow.join("")}</div>
  </div>${filterMsg}`;
}

// "TL;DR" digest: the most-corroborated recent stories (most distinct source
// orgs first, then source count, then recency) — the day's biggest items.
function tldr(all: Story[]): string {
  const top = [...all]
    .sort(
      (a, b) =>
        b.entities.length - a.entities.length ||
        b.sources.length - a.sources.length ||
        b.newsAt.localeCompare(a.newsAt),
    )
    .slice(0, 7);
  if (top.length === 0) return "";
  return `<section class="tldr">
    <div class="tldr-h"><span class="tt">TL;DR</span><span class="tsub">past 24 hours</span></div>
    <ol>${top.map((s) => `<li><a href="/story/${s.id}">${esc(s.headline)}</a></li>`).join("")}</ol>
  </section>`;
}

function row(s: Story, n: number, lead: boolean): string {
  const fresh = isNew(s.newsAt);
  return `<a class="row ${lead ? "lead" : ""}" href="/story/${s.id}">
    <span class="accent"></span>
    <span class="num">${n}</span>
    <span class="body">
      <h3>${fresh ? '<span class="badge">NEW</span>' : ""}${s.sources.length > 1 ? '<span class="arrow">↗</span>' : ""}${esc(s.headline)}</h3>
      <span class="rowmeta"><span class="topic">${esc(cap(s.tags[0] ?? topicLabel(s.topicId)))}</span>${s.entities[0] ? `<span>${esc(s.entities[0])}</span>` : ""}</span>
    </span>
    <span class="right"><span class="time">${ago(s.newsAt)}</span><span class="cnt">${s.sources.length} src</span></span>
  </a>`;
}

// Per-day topic breakdown shown inline in the date header (like HuggingNews).
function dayTags(list: Story[], active?: string): string {
  const counts = tally(list, (s) => s.tags);
  const links = counts
    .slice(0, 8)
    .map(([t, n]) => `<a class="${active === t ? "on" : ""}" href="/?tag=${enc(t)}">${esc(cap(t))}<span class="n">${n}</span></a>`)
    .join("");
  const more = counts.length > 8 ? `<span class="more">+${counts.length - 8} more</span>` : "";
  return links + more;
}

// A busy day can produce hundreds of raw items; the front page shows the top
// slice per day (ranked below) so it reads like a curated front page, not a dump.
const MAX_PER_DAY = 45;

app.get("/", (req, res) => {
  const tag = req.query.tag ? String(req.query.tag) : undefined;
  const entity = req.query.entity ? String(req.query.entity) : undefined;
  const all = getStories();

  let stories = all;
  if (tag) stories = stories.filter((s) => s.tags.includes(tag));
  if (entity) stories = stories.filter((s) => s.entities.includes(entity));
  stories = [...stories].sort((a, b) => b.newsAt.localeCompare(a.newsAt));

  const head = nav(all, { tag, entity });
  if (stories.length === 0) {
    return res.send(page("Feed", head + `<p class="empty">No stories match. <a href="/">Clear filter</a> or run <code>npm run pipeline</code>.</p>`));
  }

  const byDay = new Map<string, Story[]>();
  for (const s of stories) {
    const k = dayKey(s.newsAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }

  // TL;DR only on the unfiltered front page, like the original.
  const intro = !tag && !entity ? tldr(all) : "";

  // Show only the most recent few days (like the ref site's "N stories across 3
  // days") so the front page stays light instead of rendering the whole archive.
  const MAX_DAYS = 3;
  const body = [...byDay.entries()]
    .slice(0, MAX_DAYS)
    .map(([day, dayAll]) => {
      // Rank the day by corroboration (distinct sources), then breadth, then recency,
      // and cap it so a firehose day reads like a curated front page, not a dump.
      const ranked = [...dayAll].sort(
        (a, b) =>
          b.sources.length - a.sources.length ||
          b.entities.length - a.entities.length ||
          b.newsAt.localeCompare(a.newsAt),
      );
      const list = ranked.slice(0, MAX_PER_DAY);
      const rows = list.map((s, i) => row(s, i + 1, i < 3)).join("");
      return `<div class="day"><h2>${esc(dayLabel(day))}</h2><span class="count">${list.length} stories</span>${dayTags(list, tag)}</div>${rows}`;
    })
    .join("");

  res.send(page("The Big Blue Marble — AI News", head + intro + body));
});

app.get("/story/:id", (req, res) => {
  const s = getStory(req.params.id);
  if (!s) return res.status(404).send(page("Not found", `<a class="back" href="/">← Feed</a><p class="empty">Story not found.</p>`));

  const body = `<a class="back" href="/">← Back to feed</a>
  <div class="detail-meta"><a class="chip topic" href="/?tag=${enc(s.tags[0] ?? "")}">${esc(cap(s.tags[0] ?? topicLabel(s.topicId)))}</a>
  ${s.tags.slice(1).map((t) => `<a class="chip" href="/?tag=${enc(t)}">${esc(cap(t))}</a>`).join("")}
  <span>${esc(new Date(s.newsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))} · ${s.sources.length} source${s.sources.length === 1 ? "" : "s"}</span></div>
  <h1 class="headline">${esc(s.headline)}</h1>
  <div class="article">${esc(s.article)}</div>
  ${s.entities.length ? `<div class="detail-meta">${s.entities.map((e) => `<a class="chip" href="/?entity=${enc(e)}">${esc(e)}</a>`).join("")}</div>` : ""}
  <div class="src"><h4>Sources</h4>${s.sources
    .map((src) => `<a class="item" href="${esc(src.url)}" target="_blank" rel="noopener"><span class="st">${esc(src.title || src.url)}</span><span class="ss">${esc(src.source)}</span></a>`)
    .join("")}</div>`;

  res.send(page(s.headline, body));
});

// ---- Syndication: RSS + JSON Feed --------------------------------------
// Absolute base URL for links. Set PUBLIC_URL in prod (e.g. https://news.you.com);
// otherwise derived from the request so it works on localhost out of the box.
function baseUrl(req: express.Request): string {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}
const xml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// Shared filter + newest-first, capped for a feed.
function feedStories(req: express.Request, limit = 50): { list: Story[]; tag?: string; entity?: string } {
  const tag = req.query.tag ? String(req.query.tag) : undefined;
  const entity = req.query.entity ? String(req.query.entity) : undefined;
  let list = getStories();
  if (tag) list = list.filter((s) => s.tags.includes(tag));
  if (entity) list = list.filter((s) => s.entities.includes(entity));
  list = [...list].sort((a, b) => b.newsAt.localeCompare(a.newsAt)).slice(0, limit);
  return { list, tag, entity };
}

// Public feeds are CORS-open so any site (e.g. the Kingsfield/SNS blog) can fetch them.
app.use(["/rss.xml", "/feed.json"], (_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/rss.xml", (req, res) => {
  const base = baseUrl(req);
  const { list, tag, entity } = feedStories(req);
  const title = "The Big Blue Marble — AI News" + (tag ? ` · ${cap(tag)}` : entity ? ` · ${entity}` : "");
  const self = `${base}/rss.xml${req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : ""}`;
  const items = list
    .map((s) => {
      const link = `${base}/story/${s.id}`;
      const cats = s.tags.map((t) => `<category>${xml(t)}</category>`).join("");
      const src = s.sources.map((x) => x.title).join(" · ");
      return `    <item>
      <title>${xml(s.headline)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      <pubDate>${new Date(s.newsAt).toUTCString()}</pubDate>
      ${cats}
      <description><![CDATA[${s.article}<p><em>Sources: ${src}</em></p>]]></description>
    </item>`;
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(title)}</title>
    <link>${base}/</link>
    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>
    <description>AI-curated, day-grouped AI news.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  res.type("application/rss+xml").send(body);
});

app.get("/feed.json", (req, res) => {
  const base = baseUrl(req);
  const { list, tag, entity } = feedStories(req);
  res.json({
    version: "https://jsonfeed.org/version/1.1",
    title: "The Big Blue Marble — AI News" + (tag ? ` · ${cap(tag)}` : entity ? ` · ${entity}` : ""),
    home_page_url: `${base}/`,
    feed_url: `${base}/feed.json`,
    items: list.map((s) => ({
      id: `${base}/story/${s.id}`,
      url: `${base}/story/${s.id}`,
      title: s.headline,
      content_text: s.article,
      date_published: new Date(s.newsAt).toISOString(),
      tags: s.tags,
      authors: s.entities.map((name) => ({ name })),
      external_url: s.sources[0]?.url,
    })),
  });
});

// ---- Drop-in widget: <script src=".../embed.js"></script> -------------------
// Renders the feed into a container on any external page. Self-contained (inlines
// its own scoped CSS), config via data-attributes: data-limit, data-tag, data-title.
app.get("/embed.js", (_req, res) => {
  const js = `(function(){
  var s=document.currentScript; if(!s) return;
  var origin=new URL(s.src).origin;
  var limit=parseInt(s.getAttribute('data-limit')||'8',10);
  var tag=s.getAttribute('data-tag');
  var title=s.getAttribute('data-title')||'AI News';
  var mount=document.getElementById('bbm-feed');
  if(!mount){mount=document.createElement('div');mount.id='bbm-feed';s.parentNode.insertBefore(mount,s);}
  if(!document.getElementById('bbm-css')){
    var st=document.createElement('style');st.id='bbm-css';
    st.textContent=".bbm{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;line-height:1.4;color:#18181b}"+
    ".bbm-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#2b6bff;margin:0 0 10px}"+
    ".bbm-h::before{content:'';width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#12c2ff,#2b6bff);box-shadow:0 0 8px rgba(20,180,255,.6)}"+
    ".bbm ol{list-style:none;margin:0;padding:0;border-top:1px solid #e7e5e4}"+
    ".bbm li{border-bottom:1px solid #e7e5e4}"+
    ".bbm a.i{display:flex;gap:10px;padding:9px 2px;text-decoration:none;color:inherit;align-items:baseline}"+
    ".bbm a.i:hover .t{color:#2b6bff}"+
    ".bbm .n{color:#a1a1aa;font-size:12px;font-weight:600;min-width:18px}"+
    ".bbm .t{font-size:15px;font-weight:600}"+
    ".bbm .m{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}"+
    ".bbm .f{margin-top:10px;font-size:11px;text-transform:uppercase;letter-spacing:.1em}"+
    ".bbm .f a{color:#71717a;text-decoration:none;margin-right:12px}.bbm .f a:hover{color:#2b6bff}";
    document.head.appendChild(st);
  }
  function ago(iso){var m=Math.round((Date.now()-new Date(iso))/6e4);if(m<60)return Math.max(m,1)+'m ago';var h=Math.round(m/60);return h<24?h+'h ago':Math.round(h/24)+'d ago';}
  var esc=function(x){var d=document.createElement('div');d.textContent=x==null?'':x;return d.innerHTML;};
  var qs=tag?('?tag='+encodeURIComponent(tag)):'';
  fetch(origin+'/feed.json'+qs).then(function(r){return r.json();}).then(function(f){
    var items=(f.items||[]).slice(0,limit);
    var rows=items.map(function(it,i){
      var meta=[it.tags&&it.tags[0],it.authors&&it.authors[0]&&it.authors[0].name,ago(it.date_published)].filter(Boolean).map(esc).join(' · ');
      return '<li><a class="i" href="'+esc(it.url)+'" target="_blank" rel="noopener">'+
        '<span class="n">'+(i+1)+'</span><span><span class="t">'+esc(it.title)+'</span>'+
        '<span class="m">'+meta+'</span></span></a></li>';
    }).join('');
    mount.className='bbm';
    mount.innerHTML='<p class="bbm-h">'+esc(title)+'</p><ol>'+rows+'</ol>'+
      '<p class="f"><a href="'+origin+'" target="_blank" rel="noopener">Full feed</a>'+
      '<a href="'+origin+'/rss.xml'+qs+'" target="_blank" rel="noopener">RSS</a></p>';
  }).catch(function(){mount.innerHTML='';});
})();`;
  res.type("application/javascript").set("Access-Control-Allow-Origin", "*").send(js);
});

// Live example of the widget embedded in a plain external-looking page.
app.get("/demo", (_req, res) => {
  res.sendFile(join(DATA_DIR, "..", "embed-example.html"));
});

app.listen(PORT, () => console.log(`Feed on http://localhost:${PORT}  (RSS: /rss.xml, JSON: /feed.json, widget: /embed.js)`));
