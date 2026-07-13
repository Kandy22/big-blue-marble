// Maps raw source domains / repos to clean, human entity names so the entities
// row reads like companies (OpenAI, Hugging Face) instead of hosts (openai.com).
// In offline/mock mode entities are derived from the source org; with a real
// LLM key, extracted entities are still run through normalizeEntity() to tidy
// any stray domains.
const ORG: Record<string, string> = {
  // RSS hosts
  "openai.com": "OpenAI",
  "deepmind.google": "Google DeepMind",
  "research.google": "Google Research",
  "huggingface.co": "Hugging Face",
  "microsoft.com": "Microsoft Research",
  "cohere.com": "Cohere",
  "stability.ai": "Stability AI",
  "bair.berkeley.edu": "Berkeley AI Research",
  "blogs.nvidia.com": "NVIDIA",
  "semianalysis.com": "SemiAnalysis",
  "theverge.com": "The Verge",
  "arstechnica.com": "Ars Technica",
  "venturebeat.com": "VentureBeat",
  "technologyreview.com": "MIT Tech Review",
  "wired.com": "WIRED",
  "theregister.com": "The Register",
  "spectrum.ieee.org": "IEEE Spectrum",
  "simonwillison.net": "Simon Willison",
  "jack-clark.net": "Import AI",
  "rss.arxiv.org": "arXiv",
  "lawnext.com": "LawNext",
  "abovethelaw.com": "Above the Law",
  // GitHub repos
  "huggingface/transformers": "Hugging Face",
  "vllm-project/vllm": "vLLM",
  "ggml-org/llama.cpp": "llama.cpp",
  "ollama/ollama": "Ollama",
  "langchain-ai/langchain": "LangChain",
  "pytorch/pytorch": "PyTorch",
  "microsoft/vscode": "VS Code",
};

// Turn a source label ("rss:openai.com", "github:pytorch/pytorch",
// "hfhub:models", "x:OpenAI") into a clean org/entity name.
export function sourceOrg(sourceLabel: string): string {
  const idx = sourceLabel.indexOf(":");
  const type = idx >= 0 ? sourceLabel.slice(0, idx) : "";
  const rest = idx >= 0 ? sourceLabel.slice(idx + 1) : sourceLabel;
  if (type === "hfhub") return "Hugging Face";
  if (type === "x") return rest; // X handle already reads as an entity
  return ORG[rest] ?? rest;
}

// Clean a free-form entity string (e.g. from LLM extraction): strip protocol,
// map known domains/repos, otherwise pass through untouched.
export function normalizeEntity(raw: string): string {
  const key = raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
  return ORG[key] ?? raw;
}
