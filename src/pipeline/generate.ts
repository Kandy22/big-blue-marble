import Anthropic from "@anthropic-ai/sdk";
import type { Cluster, Topic, Story } from "../types.js";
import { sourceOrg, normalizeEntity } from "../entities.js";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.HN_MODEL || "claude-sonnet-4-6";
const client = KEY ? new Anthropic({ apiKey: KEY }) : null;

// Approximate time of the news = the most recent source item in the cluster.
function newsAt(cluster: Cluster): string {
  const latest = cluster.items
    .map((i) => i.publishedAt)
    .sort()
    .at(-1);
  return latest ?? new Date().toISOString();
}

function storyId(cluster: Cluster): string {
  // Stable id from the sorted source urls -> re-runs upsert instead of dup.
  const basis = cluster.items.map((i) => i.id).sort().join("|");
  let h = 0;
  for (let i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) | 0;
  return `s_${(h >>> 0).toString(36)}`;
}

const SYSTEM = `You are a news writer for an AI-curated feed. Given a cluster of source posts all describing the same event, write ONE compact, objective, unbiased story grounded ONLY in the provided sources. Favor primary sources. Do not speculate or add facts not present. Respond as strict JSON:
{"headline": "self-contained, scannable, <=110 chars", "article": "2-4 short paragraphs, plain and neutral", "tags": ["from the allowed list only"], "entities": ["companies/people/products mentioned"]}`;

function buildPrompt(cluster: Cluster, topic: Topic): string {
  const sources = cluster.items
    .map((i, n) => `[${n + 1}] (${i.source}, ${i.author}) ${i.title}\n${i.text}\nURL: ${i.url}`)
    .join("\n\n");
  return `Topic: ${topic.label}
Allowed tags: ${topic.tags.join(", ")}

Sources:
${sources}`;
}

// Strip markdown/HTML/URLs down to plain prose so release notes and rich feeds
// don't dump raw "<details>…[link](url)…" soup into the article body.
function cleanText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/<[^>]+>/g, " ") // html tags incl <details>
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // md links/images -> label
    .replace(/https?:\/\/\S+/g, " ") // bare urls
    .replace(/[*_`>#|]+/g, " ") // md emphasis / quote / heading / table pipes
    .replace(/\s+/g, " ")
    .trim();
}

// Trim to the first whole sentence(s) under `max` chars.
function firstSentences(raw: unknown, max = 300): string {
  const s = cleanText(raw);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > 80 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

// A readable headline without an LLM. GitHub release feeds are a firehose of
// build tags ("ggml-org/llama.cpp b10082") — collapse those to plain English.
function mockHeadline(cluster: Cluster): string {
  const lead = cluster.items[0];
  const n = cluster.items.length;
  if (lead.source.startsWith("github:")) {
    const repo = lead.source.split("/").pop() || lead.source.replace(/^github:/, "");
    if (n > 1) return `${repo} ships ${n} new builds`;
    const tag = lead.title.trim().split(/\s+/).pop() || lead.title;
    return `${repo} releases ${tag}`;
  }
  return cleanText(lead.title).slice(0, 110);
}

// Deterministic offline fallback so the pipeline runs with no API key.
function mockStory(cluster: Cluster, topic: Topic): Story {
  const lead = cluster.items[0];
  const n = cluster.items.length;
  const orgs = [...new Set(cluster.items.map((i) => sourceOrg(i.source)))];
  const body = firstSentences(lead.text || lead.title);
  const article =
    (n > 1 ? `${n} sources report. ` : "") +
    body +
    (n > 1 ? `\n\nAlso covered by ${orgs.slice(0, 6).join(", ")}.` : "");
  const text = `${lead.title} ${lead.text}`.toLowerCase();
  return {
    id: storyId(cluster),
    topicId: topic.id,
    headline: mockHeadline(cluster),
    article,
    tags: topic.tags.filter((t) => text.includes(t.split("-")[0])).slice(0, 3),
    entities: orgs.slice(0, 5),
    publishedAt: new Date().toISOString(),
    newsAt: newsAt(cluster),
    sources: cluster.items.map((i) => ({ source: i.source, author: i.author, url: i.url, title: i.title })),
  };
}

export async function generateStory(cluster: Cluster, topic: Topic): Promise<Story> {
  if (!client) return mockStory(cluster, topic);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(cluster, topic) }],
    });
    const raw = res.content.find((c) => c.type === "text");
    const json = JSON.parse((raw as any).text.replace(/^```json\s*|\s*```$/g, ""));
    return {
      id: storyId(cluster),
      topicId: topic.id,
      headline: String(json.headline).slice(0, 140),
      article: String(json.article),
      tags: (json.tags ?? []).filter((t: string) => topic.tags.includes(t)),
      entities: (json.entities ?? []).map((e: string) => normalizeEntity(String(e))),
      publishedAt: new Date().toISOString(),
      newsAt: newsAt(cluster),
      sources: cluster.items.map((i) => ({ source: i.source, author: i.author, url: i.url, title: i.title })),
    };
  } catch (err) {
    console.warn(`  ! generation fell back to mock: ${(err as Error).message}`);
    return mockStory(cluster, topic);
  }
}
