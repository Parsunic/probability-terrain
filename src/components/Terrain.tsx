import { useEffect, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
} from "d3-force";
import { useAppStore } from "../store";
import type { Cluster } from "../lib/cluster";

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** rendered position = physics position + living drift + cursor pull */
  rx: number;
  ry: number;
  text: string;
  breathPhase: number;
  displayRelevance: number;
  relevance: number;
  igniteOrder: number;
  cluster: number;
  /** order within the node's cluster (for the expansion ring) */
  clusterIndex: number;
  /** eased hover intensity 0..1 */
  hover: number;
  /** eased selection ("focused orb") intensity 0..1 */
  focus: number;
  /** performance.now() when the node entered the terrain (0 = present since first load) */
  bornAt: number;
}

type SimLink = SimulationLinkDatum<SimNode> & { strength: number };

const REST_RADIUS = 5;
const ACTIVE_RADIUS = 13;
const HOVER_RADIUS_PADDING = 7;
const IGNITE_STAGGER = 0.08;
const DRIFT_AMP = 2.6;
const CURSOR_RADIUS = 230;
const CURSOR_MAX_PULL = 14;
const ARRIVAL_MS = 950;
const SPARK_MS = 560;
const RIPPLE_MS = 1150;
const FOCUS_SCALE = 1.5; // zoom when focusing a node or expanding a cluster
const TRAIL_MAX = 10; // memory-trail length
const FALLBACK_COLOR: [number, number, number] = [138, 148, 170];
const HOT_COLOR = [245, 197, 122];

function computeAnchors(clusters: Cluster[], w: number, h: number): Map<number, { x: number; y: number }> {
  const map = new Map<number, { x: number; y: number }>();
  const cx = w / 2;
  const cy = h / 2;
  const k = clusters.length;
  const radius = Math.min(w, h) * 0.3;
  clusters.forEach((cl, i) => {
    if (k <= 1) {
      map.set(cl.id, { x: cx, y: cy });
      return;
    }
    const ang = (i / k) * Math.PI * 2 - Math.PI / 2;
    map.set(cl.id, { x: cx + Math.cos(ang) * radius, y: cy + Math.sin(ang) * radius });
  });
  return map;
}

function edgeSpawn(w: number, h: number): { x: number; y: number } {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.max(w, h) * 0.62;
  return { x: w / 2 + Math.cos(ang) * r, y: h / 2 + Math.sin(ang) * r };
}

interface HoverInfo {
  text: string;
  label: string;
  color: [number, number, number];
  x: number;
  y: number;
}

interface LabelRect {
  id: number;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

export function Terrain() {
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const clusters = useAppStore((s) => s.clusters);
  const selectNode = useAppStore((s) => s.selectNode);
  const expandCluster = useAppStore((s) => s.expandCluster);
  const zoomOut = useAppStore((s) => s.zoomOut);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const expandedClusterId = useAppStore((s) => s.expandedClusterId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const simNodesRef = useRef<SimNode[]>([]);
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const linkForceRef = useRef<ForceLink<SimNode, SimLink> | null>(null);
  const linksRef = useRef<SimLink[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const igniteStartRef = useRef<number>(0);
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());

  const clustersRef = useRef<Cluster[]>([]);
  const prevClustersRef = useRef<Cluster[]>([]);
  const anchorsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const searchStrengthRef = useRef<number>(0);
  const expandedIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const camRef = useRef({ cx: 0, cy: 0, scale: 1, ax: 0.5, ay: 0.5 });
  const originRef = useRef({ x: 0, y: 0, scale: 1 });

  const mouseScreenRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const hoveredClusterRef = useRef<number | null>(null);
  const labelRectsRef = useRef<LabelRect[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const dustRef = useRef<{ x: number; y: number; r: number; drift: number; phase: number }[]>([]);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
  }, [selectedNodeId]);
  useEffect(() => {
    expandedIdRef.current = expandedClusterId;
  }, [expandedClusterId]);

  // Create the simulation once. Forces read live refs so node/cluster swaps
  // during reconcile never require rebuilding the simulation.
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camRef.current = { cx: w / 2, cy: h / 2, scale: 1, ax: 0.5, ay: 0.5 };

    const linkForce = forceLink<SimNode, SimLink>([])
      .id((d) => d.id)
      .distance((l) => 90 - l.strength * 40)
      .strength((l) => l.strength * 0.12);
    linkForceRef.current = linkForce;

    // The shape force. Three regimes:
    //  - expanded cluster: its nodes fan out on a ring, others are flung away;
    //  - search: matches pulled to center, the rest pushed outward;
    //  - rest: every node pulled to its cluster anchor (topic islands).
    const layoutForce = (alpha: number) => {
      const sim = simNodesRef.current;
      const anchors = anchorsRef.current;
      const cls = clustersRef.current;
      const ss = searchStrengthRef.current;
      const expanded = expandedIdRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw / 2;
      const cy = vh / 2;
      const pushR = Math.min(vw, vh) * 0.4;

      for (const n of sim) {
        const anchor = anchors.get(n.cluster) ?? { x: cx, y: cy };
        let tx: number;
        let ty: number;
        let k: number;

        if (expanded !== null) {
          if (n.cluster === expanded) {
            const size = cls[expanded]?.size ?? 1;
            const ang = (n.clusterIndex / Math.max(1, size)) * Math.PI * 2 - Math.PI / 2;
            const er = 82 + size * 7;
            tx = anchor.x + Math.cos(ang) * er;
            ty = anchor.y + Math.sin(ang) * er;
            k = 0.07 * alpha;
          } else {
            const dx = anchor.x - cx;
            const dy = anchor.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            tx = cx + (dx / d) * Math.min(vw, vh) * 0.66;
            ty = cy + (dy / d) * Math.min(vw, vh) * 0.66;
            k = 0.05 * alpha;
          }
        } else if (ss > 0.001) {
          let sx: number;
          let sy: number;
          if (n.relevance >= 0.5) {
            sx = cx;
            sy = cy;
          } else {
            const dx = n.x - cx;
            const dy = n.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            sx = cx + (dx / d) * pushR;
            sy = cy + (dy / d) * pushR;
          }
          tx = anchor.x + (sx - anchor.x) * ss;
          ty = anchor.y + (sy - anchor.y) * ss;
          k = (n.relevance >= 0.5 ? 0.05 + 0.05 * ss : 0.05) * alpha;
        } else {
          tx = anchor.x;
          ty = anchor.y;
          k = 0.05 * alpha;
        }

        n.vx += (tx - n.x) * k;
        n.vy += (ty - n.y) * k;
      }
    };

    const sim = forceSimulation<SimNode>([])
      .force("charge", forceManyBody().strength(-80))
      .force("collide", forceCollide(22))
      .force("link", linkForce)
      .force("layout", layoutForce)
      .alphaDecay(0.02)
      .velocityDecay(0.42);
    sim.stop();
    simulationRef.current = sim;
    prevIdsRef.current = new Set();
    linksRef.current = [];

    return () => {
      sim.stop();
      simulationRef.current = null;
    };
  }, []);

  // Reconcile the simulation with the store.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    clustersRef.current = clusters;
    // The trail lives in world coordinates tied to the cluster layout, so reset it
    // whenever the clustering changes (load / add / re-embed), not just on new ids.
    if (clusters !== prevClustersRef.current) {
      trailRef.current = [];
      prevClustersRef.current = clusters;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    anchorsRef.current = computeAnchors(clusters, w, h);

    const byId = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const prevIds = prevIdsRef.current;
    const overlap = nodes.some((n) => prevIds.has(n.id));
    const isFirstLoad = prevIds.size === 0 || !overlap;
    const sameTopology = prevIds.size === nodes.length && nodes.every((n) => prevIds.has(n.id));
    const bornBase = performance.now();
    let arrivals = 0;

    const next: SimNode[] = nodes.map((n) => {
      const existing = byId.get(n.id);
      if (existing) {
        existing.text = n.text;
        existing.relevance = n.relevance;
        existing.igniteOrder = n.igniteOrder;
        existing.cluster = n.cluster;
        return existing;
      }
      const spawn = isFirstLoad ? { x: n.x, y: n.y } : edgeSpawn(w, h);
      return {
        id: n.id,
        x: spawn.x,
        y: spawn.y,
        rx: spawn.x,
        ry: spawn.y,
        vx: 0,
        vy: 0,
        text: n.text,
        breathPhase: n.breathPhase,
        displayRelevance: 0,
        relevance: n.relevance,
        igniteOrder: n.igniteOrder,
        cluster: n.cluster,
        clusterIndex: 0,
        hover: 0,
        focus: 0,
        bornAt: isFirstLoad ? 0 : bornBase + Math.min(arrivals++, 14) * 70,
      };
    });

    // Assign each node its index within its cluster (drives the expansion ring).
    const clusterCounters = new Map<number, number>();
    for (const n of next) {
      const k = clusterCounters.get(n.cluster) ?? 0;
      n.clusterIndex = k;
      clusterCounters.set(n.cluster, k + 1);
    }

    simNodesRef.current = next;
    nodeByIdRef.current = new Map(next.map((n) => [n.id, n]));
    sim.nodes(next);

    igniteStartRef.current = performance.now();

    if (!sameTopology) {
      const links: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target, strength: e.strength }));
      linksRef.current = links;
      linkForceRef.current?.links(links);
      const adj = new Map<string, Set<string>>();
      for (const e of edges) {
        (adj.get(e.source) ?? adj.set(e.source, new Set()).get(e.source)!).add(e.target);
        (adj.get(e.target) ?? adj.set(e.target, new Set()).get(e.target)!).add(e.source);
      }
      adjacencyRef.current = adj;
      prevIdsRef.current = new Set(nodes.map((n) => n.id));
    }
    sim.alpha(sameTopology ? 0.4 : 0.7).restart();
  }, [nodes, edges, clusters]);

  // Main draw loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (dustRef.current.length === 0) {
        dustRef.current = Array.from({ length: 80 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.4 + Math.random() * 1.3,
          drift: 4 + Math.random() * 10,
          phase: Math.random() * Math.PI * 2,
        }));
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let raf: number;
    let searchStrength = 0;
    let cursorStrength = 0;
    let hoverStrength = 0;
    let focusStrength = 0;
    let expandStrength = 0;
    let prevIgniteStamp = 0;
    let rippleStart = 0;
    let prevFocalKey: string | null = null;
    const start = performance.now();

    const draw = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;

      const simNodes = simNodesRef.current;
      const nodeById = nodeByIdRef.current;
      const links = linksRef.current;
      const cls = clustersRef.current;
      const anchors = anchorsRef.current;
      const igniteElapsed = (now - igniteStartRef.current) / 1000;

      const selectedId = selectedIdRef.current && nodeById.has(selectedIdRef.current) ? selectedIdRef.current : null;
      const selNode = selectedId ? nodeById.get(selectedId)! : null;
      const selNeighbors = selectedId ? adjacencyRef.current.get(selectedId) : null;
      const expandedId = expandedIdRef.current;

      const rawHovered = hoveredIdRef.current;
      const hoveredId = rawHovered && nodeById.has(rawHovered) ? rawHovered : null;
      const neighbors = hoveredId ? adjacencyRef.current.get(hoveredId) : null;

      hoverStrength += ((hoveredId ? 1 : 0) - hoverStrength) * 0.14;
      focusStrength += ((selNode ? 1 : 0) - focusStrength) * 0.08;
      expandStrength += ((expandedId !== null ? 1 : 0) - expandStrength) * 0.08;

      // Memory trail: record a focal point whenever the focus changes.
      const focalKey = selectedId ? `n:${selectedId}` : expandedId !== null ? `c:${expandedId}` : null;
      if (focalKey && focalKey !== prevFocalKey) {
        let fx: number | undefined;
        let fy: number | undefined;
        if (selNode) {
          fx = selNode.rx; // rendered position, so the dot sits on the drawn orb
          fy = selNode.ry;
        } else if (expandedId !== null && anchors.has(expandedId)) {
          const a = anchors.get(expandedId)!;
          fx = a.x;
          fy = a.y;
        }
        if (fx !== undefined && fy !== undefined) {
          const last = trailRef.current[trailRef.current.length - 1];
          if (!last || Math.hypot(last.x - fx, last.y - fy) > 1) {
            trailRef.current.push({ x: fx, y: fy });
            if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();
          }
        }
      }
      prevFocalKey = focalKey;

      const ms = mouseScreenRef.current;
      cursorStrength += ((ms ? 1 : 0) - cursorStrength) * 0.08;
      const o = originRef.current;
      const mw = ms ? { x: (ms.x - o.x) / o.scale, y: (ms.y - o.y) / o.scale } : null;

      const clusterPulse = (id: number) => 0.5 + 0.5 * Math.sin(t * 0.35 + id * 1.3);

      let maxHeat = 0;
      let maxRel = 0;
      let hasHot = false;
      // Cursor gravity is off during search and while focused (node/cluster).
      const pullScale = CURSOR_MAX_PULL * cursorStrength * (1 - searchStrength) * (1 - Math.max(focusStrength, expandStrength));
      for (const n of simNodes) {
        const target = n.relevance;
        if (target > maxRel) maxRel = target;
        if (n.igniteOrder >= 0) hasHot = true;
        const brightening = target > n.displayRelevance;
        const ready = !brightening || n.igniteOrder < 0 || igniteElapsed >= n.igniteOrder * IGNITE_STAGGER;
        if (ready) n.displayRelevance += (target - n.displayRelevance) * 0.06;
        if (n.displayRelevance > maxHeat) maxHeat = n.displayRelevance;

        n.hover += ((hoveredId === n.id ? 1 : 0) - n.hover) * 0.16;
        n.focus += ((selectedId === n.id ? 1 : 0) - n.focus) * 0.12;

        let ox = Math.sin(t * 0.18 + n.breathPhase) * DRIFT_AMP;
        let oy = Math.cos(t * 0.15 + n.breathPhase * 1.3) * DRIFT_AMP;
        if (mw && pullScale > 0.01) {
          const ddx = mw.x - n.x;
          const ddy = mw.y - n.y;
          const d = Math.hypot(ddx, ddy);
          if (d > 0.5 && d < CURSOR_RADIUS) {
            const f = (1 - d / CURSOR_RADIUS) ** 2 * pullScale;
            ox += (ddx / d) * f;
            oy += (ddy / d) * f;
          }
        }
        n.rx = n.x + ox;
        n.ry = n.y + oy;
      }

      const searchActive = maxRel > 0.3;
      searchStrength += ((searchActive ? 1 : 0) - searchStrength) * 0.05;
      searchStrengthRef.current = searchStrength;
      const sim = simulationRef.current;
      // Keep the physics warm while any mode is actively reshaping the map.
      const warm = searchStrength > 0.02 || expandStrength > 0.02 || expandedId !== null;
      if (sim) sim.alphaTarget(warm ? 0.18 : 0);

      const igniteStamp = igniteStartRef.current;
      if (hasHot && igniteStamp !== prevIgniteStamp) rippleStart = now;
      prevIgniteStamp = igniteStamp;

      // --- Camera: node focus > cluster expansion > search gravity > rest ---
      const cam = camRef.current;
      let tCx: number;
      let tCy: number;
      let tScale: number;
      let tAx = 0.5;
      let tAy = 0.5;
      if (selNode) {
        tCx = selNode.x;
        tCy = selNode.y;
        tScale = FOCUS_SCALE;
        tAx = 0.33; // orb to the left, reading card to the right
      } else if (expandedId !== null && anchors.has(expandedId)) {
        const a = anchors.get(expandedId)!;
        tCx = a.x;
        tCy = a.y;
        tScale = FOCUS_SCALE;
        tAy = 0.46;
      } else {
        let hx = 0;
        let hy = 0;
        let hwt = 0;
        for (const n of simNodes) {
          if (n.igniteOrder >= 0) {
            hx += n.rx * n.relevance;
            hy += n.ry * n.relevance;
            hwt += n.relevance;
          }
        }
        tCx = hwt > 0 ? hx / hwt : w / 2;
        tCy = hwt > 0 ? hy / hwt : h / 2;
        tScale = hwt > 0 ? 1.18 : 1;
      }
      cam.cx += (tCx - cam.cx) * 0.05;
      cam.cy += (tCy - cam.cy) * 0.05;
      cam.scale += (tScale - cam.scale) * 0.05;
      cam.ax += (tAx - cam.ax) * 0.05;
      cam.ay += (tAy - cam.ay) * 0.05;
      const originX = cam.ax * w - cam.scale * cam.cx;
      const originY = cam.ay * h - cam.scale * cam.cy;
      originRef.current = { x: originX, y: originY, scale: cam.scale };

      // --- screen space ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const neb = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
      neb.addColorStop(0, "rgba(40, 38, 58, 0.22)");
      neb.addColorStop(1, "rgba(8, 9, 12, 0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      for (const d of dustRef.current) {
        const dx = Math.sin(t * 0.05 + d.phase) * d.drift;
        const dy = Math.cos(t * 0.04 + d.phase) * d.drift;
        const tw = 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.5 + d.phase));
        ctx.beginPath();
        ctx.arc(d.x + dx, d.y + dy, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 205, 225, ${tw})`;
        ctx.fill();
      }

      // --- world space ---
      ctx.save();
      ctx.translate(originX, originY);
      ctx.scale(cam.scale, cam.scale);

      // Memory trail — the fading path of where you've explored.
      const trail = trailRef.current;
      if (trail.length >= 2) {
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const recency = i / trail.length;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(245, 210, 160, ${0.03 + recency * 0.1})`;
          ctx.lineWidth = (0.5 + recency) / cam.scale;
          ctx.stroke();
        }
      }
      for (let i = 0; i < trail.length; i++) {
        const recency = (i + 1) / trail.length;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, (1 + recency * 1.5) / cam.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 210, 160, ${0.05 + recency * 0.16})`;
        ctx.fill();
      }

      // Knowledge-density glow, pinned to anchors, breathing per island.
      const densityFade = 1 - searchStrength * 0.85;
      if (densityFade > 0.02) {
        ctx.globalCompositeOperation = "lighter";
        for (let c = 0; c < cls.length; c++) {
          const anchor = anchors.get(cls[c].id);
          if (!anchor || cls[c].size === 0) continue;
          const collapsedDim = expandedId !== null && cls[c].id !== expandedId ? 1 - expandStrength * 0.85 : 1;
          const pulse = clusterPulse(cls[c].id);
          const [r, g, b] = cls[c].color;
          const radius = (70 + cls[c].size * 9) * (0.86 + 0.14 * pulse);
          const a = Math.min(0.13, 0.03 + cls[c].size * 0.006) * densityFade * (0.78 + 0.22 * pulse) * collapsedDim;
          const grad = ctx.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, radius);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Constellation edges (brighten the hovered/selected node's local web).
      for (const link of links) {
        const aId = typeof link.source === "string" ? link.source : (link.source as SimNode).id;
        const bId = typeof link.target === "string" ? link.target : (link.target as SimNode).id;
        const a = nodeById.get(aId);
        const b = nodeById.get(bId);
        if (!a || !b) continue;
        const bothMatch = a.igniteOrder >= 0 && b.igniteOrder >= 0;
        const heat = bothMatch
          ? Math.max(a.displayRelevance, b.displayRelevance)
          : Math.min(a.displayRelevance, b.displayRelevance);
        let opacity = 0.016 + heat * 0.22;
        const lit = hoveredId === aId || hoveredId === bId || selectedId === aId || selectedId === bId;
        if (lit) {
          const amt = Math.max(a.hover, b.hover, a.focus, b.focus);
          opacity = Math.max(opacity, 0.06 + 0.5 * amt);
        }
        if (opacity < 0.022 && maxHeat > 0.1 && !lit) continue;
        ctx.beginPath();
        ctx.moveTo(a.rx, a.ry);
        ctx.lineTo(b.rx, b.ry);
        ctx.strokeStyle = `rgba(245, 220, 180, ${opacity})`;
        ctx.lineWidth = (lit ? 1.4 : 1) / cam.scale;
        ctx.stroke();
      }

      // Bloom halos (additive) for warm / hovered / focused nodes.
      ctx.globalCompositeOperation = "lighter";
      for (const n of simNodes) {
        const dr = n.displayRelevance;
        const arrival = n.bornAt === 0 ? 1 : Math.max(0, Math.min(1, (now - n.bornAt) / ARRIVAL_MS));
        const lift = Math.max(n.hover, n.focus);
        const glowAmt = Math.max(dr, lift * 0.7) * arrival;
        if (glowAmt <= 0.05) continue;
        const breathe = 1 + Math.sin(t * 0.8 + n.breathPhase) * 0.08;
        const radius = (REST_RADIUS + (ACTIVE_RADIUS - REST_RADIUS) * dr) * breathe * (1 + 0.6 * lift);
        const glow = ctx.createRadialGradient(n.rx, n.ry, 0, n.rx, n.ry, radius * 4.5);
        glow.addColorStop(0, `rgba(245, 197, 122, ${0.5 * glowAmt})`);
        glow.addColorStop(0.4, `rgba(245, 170, 100, ${0.18 * glowAmt})`);
        glow.addColorStop(1, "rgba(245, 170, 100, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.rx, n.ry, radius * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Node cores.
      const coldFade = 1 - 0.72 * maxHeat;
      for (const n of simNodes) {
        const dr = n.displayRelevance;
        const arrival = n.bornAt === 0 ? 1 : Math.max(0, Math.min(1, (now - n.bornAt) / ARRIVAL_MS));
        if (arrival <= 0) continue;
        const lift = Math.max(n.hover, n.focus);
        const breathe = 1 + Math.sin(t * 0.8 + n.breathPhase) * 0.08;
        const islandBreath = 0.97 + 0.03 * clusterPulse(n.cluster);
        const radius =
          (REST_RADIUS + (ACTIVE_RADIUS - REST_RADIUS) * dr) *
          breathe *
          islandBreath *
          (1 + 0.6 * lift) *
          (0.4 + 0.6 * arrival);
        const rest = cls[n.cluster]?.color ?? FALLBACK_COLOR;

        const r = rest[0] + (HOT_COLOR[0] - rest[0]) * dr;
        const g = rest[1] + (HOT_COLOR[1] - rest[1]) * dr;
        const b = rest[2] + (HOT_COLOR[2] - rest[2]) * dr;

        // Spotlight: combine hover / selection / expansion dimming of the rest.
        let prominence = 0;
        let dimStrength = 0;
        if (hoverStrength > 0.001) {
          dimStrength = Math.max(dimStrength, hoverStrength);
          prominence = Math.max(prominence, n.hover, neighbors?.has(n.id) ? 0.5 : 0);
        }
        if (focusStrength > 0.001) {
          dimStrength = Math.max(dimStrength, focusStrength);
          prominence = Math.max(prominence, n.focus, n.id === selectedId ? 1 : selNeighbors?.has(n.id) ? 0.5 : 0);
        }
        if (expandStrength > 0.001) {
          dimStrength = Math.max(dimStrength, expandStrength);
          prominence = Math.max(prominence, n.cluster === expandedId ? 1 : 0);
        }
        const dof = 1 - dimStrength * (1 - Math.min(1, prominence)) * 0.62;
        const alpha = Math.max(0.05, Math.min(1, (0.34 * coldFade + dr * 0.9 + lift * 0.25) * dof)) * arrival;

        ctx.beginPath();
        ctx.arc(n.rx, n.ry, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        if (dr > 0.4 || lift > 0.2) {
          const k = Math.max(Math.min(1, dr * 0.9), lift * 0.85);
          ctx.beginPath();
          ctx.arc(n.rx, n.ry, radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 245, 230, ${k})`;
          ctx.fill();
        }

        if (n.bornAt !== 0) {
          const spark = now >= n.bornAt ? Math.max(0, 1 - (now - n.bornAt) / SPARK_MS) : 0;
          if (spark > 0.01) {
            ctx.globalCompositeOperation = "lighter";
            const sr = radius * (1 + spark * 3);
            const sg = ctx.createRadialGradient(n.rx, n.ry, 0, n.rx, n.ry, sr);
            sg.addColorStop(0, `rgba(255, 244, 224, ${0.7 * spark})`);
            sg.addColorStop(1, "rgba(255, 244, 224, 0)");
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(n.rx, n.ry, sr, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }

        if (lift > 0.02) {
          ctx.beginPath();
          ctx.arc(n.rx, n.ry, radius + 6 + lift * 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 240, 214, ${0.5 * lift})`;
          ctx.lineWidth = 1.4 / cam.scale;
          ctx.stroke();
        }
      }

      ctx.restore();

      // --- shockwave ripple ---
      const rElapsed = (now - rippleStart) / RIPPLE_MS;
      if (rippleStart > 0 && rElapsed < 1) {
        const ease = 1 - (1 - rElapsed) * (1 - rElapsed);
        const maxR = Math.min(w, h) * 0.55;
        for (let i = 0; i < 2; i++) {
          const p = ease - i * 0.12;
          if (p <= 0) continue;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, p * maxR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 200, 130, ${(1 - rElapsed) * 0.22 * (1 - i * 0.4)})`;
          ctx.lineWidth = 2 - rElapsed * 1.5;
          ctx.stroke();
        }
      }

      // --- topic labels (screen space) + hover/expanded count pill ---
      const labelAlpha = (1 - searchStrength * 0.88) * (1 - hoverStrength * 0.4) * 0.6;
      const rects: LabelRect[] = [];
      if (labelAlpha > 0.06) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let c = 0; c < cls.length; c++) {
          const anchor = anchors.get(cls[c].id);
          if (!anchor || cls[c].size === 0) continue;
          const sx = originX + cam.scale * anchor.x;
          const sy = originY + cam.scale * anchor.y - (78 + cls[c].size * 1.5);
          const [r, g, b] = cls[c].color;
          const isActive = hoveredClusterRef.current === cls[c].id || expandedId === cls[c].id;

          if (isActive) {
            const txt = `${cls[c].label.toUpperCase()}   ·   ${cls[c].size} ${cls[c].size === 1 ? "note" : "notes"}`;
            ctx.font = "600 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
            try {
              ctx.letterSpacing = "1.5px";
            } catch {
              /* ignore */
            }
            const tw = ctx.measureText(txt).width;
            const padX = 14;
            const padY = 8;
            const bw = tw + padX * 2;
            const bh = 13 + padY * 2;
            ctx.beginPath();
            ctx.roundRect(sx - bw / 2, sy - bh / 2, bw, bh, bh / 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.16)`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.5)`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, 0.95)`;
            ctx.fillText(txt, sx, sy);
            rects.push({ id: cls[c].id, cx: sx, cy: sy, hw: bw / 2 + 6, hh: bh / 2 + 6 });
          } else {
            ctx.font = "500 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
            try {
              ctx.letterSpacing = "1.5px";
            } catch {
              /* ignore */
            }
            const sizeBoost = Math.min(0.25, cls[c].size * 0.015);
            ctx.fillStyle = `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, ${labelAlpha + sizeBoost})`;
            const upper = cls[c].label.toUpperCase();
            ctx.fillText(upper, sx, sy);
            // measureText already includes the active letterSpacing — don't re-add it.
            const tw = ctx.measureText(upper).width;
            rects.push({ id: cls[c].id, cx: sx, cy: sy, hw: tw / 2 + 10, hh: 16 });
          }
        }
        try {
          ctx.letterSpacing = "0px";
        } catch {
          /* ignore */
        }
      }
      labelRectsRef.current = rects;

      // --- vignette ---
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, "rgba(0, 0, 0, 0)");
      vig.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const findNodeAt = (screenX: number, screenY: number): SimNode | null => {
      const { x: ox, y: oy, scale } = originRef.current;
      const wx = (screenX - ox) / scale;
      const wy = (screenY - oy) / scale;
      for (const n of simNodesRef.current) {
        const radius = REST_RADIUS + (ACTIVE_RADIUS - REST_RADIUS) * n.displayRelevance + HOVER_RADIUS_PADDING;
        const dx = n.rx - wx;
        const dy = n.ry - wy;
        if (dx * dx + dy * dy <= radius * radius) return n;
      }
      return null;
    };

    const findClusterAt = (sx: number, sy: number): number | null => {
      for (const r of labelRectsRef.current) {
        if (Math.abs(sx - r.cx) <= r.hw && Math.abs(sy - r.cy) <= r.hh) return r.id;
      }
      return null;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      mouseScreenRef.current = { x: sx, y: sy };
      const node = findNodeAt(sx, sy);
      hoveredIdRef.current = node?.id ?? null;
      if (node && node.id !== selectedIdRef.current) {
        hoveredClusterRef.current = null;
        const cl = clustersRef.current[node.cluster];
        setHover({
          text: node.text,
          label: cl?.label ?? "",
          color: cl?.color ?? FALLBACK_COLOR,
          x: e.clientX,
          y: e.clientY,
        });
        canvas.style.cursor = "pointer";
      } else {
        const clusterId = findClusterAt(sx, sy);
        hoveredClusterRef.current = clusterId;
        setHover(null);
        canvas.style.cursor = clusterId !== null ? "pointer" : "default";
      }
    };

    const onMouseLeave = () => {
      mouseScreenRef.current = null;
      hoveredIdRef.current = null;
      hoveredClusterRef.current = null;
      setHover(null);
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const node = findNodeAt(sx, sy);
      if (node) {
        selectNode(node.id);
        return;
      }
      const clusterId = findClusterAt(sx, sy);
      if (clusterId !== null) {
        // Toggle: clicking the already-expanded island collapses it.
        expandCluster(expandedIdRef.current === clusterId ? null : clusterId);
        return;
      }
      // Empty space → step back out of any focus, in one go.
      if (selectedIdRef.current || expandedIdRef.current !== null) zoomOut();
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [selectNode, expandCluster, zoomOut]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-72 rounded-xl border border-white/10 bg-[#0c0d11]/90 p-3 shadow-xl backdrop-blur-sm"
          style={{ left: hover.x + 18, top: hover.y + 18 }}
        >
          {hover.label && (
            <span
              className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                color: `rgb(${Math.min(255, hover.color[0] + 70)}, ${Math.min(255, hover.color[1] + 70)}, ${Math.min(255, hover.color[2] + 70)})`,
                background: `rgba(${hover.color[0]}, ${hover.color[1]}, ${hover.color[2]}, 0.16)`,
              }}
            >
              {hover.label}
            </span>
          )}
          <div
            className="max-h-24 overflow-hidden text-xs leading-relaxed text-[#cfc9c0]"
            style={{
              WebkitMaskImage: "linear-gradient(180deg, #000 58%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 58%, transparent 100%)",
            }}
          >
            {hover.text}
          </div>
        </div>
      )}
    </div>
  );
}
