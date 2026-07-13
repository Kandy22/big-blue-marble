import "dotenv/config";
import { loadTopics } from "../config.js";
import { fetchTopicItems } from "../sources/index.js";
import { clusterItems } from "../similarity.js";
import { generateStory } from "./generate.js";
import { saveStories, loadSeen, saveSeen } from "../store.js";
import type { Story } from "../types.js";

// Full pipeline: ingest -> cluster -> generate -> store.
// A cluster becomes a story only if it has >= MIN_SOURCES corroborating items
// OR it's a single high-signal item we haven't seen before.
const MIN_SOURCES = 1; // raise to 2 to require multi-source corroboration

async function main() {
  const topics = loadTopics();
  const seen = loadSeen();
  const allStories: Story[] = [];

  for (const topic of topics) {
    console.log(`\n# ${topic.label} (${topic.id})`);
    const items = await fetchTopicItems(topic);
    console.log(`  ingested ${items.length} items`);

    // Only consider items we haven't already turned into stories.
    const fresh = items.filter((i) => !seen.has(i.id));
    console.log(`  ${fresh.length} fresh (unseen)`);

    const clusters = clusterItems(fresh).filter((c) => c.items.length >= MIN_SOURCES);
    console.log(`  ${clusters.length} clusters -> generating`);

    for (const cluster of clusters) {
      const story = await generateStory(cluster, topic);
      allStories.push(story);
      for (const it of cluster.items) seen.add(it.id);
    }
  }

  saveStories(allStories);
  saveSeen(seen);
  console.log(`\nDone. ${allStories.length} stories written. Run \`npm run serve\`.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
