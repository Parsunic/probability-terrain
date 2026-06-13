import { cosineSimilarity } from "./embeddings";

export interface Cluster {
  id: number;
  label: string;
  /** muted rest tint, kept clear of the hot amber so "found" still pops */
  color: [number, number, number];
  size: number;
}

export interface ClusterResult {
  /** cluster id per input item, in input order */
  assignments: number[];
  clusters: Cluster[];
}

// Muted jewel tones, deliberately avoiding the hot amber (245,197,122) so a
// node igniting during search reads as a distinct state, not just another hue.
// Ordered to alternate cool/warm so neighbouring islands on the ring contrast.
const PALETTE: [number, number, number][] = [
  [108, 152, 214], // azure
  [214, 132, 150], // rose
  [96, 196, 168], // teal
  [206, 142, 186], // pink
  [142, 152, 226], // periwinkle
  [168, 194, 128], // sage
  [170, 142, 214], // violet
  [120, 188, 198], // cyan
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "is", "are", "was",
  "were", "be", "been", "being", "this", "that", "these", "those", "it", "its", "as", "by", "at",
  "from", "about", "into", "than", "then", "so", "if", "not", "their", "they", "them", "we", "you",
  "i", "he", "she", "his", "her", "your", "our", "my", "me", "us", "what", "which", "who", "whom",
  "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "only", "own", "same", "too", "very", "can", "will", "just", "should", "now",
  "do", "does", "did", "doing", "have", "has", "had", "having", "would", "could", "may", "might",
  "must", "shall", "there", "here", "out", "up", "down", "off", "over", "under", "again", "once",
  "because", "while", "during", "before", "after", "above", "below", "between", "through", "until",
  "thing", "things", "way", "ways", "like", "get", "got", "make", "makes", "made", "much", "many",
  "one", "two", "even", "still", "never", "always", "often", "really", "actually", "something",
  "someone", "everything", "nothing", "anyone", "they're", "you're", "it's", "don't", "isn't",
  "into", "onto", "upon", "yet", "also", "every", "another", "around", "without", "within",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** How many topics to split into — grows slowly with note count. */
function chooseK(n: number): number {
  if (n <= 2) return 1;
  const k = Math.round(Math.sqrt(n / 1.6));
  return Math.max(2, Math.min(PALETTE.length, Math.min(n, k)));
}

interface ClusterItem {
  text: string;
  embedding: Float32Array;
  /** optional curated tag; when present it names the cluster instead of keywords */
  topic?: string;
}

/**
 * Spherical-ish k-means over unit-normalized embeddings (cosine == dot).
 * Deterministic: farthest-first seeding from item 0 so the same notes always
 * produce the same map across reloads (important for a rehearsed demo).
 */
export function clusterNodes(items: ClusterItem[]): ClusterResult {
  const n = items.length;
  if (n === 0) return { assignments: [], clusters: [] };

  // If the notes carry curated topic tags (the bundled demo set), group by tag
  // for clean, unique island names. User-pasted notes have no tags and fall
  // through to genuine k-means discovery below.
  const taggedCount = items.filter((it) => it.topic).length;
  if (taggedCount >= n * 0.8 && new Set(items.map((it) => it.topic)).size <= PALETTE.length) {
    return clusterByTopic(items);
  }

  const K = chooseK(n);
  const vecs = items.map((it) => it.embedding);
  const dim = vecs[0].length;

  if (K === 1) {
    return {
      assignments: new Array(n).fill(0),
      clusters: [makeCluster(0, items, new Array(n).fill(0), n)],
    };
  }

  // Farthest-first initialization.
  const seeds: number[] = [0];
  while (seeds.length < K) {
    let best = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < n; i++) {
      let nearest = Infinity;
      for (const s of seeds) {
        const d = 1 - cosineSimilarity(vecs[i], vecs[s]);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = i;
      }
    }
    // Stop once there is no genuinely distinct direction left to seed — otherwise
    // near-duplicate notes produce repeated seeds and permanently-empty clusters.
    if (best < 0 || seeds.includes(best) || bestDist < 1e-6) break;
    seeds.push(best);
  }

  let centroids = seeds.map((s) => Float32Array.from(vecs[s]));
  const assign = new Array(n).fill(0);

  for (let iter = 0; iter < 18; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(vecs[i], centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          bestC = c;
        }
      }
      if (assign[i] !== bestC) {
        assign[i] = bestC;
        changed = true;
      }
    }

    const sums = Array.from({ length: centroids.length }, () => new Float64Array(dim));
    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      counts[c]++;
      const v = vecs[i];
      const s = sums[c];
      for (let d = 0; d < dim; d++) s[d] += v[d];
    }
    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] === 0) continue; // keep the old centroid for an empty cluster
      const s = sums[c];
      let norm = 0;
      for (let d = 0; d < dim; d++) norm += s[d] * s[d];
      norm = Math.sqrt(norm) || 1;
      const cen = new Float32Array(dim);
      for (let d = 0; d < dim; d++) cen[d] = s[d] / norm;
      centroids[c] = cen;
    }

    if (!changed && iter > 0) break;
  }

  // Compact away any empty cluster and renumber to a contiguous 0..m-1 range,
  // remapping assignments AND cluster ids together so node.cluster, anchors,
  // colors and ring slots all stay in sync.
  const sizes = new Array(centroids.length).fill(0);
  for (const a of assign) sizes[a]++;
  const oldToNew = new Map<number, number>();
  for (let c = 0; c < centroids.length; c++) {
    if (sizes[c] > 0) oldToNew.set(c, oldToNew.size);
  }
  const assignments = assign.map((a) => oldToNew.get(a)!);

  const clusters: Cluster[] = [];
  for (let c = 0; c < centroids.length; c++) {
    if (sizes[c] === 0) continue;
    const id = oldToNew.get(c)!;
    clusters.push(makeCluster(id, items, assignments, sizes[c]));
  }

  return { assignments, clusters: dedupeLabels(clusters, items, assignments) };
}

/** Ensure no two islands share a label (k-means can split one topic in two). */
function dedupeLabels(clusters: Cluster[], items: ClusterItem[], assign: number[]): Cluster[] {
  const used = new Set<string>();
  return clusters.map((cl) => {
    if (!used.has(cl.label)) {
      used.add(cl.label);
      return cl;
    }
    // Differentiate with this cluster's most distinctive keyword, then a suffix.
    for (const kw of topKeywords(items, assign, cl.id, 3)) {
      const candidate = `${cl.label} · ${kw}`;
      if (!cl.label.includes(kw) && !used.has(candidate)) {
        used.add(candidate);
        return { ...cl, label: candidate };
      }
    }
    let candidate = cl.label;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${cl.label} ${suffix++}`;
    used.add(candidate);
    return { ...cl, label: candidate };
  });
}

/** One island per distinct topic tag, in first-appearance order. */
function clusterByTopic(items: ClusterItem[]): ClusterResult {
  const idByTopic = new Map<string, number>();
  const order: string[] = [];
  for (const it of items) {
    const tp = it.topic ?? "Notes";
    if (!idByTopic.has(tp)) {
      idByTopic.set(tp, order.length);
      order.push(tp);
    }
  }
  const assignments = items.map((it) => idByTopic.get(it.topic ?? "Notes")!);
  const clusters: Cluster[] = order.map((label, id) => ({
    id,
    label,
    color: PALETTE[id % PALETTE.length],
    size: assignments.filter((a) => a === id).length,
  }));
  return { assignments, clusters };
}

/** Build a cluster's display label — from curated topic tags if present, else keywords. */
function makeCluster(c: number, items: ClusterItem[], assign: number[], size: number): Cluster {
  const color = PALETTE[c % PALETTE.length];

  // Prefer curated topic tags: label by the cluster's dominant topic(s).
  const topicCounts = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    if (assign[i] !== c) continue;
    const topic = items[i].topic;
    if (topic) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }
  if (topicCounts.size > 0) {
    const ranked = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((s, [, n]) => s + n, 0);
    // If one topic clearly dominates, show just it; otherwise show the top two.
    const label =
      ranked[0][1] / total >= 0.6 || ranked.length === 1
        ? ranked[0][0]
        : ranked.slice(0, 2).map(([t]) => t).join(" · ");
    return { id: c, label, color, size };
  }

  const top = topKeywords(items, assign, c, 2);
  const label = top.length > 0 ? top.join(" · ") : `Cluster ${c + 1}`;
  return { id: c, label, color, size };
}

/** The terms most representative of (and distinctive to) a cluster, title-cased. */
function topKeywords(items: ClusterItem[], assign: number[], c: number, count: number): string[] {
  const clusterDocFreq = new Map<string, number>(); // notes IN the cluster containing the term
  const globalDocFreq = new Map<string, number>(); // notes overall containing the term
  const n = items.length;
  let clusterSize = 0;

  for (let i = 0; i < n; i++) {
    const unique = new Set(tokenize(items[i].text));
    for (const w of unique) globalDocFreq.set(w, (globalDocFreq.get(w) ?? 0) + 1);
    if (assign[i] !== c) continue;
    clusterSize++;
    for (const w of unique) clusterDocFreq.set(w, (clusterDocFreq.get(w) ?? 0) + 1);
  }

  const scored = [...clusterDocFreq.entries()]
    .map(([w, cdf]) => {
      const gdf = globalDocFreq.get(w) ?? 1;
      // Spread across the cluster's notes (cdf), weighted by global rarity (idf).
      return { w, cdf, score: cdf * Math.log((n + 1) / gdf) };
    })
    .sort((a, b) => b.score - a.score);

  // Prefer terms shared by at least two of the cluster's notes when possible.
  const recurring = scored.filter((s) => s.cdf >= 2);
  const pool = recurring.length >= count || (recurring.length >= 1 && clusterSize <= 2) ? recurring : scored;
  return pool.slice(0, count).map((s) => titleCase(s.w));
}
