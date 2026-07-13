// Shared shapes for the whole pipeline.

export type SourceSpec =
  | { type: "rss"; url: string }
  | { type: "github"; repo: string } // "owner/name"
  | { type: "hfhub"; kind: "models" | "datasets"; limit?: number }
  | { type: "x"; handle: string };

export interface Topic {
  id: string;
  label: string;
  sources: SourceSpec[];
  tags: string[];
}

// One normalized item pulled from any source. Every adapter emits these.
export interface RawItem {
  id: string; // stable dedupe key (usually the URL)
  topicId: string;
  source: string; // human label, e.g. "rss:huggingface.co"
  author: string;
  title: string;
  text: string;
  url: string;
  publishedAt: string; // ISO
}

// A group of RawItems judged to describe the same event.
export interface Cluster {
  id: string;
  topicId: string;
  items: RawItem[];
}

// The generated, reader-facing story.
export interface Story {
  id: string;
  topicId: string;
  headline: string;
  article: string;
  tags: string[];
  entities: string[];
  publishedAt: string; // ISO, when we generated it
  newsAt: string; // ISO, approximate time of the underlying news (latest source item)
  sources: { source: string; author: string; url: string; title: string }[];
}
