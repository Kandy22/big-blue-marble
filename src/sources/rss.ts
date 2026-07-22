import { XMLParser } from "fast-xml-parser";
import type { RawItem } from "../types.js";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#8216": "‘", "#8217": "’", "#8220": "“", "#8221": "”",
  "#8211": "–", "#8212": "—", "#8230": "…", "#39": "'", "#38": "&",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(#?\w+);/g, (m, name) => NAMED[name] ?? m);
}

function strip(html: unknown): string {
  // fast-xml-parser turns attributed nodes (e.g. <title type="text">…</title>)
  // into objects like { "#text": "…", "@_type": "text" }. Pull out the text so
  // we don't stringify the whole object into "[object Object]".
  if (html && typeof html === "object" && !Array.isArray(html)) {
    html = (html as Record<string, unknown>)["#text"] ?? "";
  }
  return decodeEntities(String(html ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

// Handles both RSS 2.0 (<item>) and Atom (<entry>).
export async function fetchRss(url: string, topicId: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { "user-agent": "huggingnews-clone/0.1" } });
  if (!res.ok) throw new Error(`RSS ${url} -> ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);

  const host = new URL(url).host.replace(/^www\./, "");
  const source = `rss:${host}`;
  const items: RawItem[] = [];

  const rssItems = asArray(doc?.rss?.channel?.item);
  for (const it of rssItems) {
    const link = String(it.link ?? "");
    if (!link) continue;
    items.push({
      id: link,
      topicId,
      source,
      author: String(it["dc:creator"] ?? it.author ?? host),
      title: strip(it.title),
      text: strip(it.description ?? it["content:encoded"]),
      url: link,
      publishedAt: new Date(it.pubDate ?? Date.now()).toISOString(),
    });
  }

  const atomEntries = asArray(doc?.feed?.entry);
  for (const e of atomEntries) {
    const linkNode = asArray(e.link).find((l: any) => l?.["@_rel"] !== "self") ?? e.link;
    const link = String(linkNode?.["@_href"] ?? e.id ?? "");
    if (!link) continue;
    items.push({
      id: link,
      topicId,
      source,
      author: String(e.author?.name ?? host),
      title: strip(e.title),
      text: strip(e.summary ?? e.content),
      url: link,
      publishedAt: new Date(e.updated ?? e.published ?? Date.now()).toISOString(),
    });
  }

  return items;
}
