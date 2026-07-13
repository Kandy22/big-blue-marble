// Source dispatcher: turns a Topic's SourceSpec[] into normalized RawItems.
// Each adapter is isolated; one failing source never sinks the whole run.
import type { Topic, RawItem } from "../types.js";
import { fetchRss } from "./rss.js";
import { fetchGithubReleases } from "./github.js";
import { fetchHfHub } from "./hfhub.js";
import { fetchX } from "./x.js";

export async function fetchTopicItems(topic: Topic): Promise<RawItem[]> {
  const jobs = topic.sources.map(async (spec) => {
    try {
      switch (spec.type) {
        case "rss":
          return await fetchRss(spec.url, topic.id);
        case "github":
          return await fetchGithubReleases(spec.repo, topic.id);
        case "hfhub":
          return await fetchHfHub(spec.kind, spec.limit ?? 15, topic.id);
        case "x":
          return await fetchX(spec.handle, topic.id);
      }
    } catch (err) {
      console.warn(`  ! source failed (${JSON.stringify(spec)}): ${(err as Error).message}`);
      return [];
    }
  });
  const results = await Promise.all(jobs);
  return results.flat();
}
