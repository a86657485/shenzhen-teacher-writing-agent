import { appConfig } from "./config";

const VECTOR_SIZE = 384;
let extractorPromise: Promise<any> | undefined;
let transformersFailed = false;

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text: string) {
  const normalized = text.toLowerCase();
  const latin = normalized.match(/[a-z0-9]+/g) ?? [];
  const compact = normalized.replace(/\s+/g, "");
  const grams: string[] = [...latin];

  for (let i = 0; i < compact.length; i += 1) {
    const char = compact[i];
    if (/[\u4e00-\u9fff]/.test(char)) grams.push(char);
    if (i + 2 <= compact.length) grams.push(compact.slice(i, i + 2));
    if (i + 3 <= compact.length) grams.push(compact.slice(i, i + 3));
  }

  return grams;
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function hashEmbedding(text: string) {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % VECTOR_SIZE;
    const sign = hash & 1 ? 1 : -1;
    vector[index] += sign;
  }
  return normalizeVector(vector);
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@xenova/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", appConfig.embeddingModel),
    );
  }
  return extractorPromise;
}

async function transformerEmbedding(text: string) {
  const extractor = await getExtractor();
  const output = await extractor(text.slice(0, 4000), { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedText(text: string) {
  if (appConfig.embeddingProvider === "hash" || transformersFailed) {
    return hashEmbedding(text);
  }

  try {
    return await transformerEmbedding(text);
  } catch (error) {
    transformersFailed = true;
    console.warn("Local transformer embedding failed; falling back to hash embeddings.", error);
    return hashEmbedding(text);
  }
}

export async function embedTexts(texts: string[]) {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
  }
  return embeddings;
}

export function cosineSimilarity(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator ? dot / denominator : 0;
}
