import type { RawItem } from "../types.js";

// GitHub releases feed. Keyless (public API, low rate limit — fine for an MVP).
export async function fetchGithubReleases(repo: string, topicId: string): Promise<RawItem[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=10`, {
    headers: { "user-agent": "huggingnews-clone/0.1", accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub ${repo} -> ${res.status}`);
  const releases = (await res.json()) as any[];
  return releases
    .filter((r) => !r.draft)
    .map((r) => ({
      id: String(r.html_url),
      topicId,
      source: `github:${repo}`,
      author: repo,
      title: `${repo} ${r.tag_name ?? r.name ?? "release"}`,
      text: String(r.body ?? "").replace(/\s+/g, " ").trim().slice(0, 1200),
      url: String(r.html_url),
      publishedAt: new Date(r.published_at ?? Date.now()).toISOString(),
    }));
}
