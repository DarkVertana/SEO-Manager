// In-memory cosine-similarity search. Replaces FAISS (used in
// brightdata/seo-article-generator) for the small vector counts we deal with
// here (typically 50-300 chunks across 5-20 sources). For larger corpora,
// swap in a real vector store.

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function topK(query: number[], embeddings: number[][], k: number): { idx: number; score: number }[] {
  return embeddings
    .map((e, idx) => ({ idx, score: cosineSimilarity(query, e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
