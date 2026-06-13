export interface GraphNode {
  id: string;
  text: string;
  embedding: Float32Array;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** target relevance 0-1, set by search ranking */
  relevance: number;
  /** smoothly interpolated relevance used for rendering */
  displayRelevance: number;
  /** rank among the hot matches (0 = strongest); -1 when not a top match. Drives the staggered "ignite" wave. */
  igniteOrder: number;
  /** id of the semantic cluster this node belongs to (index into the clusters array) */
  cluster: number;
  /** optional curated topic tag (sample notes only); used to name the cluster cleanly */
  topic?: string;
  /** random phase offset so breathing animations are not synchronized */
  breathPhase: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

export type AppPhase = "onboarding" | "loading" | "terrain";

/** Which embedding backend produced the vectors currently in the graph. */
export type EmbeddingProvider = "minilm" | "gemini";
