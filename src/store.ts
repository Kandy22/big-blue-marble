// Dead-simple JSON-file store. Swap the four functions below for Postgres/
// Supabase inserts and the rest of the pipeline is unchanged.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import type { Story } from "./types.js";

const STORE = join(DATA_DIR, "store.json");

interface DB {
  stories: Story[];
}

function read(): DB {
  if (!existsSync(STORE)) return { stories: [] };
  return JSON.parse(readFileSync(STORE, "utf8")) as DB;
}

function write(db: DB): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE, JSON.stringify(db, null, 2));
}

export function getStories(): Story[] {
  return read().stories.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getStory(id: string): Story | undefined {
  return read().stories.find((s) => s.id === id);
}

// Upsert by id so re-running the pipeline is idempotent.
export function saveStories(stories: Story[]): void {
  const db = read();
  const byId = new Map(db.stories.map((s) => [s.id, s]));
  for (const s of stories) byId.set(s.id, s);
  write({ stories: [...byId.values()] });
}

// Track which source-item ids we've already turned into stories, so the same
// news doesn't get re-generated every run.
const SEEN = join(DATA_DIR, "seen.json");
export function loadSeen(): Set<string> {
  if (!existsSync(SEEN)) return new Set();
  return new Set(JSON.parse(readFileSync(SEEN, "utf8")) as string[]);
}
export function saveSeen(seen: Set<string>): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SEEN, JSON.stringify([...seen], null, 2));
}
