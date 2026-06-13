import { create } from "zustand";
import type { AppPhase, EmbeddingProvider, GraphEdge, GraphNode } from "./types";
import { chunkText } from "./lib/chunk";
import { cosineSimilarity, embedTexts } from "./lib/embeddings";
import { clusterNodes, type Cluster } from "./lib/cluster";
import { getActiveEmbeddingConfig } from "./settings";
import sampleData from "./data/sampleData.json";

const TOP_MATCH_COUNT = 6;
const EDGE_SIMILARITY_THRESHOLD = 0.4;
const EDGES_PER_NODE = 2;
// Below this top cosine similarity, the query matches nothing real — keep the
// terrain calm instead of falsely "finding" six nodes and hard-zooming. Measured:
// genuine vague matches land ~0.33–0.62, unrelated noise ~0.08–0.20.
const MATCH_FLOOR = 0.26;

let idCounter = 0;
const uid = () => `node-${idCounter++}`;

// Monotonic search id so a slow, superseded search can't overwrite a newer one.
let searchGen = 0;
// Dedup concurrent full re-embeds for the same target provider.
let reembedInFlight: { provider: EmbeddingProvider; promise: Promise<void> } | null = null;

interface AppState {
  phase: AppPhase;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  /** Which embedding space the current vectors live in. */
  datasetProvider: EmbeddingProvider;
  query: string;
  selectedNodeId: string | null;
  isSearching: boolean;
  /** Long-running overlay (ingest / re-embed) is in progress. */
  isWorking: boolean;
  workingMessage: string;
  errorMessage: string | null;
  /** The in-browser model has finished downloading + warming up. */
  modelReady: boolean;

  /** Which topic island is currently expanded ("bloomed open"), if any. */
  expandedClusterId: number | null;

  loadSample: () => void;
  ingest: (raw: string, opts?: { fresh?: boolean }) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  clearTerrain: () => void;
  selectNode: (id: string | null) => void;
  expandCluster: (id: number | null) => void;
  /** Voice/text navigation: expand the island whose label best matches the name. */
  focusClusterByName: (name: string) => boolean;
  /** Step back out of any focus (node, cluster, or search) to the resting map. */
  zoomOut: () => void;
  findSimilarTo: (nodeId: string) => Promise<void>;
  setModelReady: (ready: boolean) => void;
  setError: (message: string | null) => void;
  dismissError: () => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeNode(
  id: string,
  text: string,
  embedding: Float32Array,
  x: number,
  y: number,
  topic?: string
): GraphNode {
  return {
    id,
    text,
    embedding,
    x,
    y,
    vx: 0,
    vy: 0,
    relevance: 0,
    displayRelevance: 0,
    igniteOrder: -1,
    cluster: 0,
    topic,
    breathPhase: Math.random() * Math.PI * 2,
  };
}

/** Cluster the nodes by meaning and stamp each node with its cluster id. */
function assignClusters(nodes: GraphNode[]): { nodes: GraphNode[]; clusters: Cluster[] } {
  const { assignments, clusters } = clusterNodes(
    nodes.map((n) => ({ text: n.text, embedding: n.embedding, topic: n.topic }))
  );
  return {
    nodes: nodes.map((n, i) => ({ ...n, cluster: assignments[i] ?? 0 })),
    clusters,
  };
}

/** A loose disc layout used for the initial set so the simulation starts spread out. */
function discPosition(i: number, count: number): { x: number; y: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const angle = (i / Math.max(1, count)) * Math.PI * 2 * 1.618; // golden-angle-ish spread
  const radius = Math.min(w, h) * 0.32 * Math.sqrt((i + 0.5) / count);
  return { x: w / 2 + Math.cos(angle) * radius, y: h / 2 + Math.sin(angle) * radius };
}

/** A spawn point near the center so newly added nodes drift outward into place. */
function spawnPosition(): { x: number; y: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const jitter = 60;
  return {
    x: w / 2 + (Math.random() - 0.5) * jitter,
    y: h / 2 + (Math.random() - 0.5) * jitter,
  };
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const similarities: { j: number; sim: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const sim = cosineSimilarity(nodes[i].embedding, nodes[j].embedding);
      if (sim >= EDGE_SIMILARITY_THRESHOLD) similarities.push({ j, sim });
    }
    similarities.sort((a, b) => b.sim - a.sim);
    for (const { j, sim } of similarities.slice(0, EDGES_PER_NODE)) {
      const key = [nodes[i].id, nodes[j].id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: nodes[i].id, target: nodes[j].id, strength: sim });
    }
  }

  return edges;
}

function applyRelevance(nodes: GraphNode[], queryEmbedding: Float32Array): GraphNode[] {
  const scored = nodes.map((node) => ({ node, sim: cosineSimilarity(node.embedding, queryEmbedding) }));
  const ordered = [...scored].sort((a, b) => b.sim - a.sim);

  // Nothing clears the bar → leave the terrain at rest (no ignite, no gravity).
  const maxSim = ordered[0]?.sim ?? 0;
  if (maxSim < MATCH_FLOOR) {
    return scored.map(({ node, sim }) => ({
      ...node,
      relevance: Math.max(0, Math.min(0.12, sim * 0.15)),
      igniteOrder: -1,
    }));
  }

  const top = ordered.slice(0, TOP_MATCH_COUNT);
  const minTop = top.length > 0 ? top[top.length - 1].sim : 1;
  const range = Math.max(maxSim - minTop, 0.05);
  const rankById = new Map(top.map((t, i) => [t.node.id, i]));

  return scored.map(({ node, sim }) => {
    if (rankById.has(node.id)) {
      // Map the top matches into a dramatic 0.55..1 band, brightest first.
      const normalized = clamp01((sim - minTop) / range);
      return { ...node, relevance: 0.55 + 0.45 * normalized, igniteOrder: rankById.get(node.id)! };
    }
    // Everything else recedes toward near-invisible.
    return { ...node, relevance: Math.max(0, Math.min(0.15, sim * 0.2)), igniteOrder: -1 };
  });
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/**
 * Ensures the graph's vectors live in the currently-selected provider's space.
 * If the active provider differs from the dataset's, re-embeds every node's text.
 * Returns the config the caller should use for any further embedding this turn.
 */
async function ensureProviderConsistency(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void
): Promise<{ provider: EmbeddingProvider; apiKey: string }> {
  const cfg = getActiveEmbeddingConfig();
  const state = get();
  if (state.nodes.length === 0 || state.datasetProvider === cfg.provider) return cfg;

  // If a re-embed for this same target provider is already running, ride it
  // instead of launching a second full embed.
  if (reembedInFlight && reembedInFlight.provider === cfg.provider) {
    await reembedInFlight.promise;
    return cfg;
  }

  const run = (async () => {
    set({ isWorking: true, workingMessage: `Re-reading the terrain through ${cfg.provider === "gemini" ? "Gemini" : "the local model"}…` });
    try {
      const snapshot = get().nodes;
      const embeddings = await embedTexts(
        snapshot.map((n) => n.text),
        { provider: cfg.provider, apiKey: cfg.apiKey }
      );
      // Re-read in case nodes changed during the embed; remap by id to stay safe.
      const byId = new Map(snapshot.map((n, i) => [n.id, embeddings[i]]));
      const remapped = get().nodes.map((n) => (byId.has(n.id) ? { ...n, embedding: byId.get(n.id)! } : n));
      // New embedding space → re-cluster so the topic islands reflect it.
      const { nodes, clusters } = assignClusters(remapped);
      set({ nodes, edges: buildEdges(nodes), clusters, datasetProvider: cfg.provider });
    } finally {
      // Always clear the veil, even if embedding threw — otherwise the
      // full-screen overlay would trap the app with no way out.
      set({ isWorking: false });
    }
  })();

  reembedInFlight = { provider: cfg.provider, promise: run };
  try {
    await run;
  } finally {
    if (reembedInFlight?.promise === run) reembedInFlight = null;
  }
  return cfg;
}

export const useAppStore = create<AppState>((set, get) => ({
  phase: "terrain",
  nodes: [],
  edges: [],
  clusters: [],
  datasetProvider: "minilm",
  query: "",
  selectedNodeId: null,
  expandedClusterId: null,
  isSearching: false,
  isWorking: false,
  workingMessage: "",
  errorMessage: null,
  modelReady: false,

  loadSample: () => {
    const notes = sampleData.notes;
    const built = notes.map((n, i) => {
      const { x, y } = discPosition(i, notes.length);
      return makeNode(n.id, n.text, Float32Array.from(n.embedding), x, y, n.topic);
    });
    const { nodes, clusters } = assignClusters(built);
    set({
      nodes,
      edges: buildEdges(nodes),
      clusters,
      datasetProvider: "minilm",
      query: "",
      selectedNodeId: null,
      expandedClusterId: null,
    });
  },

  ingest: async (raw: string, opts) => {
    const chunks = chunkText(raw);
    if (chunks.length === 0) return;

    const fresh = opts?.fresh ?? false;
    set({
      isWorking: true,
      errorMessage: null,
      selectedNodeId: null,
      workingMessage: `Understanding ${chunks.length} new idea${chunks.length === 1 ? "" : "s"}…`,
    });

    try {
      // When replacing, just adopt the active provider. When appending, make the
      // existing nodes share the active provider's space first.
      const cfg = fresh ? getActiveEmbeddingConfig() : await ensureProviderConsistency(get, set);

      const embeddings = await embedTexts(chunks, {
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        onProgress: (done, total) => set({ workingMessage: `Finding connections… (${done}/${total})` }),
      });

      const existing = fresh ? [] : get().nodes;
      const newNodes = chunks.map((text, i) => {
        const { x, y } = spawnPosition();
        return makeNode(uid(), text, embeddings[i], x, y);
      });
      // Zero any leftover search brightening so adding content returns to a calm
      // resting terrain instead of keeping the previous query's hot cluster lit.
      const merged = [...existing, ...newNodes].map((n) => ({ ...n, relevance: 0, igniteOrder: -1 }));
      const { nodes, clusters } = assignClusters(merged);

      set({
        nodes,
        edges: buildEdges(nodes),
        clusters,
        datasetProvider: cfg.provider,
        isWorking: false,
        isSearching: false,
        query: "",
        selectedNodeId: null,
        expandedClusterId: null,
      });
    } catch (e) {
      set({ isWorking: false, errorMessage: errorText(e) });
    }
  },

  runSearch: async (query: string) => {
    const trimmed = query.trim();
    const gen = ++searchGen;
    // Searching is its own focus mode — drop any node/cluster focus.
    set({ query, isSearching: true, errorMessage: null, selectedNodeId: null, expandedClusterId: null });

    if (trimmed.length === 0) {
      get().clearSearch();
      return;
    }

    try {
      const cfg = await ensureProviderConsistency(get, set);
      const [queryEmbedding] = await embedTexts([trimmed], { provider: cfg.provider, apiKey: cfg.apiKey });
      // Drop this result if a newer search superseded us, the query was cleared
      // mid-flight (e.g. by findSimilarTo), or the node space changed under us
      // (the query vector must live in the same space as the node vectors).
      if (gen !== searchGen) return;
      if (get().query.trim().length === 0) {
        set({ isSearching: false });
        return;
      }
      if (get().datasetProvider !== cfg.provider) {
        set({ isSearching: false });
        return;
      }
      set({ nodes: applyRelevance(get().nodes, queryEmbedding), isSearching: false });
    } catch (e) {
      if (gen === searchGen) set({ isSearching: false, isWorking: false, errorMessage: errorText(e) });
    }
  },

  clearSearch: () => {
    set({
      query: "",
      isSearching: false,
      selectedNodeId: null,
      expandedClusterId: null,
      nodes: get().nodes.map((n) => ({ ...n, relevance: 0, igniteOrder: -1 })),
    });
  },

  clearTerrain: () => {
    set({ nodes: [], edges: [], clusters: [], query: "", selectedNodeId: null, expandedClusterId: null });
  },

  // Selecting a real node is its own focus mode — collapse any expanded cluster
  // so the two modes can't fight over the camera/physics. (selectNode(null) just
  // closes the panel and must NOT touch expansion, so empty-click step-back works.)
  selectNode: (id) => set(id ? { selectedNodeId: id, expandedClusterId: null } : { selectedNodeId: id }),

  expandCluster: (id) =>
    set((s) => ({
      expandedClusterId: id,
      selectedNodeId: null,
      query: "",
      // Expanding is its own mode; clear any active search ranking.
      nodes: s.nodes.map((n) => ({ ...n, relevance: 0, igniteOrder: -1 })),
    })),

  focusClusterByName: (name) => {
    const clusters = get().clusters;
    // Whole-word token overlap (split on the "·" separator and spaces), so "work"
    // never matches "workout" and a stray word in a long phrase can't hijack it.
    const tokenize = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const queryTokens = new Set(tokenize(name));
    if (queryTokens.size === 0) return false;

    let best: Cluster | null = null;
    let bestScore = 0;
    for (const c of clusters) {
      const overlap = tokenize(c.label).filter((t) => queryTokens.has(t)).length;
      if (overlap > bestScore || (overlap === bestScore && overlap > 0 && c.size > (best?.size ?? 0))) {
        best = c;
        bestScore = overlap;
      }
    }
    if (!best || bestScore === 0) return false;
    if (best.id === get().expandedClusterId) return true; // already there — don't re-jump
    get().expandCluster(best.id);
    return true;
  },

  zoomOut: () =>
    set((s) => ({
      expandedClusterId: null,
      selectedNodeId: null,
      query: "",
      nodes: s.nodes.map((n) => ({ ...n, relevance: 0, igniteOrder: -1 })),
    })),

  findSimilarTo: async (nodeId: string) => {
    const seed = get().nodes.find((n) => n.id === nodeId);
    if (!seed) return;
    // Show a readable seed query so the search bar reflects the active state and
    // can be edited or cleared (relevance still uses the seed's own embedding).
    const snippet = seed.text.split(/\s+/).slice(0, 6).join(" ");
    set({
      selectedNodeId: null,
      expandedClusterId: null,
      query: `similar to: ${snippet}…`,
      nodes: applyRelevance(get().nodes, seed.embedding),
    });
  },

  setModelReady: (ready) => set({ modelReady: ready }),
  setError: (message) => set({ errorMessage: message }),
  dismissError: () => set({ errorMessage: null }),
}));
