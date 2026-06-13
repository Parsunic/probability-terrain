// Offline precompute: embeds the bundled demo notes with the SAME model the
// browser uses (Xenova/all-MiniLM-L6-v2, mean pooling, normalized) so the
// vectors are identical to runtime query embeddings. Output is committed as
// src/data/sampleData.json and loaded instantly on app boot — no model
// download wait, no spinner. Re-run after editing scripts/sampleNotes.mjs:
//
//   node scripts/embedSample.mjs
//
import { pipeline } from "@xenova/transformers";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sampleNotes } from "./sampleNotes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/sampleData.json");

console.log(`Loading model + embedding ${sampleNotes.length} notes...`);
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

const records = [];
for (let i = 0; i < sampleNotes.length; i++) {
  const { text, topic } = sampleNotes[i];
  const out = await extractor(text, { pooling: "mean", normalize: true });
  // Round to 6 decimals to keep the JSON small without harming cosine sims.
  const embedding = Array.from(out.data, (v) => Math.round(v * 1e6) / 1e6);
  records.push({ id: `sample-${i}`, text, topic, embedding });
  process.stdout.write(`\r  embedded ${i + 1}/${sampleNotes.length}`);
}
process.stdout.write("\n");

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ model: "Xenova/all-MiniLM-L6-v2", dim: records[0].embedding.length, notes: records }));
console.log(`Wrote ${OUT} (${records.length} notes, dim ${records[0].embedding.length})`);
