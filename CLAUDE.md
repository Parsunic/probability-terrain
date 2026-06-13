# Probability Terrain

A single-page web app: a "living semantic landscape" for notes. User pastes notes, content is chunked + embedded, rendered as an interactive force-directed graph in 2D space. Vague spoken/typed descriptions cause semantically relevant nodes to brighten ("fog clearing") while irrelevant nodes dim — exploration by clicking bright clusters, not keyword search.

**Demo moment / definition of done**: User pastes 20-50 paragraphs, says something vague out loud, and the graph visually surfaces the right content — "I found something I couldn't have typed a search query for."

## Tech stack

- Vite + React + TypeScript
- Transformers.js (`all-MiniLM-L6-v2`, quantized) for in-browser embeddings — fully client-side, no backend
- Custom canvas renderer + `d3-force` for physics (not a prebuilt graph library — need full control over glow/breathing/fog-clearing visuals)
- Web Speech API for voice input, with text input fallback for unsupported browsers
- Zustand for state (nodes, embeddings, chunks, relevance scores)
- Tailwind CSS for minimal UI chrome

## User flow

1. **Onboarding** — minimal screen, paste/drop notes (raw text, multiple blocks, or .txt/.md upload). Loading state = purposeful "understanding" animation, not a spinner, while chunking + embedding runs.
2. **Terrain** — 2D force-directed graph fills screen. Each node = one chunk (paragraph/section). Semantically similar nodes drawn together by physics. At rest, everything dim and equal, with gentle breathing/scale-pulse.
3. **Search** — voice button (lower center, prominent) + text fallback. As user speaks, graph responds live: top 5-7 relevant nodes brighten to warm amber/white, irrelevant nodes dim near-invisible, faint constellation edges between related nodes. Should feel like fog clearing over terrain — smooth interpolation, gentle damping, nothing snaps/teleports.
4. **Node detail** — clicking a bright node slides in a right side panel with full chunk text, relevant phrases subtly highlighted, and a "find similar" button that re-runs search seeded from that node's content.

## Design direction (critical — this is the product)

- Background: very dark, near-black, faint warm/cool undertone (deep space feel, not pure black)
- Resting nodes: small, soft, low-opacity circles, all equal, gentle breathing animation
- Activated nodes: smooth transition to bright amber/warm white for top matches; others dim further. Dramatic but not harsh contrast.
- Edges: very faint constellation-style lines, never web-like or dominant
- Typography: clean sans-serif, generous line-height; side panel reads like a reading view
- All state changes smoothly interpolated, gentle damping on physics — drift, don't teleport
- UI chrome (buttons/inputs/controls): minimal, low-opacity, borderless, recedes behind the graph
- Hover on node = one-line content preview

## Performance targets

- Graph responds visibly within 1s of user starting to speak
- Full re-ranking of 50 nodes completes in under 2s

## Key design decisions / open questions

1. **Chunking granularity** — paragraph-level chunks vs sentence-group chunks; affects node count and embedding pipeline speed. MiniLM is small/fast but weights download on first load (~25MB, cached after).
2. **Live re-ranking during speech** — don't re-embed on every partial transcript (too costly/noisy). Debounce/throttle interim results (e.g. re-embed on pause or every N words), and interpolate visual targets (opacity/color/size) every frame independent of when new scores arrive.
3. **Similarity → visual mapping** — nonlinear mapping from cosine similarity to opacity/glow/color so top 5-7 nodes feel "found" without looking like a bar chart or abrupt UI state change. Decide whether matches also affect physics (similarity-weighted attraction reclustering) or are purely visual.

## Constraints

- No backend. If an embeddings API is ever used as an alternative to in-browser, key must be user-entered in settings, never hardcoded.
- Optimized for desktop; responsive is nice-to-have, not required.
