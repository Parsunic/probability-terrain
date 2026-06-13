# Probability Terrain

A living semantic landscape for your notes. Paste your thoughts, then describe — out loud or by typing — the half-remembered thing you're looking for. The terrain responds: the relevant ideas brighten and cluster like a constellation forming out of fog, while everything else recedes into the dark. You explore by feeling, not by keyword.

> The demo moment: *"I found something I couldn't have typed a search query for."*

## How it works

- **Boots straight into a living terrain.** ~30 founder's-journal notes are bundled with their embeddings **precomputed offline** (`src/data/sampleData.json`), so a breathing star map renders in well under a second — no spinner, no model-download wait.
- **A universe of ideas, not notes.** Notes are clustered into semantic **topic islands** — color-coded, labeled, and spatially separated, with denser regions glowing brighter. You read the structure of someone's thinking at a glance. Clustering is deterministic spherical k-means on the embeddings (`src/lib/cluster.ts`), fully client-side; the bundled set uses curated topic tags for clean island names, and pasted notes get genuine k-means + keyword labels.
- **Dynamic gravity.** On search, the matching notes fall toward the center while every unrelated island is flung outward and dims — the map physically reshapes around your intent. Queries that match nothing leave the terrain calm (an absolute-similarity floor avoids false "found" moments). Everything drifts perpetually so it never looks frozen.
- **In-browser embeddings.** Chunks and the search query are embedded with `all-MiniLM-L6-v2` via Transformers.js. The model **and** the ONNX runtime WASM are self-hosted under `public/`, so search runs **fully offline** — verified to make zero external network requests.
- **Optional Gemini.** Paste a Gemini API key in Settings to switch to `text-embedding-004`. Because the two embedding spaces aren't comparable, switching providers transparently re-embeds the whole terrain. The key lives only in `localStorage` and is never hardcoded.
- **Voice + text.** The Web Speech API drives voice search (it needs a connection — failures fall back clearly to the always-available text input).
- **Custom canvas renderer + d3-force.** A persistent force simulation with incremental reconcile (added notes drift in, nothing teleports), a camera that drifts toward the hot cluster, a staggered "ignite" wave, bloom, drifting dust, and a vignette for depth.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

- **`+`** (top-right) — add your own notes; append to the terrain or start fresh.
- **⚙** (top-right) — Gemini key, provider status, reset/clear the terrain.
- **Mic / text** (bottom center) — describe what you're looking for.

## Regenerating the sample terrain

Edit the paragraphs in `scripts/sampleNotes.mjs`, then recompute their embeddings (this downloads the model once, in Node):

```bash
node scripts/embedSample.mjs   # writes src/data/sampleData.json
```

## Stack

Vite · React + TypeScript · Zustand · Transformers.js (`@xenova/transformers`) · d3-force · Tailwind CSS. No backend.
