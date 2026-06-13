# Mindscape — Submission

## Elevator pitch

**Mindscape turns your notes into a living map of meaning — describe a feeling out loud, and the right ideas surface like stars through clearing fog.**

*Alternate taglines:*
- Your notes, shaped like your memory.
- Memory isn't a list. Neither is Mindscape.
- A new interface for thought: navigate ideas by meaning, not folders.

---

## About the project

### Inspiration

When you try to recall something, you don't scroll a list — you *jump*. One idea tugs you toward the next by resemblance. Human memory is **relational and spatial**, a web of associations. Yet for 20+ years every notes app — Notion, Docs, Apple Notes — has shipped the same interface: a list going down. We forced relational thinking into sequential boxes, and then wondered why finding a half-remembered idea feels like friction.

Mindscape started from one question: **what if notes felt like memory?** Instead of folders and keyword search, what if your notes arranged *themselves* by meaning, and you could find a thought the way you remember it — by describing the *feeling* of it, not its exact words?

### What it does

You paste or upload your notes. Mindscape chunks them, embeds each one, and renders them as a dark, breathing star-map where semantically similar notes drift together into color-coded **topic islands** — no tags, no folders. Then you speak (or type) something vague — *"that fear I'm not actually a writer, staring at the blank page"* — and the fog clears: the most relevant notes ignite warm-amber and gravitate to the center while everything else dims. Click a star to dive in and read it; "find similar" re-seeds the whole map from that note. Hover an island to see how much you've thought about a topic; say *"take me to dialogue"* to fly there. A fading trail marks where you've been — your train of thought.

### How I built it

The whole pipeline runs **client-side, in TypeScript** — no backend, no account, no server round-trip:

1. **Chunk** raw notes into paragraph-sized pieces.
2. **Embed** each chunk into a 384-dimensional vector using `all-MiniLM-L6-v2` (quantized) running *in the browser* via Transformers.js (ONNX Runtime + WebAssembly).
3. **Rank** by **cosine similarity** between the query vector and every note vector. Because the embeddings are L2-normalized, cosine reduces to a plain dot product:

$$\text{sim}(\mathbf{q},\mathbf{n}) = \cos\theta = \frac{\mathbf{q}\cdot\mathbf{n}}{\lVert\mathbf{q}\rVert\,\lVert\mathbf{n}\rVert} \;=\; \mathbf{q}\cdot\mathbf{n} \quad\text{when } \lVert\mathbf{q}\rVert=\lVert\mathbf{n}\rVert=1.$$

4. **Cluster** the vectors into topic islands with deterministic **spherical k-means** (farthest-first seeding for stability), minimizing the within-cluster objective

$$J = \sum_{k=1}^{K}\sum_{\mathbf{x}\in C_k}\bigl(1 - \mathbf{x}\cdot \boldsymbol{\mu}_k\bigr),$$

then label each island from its most distinctive keywords (a TF-style score, $\text{tf} \cdot \log\frac{N+1}{\text{df}}$).

5. **Render** everything on a hand-written **HTML Canvas** renderer driven by **d3-force** physics — charge, collision, links, and a custom layout force. On search, a "dynamic gravity" force pulls matches to the center and flings the rest outward; matches brighten in a staggered wave so it reads as *fog clearing*, not a bar chart.

State lives in Zustand; the UI chrome is Tailwind. Voice uses the Web Speech API with a text fallback. There's an optional **Google Gemini** embeddings mode (`text-embedding-004`) you can enable with your own key, which transparently re-embeds the whole map to keep the vector space consistent.

### What I learned

- **In-browser ML is genuinely viable.** A 23 MB quantized transformer embeds dozens of notes in well under a second on a laptop — fast enough to feel live.
- **Embeddings are a spatial substrate, not just a search trick.** Once notes are points in a 384-d space, *clustering*, *gravity*, *similarity edges*, and *navigation* all fall out of the same geometry.
- **"Feel" is engineering.** Smooth interpolation, gentle damping, a match-floor to avoid false positives, and easing curves are what separate "a graph" from "a place."

### Challenges I ran into

- **Making it work fully offline.** Transformers.js + a Vite SPA hits a classic trap: the model fetch resolves to `index.html` and chokes on JSON parsing. I fixed it by **self-hosting the model and the ONNX WebAssembly runtime** under `/public` and pinning the loader to the local origin — so search now runs with the wifi unplugged (verified: zero external requests).
- **Making 384 dimensions legible.** A cloud of identical dots means nothing. Clustering, color, spatial islands, and keyword labels turn "a universe of notes" into "a universe of *ideas*."
- **Avoiding the fake "found" moment.** Relevance is rank-relative, so *any* query lit something up. I added an absolute cosine floor (measured: real matches land ~0.33–0.62, noise ~0.08–0.20) so a nonsense query leaves the map calm.
- **State across focus modes.** Search, node-focus, cluster-expansion, and voice navigation all want the camera — keeping them mutually exclusive and smoothly eased took real care (and an adversarial self-review pass).

### What's next

Persistence and import (Obsidian/Markdown folders), per-note metadata and editing, and "memory resurfacing" — so Mindscape becomes a tool you live in, not just a beautiful demo.

---

## Built with

**Languages:** TypeScript, CSS, HTML

**Frameworks & libraries:** React, Vite, Tailwind CSS, Zustand, d3-force

**ML / embeddings:** Transformers.js (`@xenova/transformers`), `all-MiniLM-L6-v2` (MiniLM / Sentence-Transformers), ONNX Runtime Web (WebAssembly), Google Gemini API — `text-embedding-004` (optional)

**Rendering & interaction:** HTML Canvas 2D, Web Speech API (voice + voice navigation)

**Platform & tooling:** Vercel, GitHub, Git, Node.js, Google Fonts (Space Grotesk)

**Architecture:** 100% client-side — no backend, no database, no server.
