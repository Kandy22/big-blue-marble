// Embedding-free text similarity so clustering runs with zero API calls.
// TF-IDF vectors + cosine similarity. Good enough to group items that are
// clearly about the same event. Swap in real embeddings later if you want
// semantic (not lexical) matching — the clustering code only needs `sim()`.
import type { RawItem, Cluster } from "./types.js";

const STOP = new Set(
  "the a an and or but of to in on for with at by from is are was were be been being this that these those it its as into over after new".split(
    " ",
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

type Vec = Map<string, number>;

function tfidf(docs: string[][]): Vec[] {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = docs.length;
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);
    const vec: Vec = new Map();
    for (const [term, count] of tf) {
      const idf = Math.log((N + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      vec.set(term, count * idf);
    }
    return vec;
  });
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  for (const [term, wa] of a) {
    const wb = b.get(term);
    if (wb) dot += wa * wb;
  }
  const mag = (v: Vec) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  const denom = mag(a) * mag(b);
  return denom === 0 ? 0 : dot / denom;
}

// Greedy single-link clustering: an item joins the first existing cluster it's
// similar enough to, else it starts its own.
export function clusterItems(items: RawItem[], threshold = 0.18): Cluster[] {
  if (items.length === 0) return [];
  const vecs = tfidf(items.map((i) => tokenize(`${i.title} ${i.text}`)));
  const clusters: { idx: number[]; centroidIdx: number }[] = [];

  items.forEach((_item, i) => {
    let best = -1;
    let bestSim = threshold;
    clusters.forEach((c, ci) => {
      const sim = cosine(vecs[i], vecs[c.centroidIdx]);
      if (sim > bestSim) {
        bestSim = sim;
        best = ci;
      }
    });
    if (best === -1) clusters.push({ idx: [i], centroidIdx: i });
    else clusters[best].idx.push(i);
  });

  return clusters.map((c, n) => ({
    id: `c_${Date.now()}_${n}`,
    topicId: items[c.idx[0]].topicId,
    items: c.idx.map((i) => items[i]),
  }));
}
