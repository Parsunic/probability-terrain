import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import type { EmbeddingProvider } from "../types";

// Serve the model from our own origin (public/models) so the first search works
// with no Hugging Face round-trip — and keeps working with the wifi unplugged.
// Without this, Transformers.js probes /models/… on the dev server, gets the SPA
// index.html back, and chokes trying to parse it as JSON.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
// Self-host the ONNX runtime wasm too, so nothing is fetched from a CDN at runtime.
env.backends.onnx.wasm.wasmPaths = "/ort/";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Pre-warms the in-browser model so the first real call is fast. Resolves when ready. */
export function preloadEmbeddingModel(): Promise<FeatureExtractionPipeline> {
  return getExtractor();
}

interface EmbedOptions {
  provider?: EmbeddingProvider;
  apiKey?: string;
  onProgress?: (done: number, total: number) => void;
}

/** Normalizes a vector to unit length in place so a plain dot product gives cosine similarity. */
function normalizeInPlace(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

const GEMINI_MODEL = "models/text-embedding-004";
const GEMINI_BATCH = 100; // batchEmbedContents caps at 100 requests per call

/** Embeds via the Google Generative Language API. Vectors are normalized for cosine comparison. */
async function embedWithGemini(
  texts: string[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array[]> {
  if (!apiKey) throw new Error("Gemini selected but no API key is set.");
  const out: Float32Array[] = [];

  for (let start = 0; start < texts.length; start += GEMINI_BATCH) {
    const batch = texts.slice(start, start + GEMINI_BATCH);
    const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: GEMINI_MODEL,
          content: { parts: [{ text }] },
        })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini embeddings failed (${res.status}). ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as { embeddings?: { values: number[] }[] };
    if (!json.embeddings || json.embeddings.length !== batch.length) {
      throw new Error("Gemini returned an unexpected embeddings response.");
    }
    for (const e of json.embeddings) {
      out.push(normalizeInPlace(Float32Array.from(e.values)));
    }
    onProgress?.(Math.min(start + batch.length, texts.length), texts.length);
  }

  return out;
}

/** Embeds via the in-browser MiniLM model. Vectors are already unit-normalized. */
async function embedWithMiniLM(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array[]> {
  const extractor = await getExtractor();
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    const output = await extractor(texts[i], { pooling: "mean", normalize: true });
    results.push(Float32Array.from(output.data as Float32Array));
    onProgress?.(i + 1, texts.length);
  }
  return results;
}

/**
 * Embeds a batch of texts with the chosen provider, returning one unit vector per text.
 * Defaults to the offline MiniLM model so the app works with no key and no network.
 */
export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<Float32Array[]> {
  const { provider = "minilm", apiKey = "", onProgress } = opts;
  if (texts.length === 0) return [];
  if (provider === "gemini") return embedWithGemini(texts, apiKey, onProgress);
  return embedWithMiniLM(texts, onProgress);
}

/** Embeds a single text (e.g. a search query) with the chosen provider. */
export async function embedText(text: string, opts: EmbedOptions = {}): Promise<Float32Array> {
  const [vec] = await embedTexts([text], opts);
  return vec;
}

/** Cosine similarity between two equal-length, pre-normalized vectors. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // Never dot vectors from different embedding spaces (e.g. MiniLM 384-d vs
  // Gemini 768-d) — truncating to the shorter length yields meaningless scores.
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
