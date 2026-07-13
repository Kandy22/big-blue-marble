import type { RawItem } from "../types.js";

// X/Twitter adapter — STUB. The real HuggingNews leans heavily on X, but the
// X API is paid ($100+/mo for meaningful access). Wire it up by setting
// X_BEARER_TOKEN and implementing the fetch below against the v2 endpoint:
//   GET https://api.twitter.com/2/tweets/search/recent?query=from:HANDLE
// Until then this returns [] so the pipeline runs on the keyless sources.
export async function fetchX(handle: string, topicId: string): Promise<RawItem[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];

  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", `from:${handle} -is:retweet`);
  url.searchParams.set("max_results", "20");
  url.searchParams.set("tweet.fields", "created_at,text");

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`X ${handle} -> ${res.status}`);
  const body = (await res.json()) as any;
  return (body.data ?? []).map((t: any) => ({
    id: `https://x.com/${handle}/status/${t.id}`,
    topicId,
    source: `x:${handle}`,
    author: handle,
    title: String(t.text ?? "").slice(0, 120),
    text: String(t.text ?? ""),
    url: `https://x.com/${handle}/status/${t.id}`,
    publishedAt: new Date(t.created_at ?? Date.now()).toISOString(),
  }));
}
