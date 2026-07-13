import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Topic } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const KNOWN_SOURCE_TYPES = new Set(["rss", "github", "hfhub", "x"]);

export function loadTopics(): Topic[] {
  const raw = readFileSync(join(ROOT, "config", "topics.json"), "utf8");
  const parsed = JSON.parse(raw) as { topics: Topic[] };
  // Drop readability markers like {"$group": "..."} — keep only real specs.
  return parsed.topics.map((t) => ({
    ...t,
    sources: t.sources.filter((s) => KNOWN_SOURCE_TYPES.has((s as { type?: string }).type ?? "")),
  }));
}

export const DATA_DIR = join(ROOT, "data");
