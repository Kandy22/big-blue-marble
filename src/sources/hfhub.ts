import type { RawItem } from "../types.js";

// Trending models/datasets from the Hugging Face Hub API. Keyless.
export async function fetchHfHub(
  kind: "models" | "datasets",
  limit: number,
  topicId: string,
): Promise<RawItem[]> {
  const res = await fetch(
    `https://huggingface.co/api/${kind}?sort=lastModified&direction=-1&limit=${limit}`,
    { headers: { "user-agent": "huggingnews-clone/0.1" } },
  );
  if (!res.ok) throw new Error(`HF Hub ${kind} -> ${res.status}`);
  const rows = (await res.json()) as any[];
  return rows.map((r) => {
    const id = String(r.id ?? r.modelId ?? r._id);
    const url = `https://huggingface.co/${kind === "datasets" ? "datasets/" : ""}${id}`;
    return {
      id: url,
      topicId,
      source: `hfhub:${kind}`,
      author: String(id.split("/")[0] ?? "huggingface"),
      title: `${id} (${kind.slice(0, -1)})`,
      text: `New/updated ${kind.slice(0, -1)} on the Hub: ${id}. Tags: ${(r.tags ?? []).slice(0, 8).join(", ")}. Likes: ${r.likes ?? 0}, downloads: ${r.downloads ?? 0}.`,
      url,
      publishedAt: new Date(r.lastModified ?? Date.now()).toISOString(),
    };
  });
}
