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
  /** rendered position = physics position + a slow "living" drift offset */
  rx: number;
  ry: number;
  text: string;
  breathPhase: number;
  displayRelevance: number;
  relevance: number;
  igniteOrder: number;
  cluster: number;
}

type SimLink = SimulationLinkDatum<SimNode> & { strength: number };

const REST_RADIUS = 5;
const ACTIVE_RADIUS = 13;
const HOVER_RADIUS_PADDING = 7;
const IGNITE_STAGGER = 0.08;
const DRIFT_AMP = 2.6; // px of perpetual "alive" wobble
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

export function Terrain() {
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const clusters = useAppStore((s) => s.clusters);
  const selectNode = useAppStore((s) => s.selectNode);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const simNodesRef = useRef<SimNode[]>([]);
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const linkForceRef = useRef<ForceLink<SimNode, SimLink> | null>(null);
  const linksRef = useRef<SimLink[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const igniteStartRef = useRef<number>(0);

  const clustersRef = useRef<Cluster[]>([]);
  const anchorsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const searchStrengthRef = useRef<number>(0);

  const camRef = useRef({ cx: 0, cy: 0, scale: 1 });
  const originRef = useRef({ x: 0, y: 0, scale: 1 });

  const dustRef = useRef<{ x: number; y: number; r: number; drift: number; phase: number }[]>([]);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);

  // Create the simulation once. Forces read live refs so node/cluster swaps
  // during reconcile never require rebuilding the simulation.
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camRef.current = { cx: w / 2, cy: h / 2, scale: 1 };

    const linkForce = forceLink<SimNode, SimLink>([])
      .id((d) => d.id)
      .distance((l) => 90 - l.strength * 40)
      .strength((l) => l.strength * 0.12);
    linkForceRef.current = linkForce;

    // The one force that gives the map its shape. At rest it pulls each node to
    // its cluster's anchor (topic islands). During search it blends that target
    // toward gravity: matches fall to the center, everything else is flung out.
    const layoutForce = (alpha: number) => {
      const sim = simNodesRef.current;
      const anchors = anchorsRef.current;
      const ss = searchStrengthRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw / 2;
      const cy = vh / 2;
      // Sized so flung non-matches land just inside the viewport even after the
      // ~1.18x search zoom (0.40 * minDim projects to ~0.47 * minDim on screen).
      const pushR = Math.min(vw, vh) * 0.4;
      for (const n of sim) {
        const anchor = anchors.get(n.cluster) ?? { x: cx, y: cy };
        let tx = anchor.x;
        let ty = anchor.y;
        if (ss > 0.001) {
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
        }
        const k = (n.relevance >= 0.5 && ss > 0.001 ? 0.05 + 0.05 * ss : 0.05) * alpha;
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

  // Reconcile the simulation with the store. Existing nodes keep their position;
  // new nodes drift in. Cluster ids/colors and anchors are refreshed every time.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    clustersRef.current = clusters;
    anchorsRef.current = computeAnchors(clusters, window.innerWidth, window.innerHeight);

    const byId = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const prevIds = prevIdsRef.current;
    const sameTopology = prevIds.size === nodes.length && nodes.every((n) => prevIds.has(n.id));

    const next: SimNode[] = nodes.map((n) => {
      const existing = byId.get(n.id);
      if (existing) {
        existing.text = n.text;
        existing.relevance = n.relevance;
        existing.igniteOrder = n.igniteOrder;
        existing.cluster = n.cluster;
        return existing;
      }
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        rx: n.x,
        ry: n.y,
        vx: 0,
        vy: 0,
        text: n.text,
        breathPhase: n.breathPhase,
        displayRelevance: 0,
        relevance: n.relevance,
        igniteOrder: n.igniteOrder,
        cluster: n.cluster,
      };
    });
    simNodesRef.current = next;
    nodeByIdRef.current = new Map(next.map((n) => [n.id, n]));
    sim.nodes(next);

    igniteStartRef.current = performance.now();

    if (!sameTopology) {
      const links: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target, strength: e.strength }));
      linksRef.current = links;
      linkForceRef.current?.links(links);
      prevIdsRef.current = new Set(nodes.map((n) => n.id));
    }
    // Wake the simulation; the draw loop keeps it warm while a search reshapes
    // the map, then lets it settle back onto the islands.
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
      const igniteElapsed = (now - igniteStartRef.current) / 1000;

      // Advance display relevance (staggered ignite), the living drift, and find
      // the strongest target relevance (drives gravity + camera).
      let maxHeat = 0;
      let maxRel = 0;
      for (const n of simNodes) {
        const target = n.relevance;
        if (target > maxRel) maxRel = target;
        const brightening = target > n.displayRelevance;
        const ready = !brightening || n.igniteOrder < 0 || igniteElapsed >= n.igniteOrder * IGNITE_STAGGER;
        if (ready) n.displayRelevance += (target - n.displayRelevance) * 0.06;
        if (n.displayRelevance > maxHeat) maxHeat = n.displayRelevance;
        n.rx = n.x + Math.sin(t * 0.18 + n.breathPhase) * DRIFT_AMP;
        n.ry = n.y + Math.cos(t * 0.15 + n.breathPhase * 1.3) * DRIFT_AMP;
      }

      // Drive search strength + keep the sim warm while the map reshapes.
      const searchActive = maxRel > 0.3;
      searchStrength += ((searchActive ? 1 : 0) - searchStrength) * 0.05;
      searchStrengthRef.current = searchStrength;
      const sim = simulationRef.current;
      if (sim) sim.alphaTarget(searchStrength > 0.02 ? 0.18 : 0);

      // Topic islands are pinned to their stable ring anchors (not live node
      // positions) so labels + glow stay put while gravity scatters the nodes.
      const anchors = anchorsRef.current;

      // Camera drifts toward the hot cluster (which gravity pulls to center).
      let hx = 0;
      let hy = 0;
      let hw = 0;
      for (const n of simNodes) {
        if (n.igniteOrder >= 0) {
          hx += n.rx * n.relevance;
          hy += n.ry * n.relevance;
          hw += n.relevance;
        }
      }
      const cam = camRef.current;
      const targetCx = hw > 0 ? hx / hw : w / 2;
      const targetCy = hw > 0 ? hy / hw : h / 2;
      const targetScale = hw > 0 ? 1.18 : 1;
      cam.cx += (targetCx - cam.cx) * 0.035;
      cam.cy += (targetCy - cam.cy) * 0.035;
      cam.scale += (targetScale - cam.scale) * 0.035;
      const originX = w / 2 - cam.scale * cam.cx;
      const originY = h / 2 - cam.scale * cam.cy;
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

      // Knowledge-density glow: denser clusters glow larger/brighter. Fades as a
      // search takes over so it doesn't muddy the "found" moment.
      const densityFade = 1 - searchStrength * 0.85;
      if (densityFade > 0.02) {
        ctx.globalCompositeOperation = "lighter";
        for (let c = 0; c < cls.length; c++) {
          const anchor = anchors.get(cls[c].id);
          if (!anchor || cls[c].size === 0) continue;
          const gx = anchor.x;
          const gy = anchor.y;
          const [r, g, b] = cls[c].color;
          const radius = 70 + cls[c].size * 9;
          const a = Math.min(0.13, 0.03 + cls[c].size * 0.006) * densityFade;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx, gy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Constellation edges.
      for (const link of links) {
        const a = nodeById.get(typeof link.source === "string" ? link.source : (link.source as SimNode).id);
        const b = nodeById.get(typeof link.target === "string" ? link.target : (link.target as SimNode).id);
        if (!a || !b) continue;
        const bothMatch = a.igniteOrder >= 0 && b.igniteOrder >= 0;
        const heat = bothMatch
          ? Math.max(a.displayRelevance, b.displayRelevance)
          : Math.min(a.displayRelevance, b.displayRelevance);
        const opacity = 0.016 + heat * 0.22;
        if (opacity < 0.022 && maxHeat > 0.1) continue;
        ctx.beginPath();
        ctx.moveTo(a.rx, a.ry);
        ctx.lineTo(b.rx, b.ry);
        ctx.strokeStyle = `rgba(245, 220, 180, ${opacity})`;
        ctx.lineWidth = 1 / cam.scale;
        ctx.stroke();
      }

      // Bloom halos (additive) for warm nodes.
      ctx.globalCompositeOperation = "lighter";
      for (const n of simNodes) {
        const dr = n.displayRelevance;
        if (dr <= 0.05) continue;
        const breathe = 1 + Math.sin(t * 0.8 + n.breathPhase) * 0.08;
        const radius = (REST_RADIUS + (ACTIVE_RADIUS - REST_RADIUS) * dr) * breathe;
        const glow = ctx.createRadialGradient(n.rx, n.ry, 0, n.rx, n.ry, radius * 4.5);
        glow.addColorStop(0, `rgba(245, 197, 122, ${0.5 * dr})`);
        glow.addColorStop(0.4, `rgba(245, 170, 100, ${0.18 * dr})`);
        glow.addColorStop(1, "rgba(245, 170, 100, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.rx, n.ry, radius * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Node cores — colored by cluster at rest, igniting to warm amber on match.
      const coldFade = 1 - 0.72 * maxHeat;
      for (const n of simNodes) {
        const dr = n.displayRelevance;
        const breathe = 1 + Math.sin(t * 0.8 + n.breathPhase) * 0.08;
        const radius = (REST_RADIUS + (ACTIVE_RADIUS - REST_RADIUS) * dr) * breathe;
        const rest = cls[n.cluster]?.color ?? FALLBACK_COLOR;

        const r = rest[0] + (HOT_COLOR[0] - rest[0]) * dr;
        const g = rest[1] + (HOT_COLOR[1] - rest[1]) * dr;
        const b = rest[2] + (HOT_COLOR[2] - rest[2]) * dr;
        const alpha = Math.max(0.05, Math.min(1, 0.34 * coldFade + dr * 0.9));

        ctx.beginPath();
        ctx.arc(n.rx, n.ry, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        if (dr > 0.4) {
          ctx.beginPath();
          ctx.arc(n.rx, n.ry, radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 245, 230, ${Math.min(1, dr * 0.9)})`;
          ctx.fill();
        }
      }

      ctx.restore();

      // --- topic labels (screen space, crisp regardless of zoom) ---
      const labelAlpha = (1 - searchStrength * 0.88) * 0.6;
      if (labelAlpha > 0.03) {
        ctx.font = "500 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        try {
          ctx.letterSpacing = "1.5px";
        } catch {
          /* older engines ignore letterSpacing */
        }
        for (let c = 0; c < cls.length; c++) {
          const anchor = anchors.get(cls[c].id);
          if (!anchor || cls[c].size === 0) continue;
          // world -> screen, then lift the label above the cluster.
          const sx = originX + cam.scale * anchor.x;
          const sy = originY + cam.scale * anchor.y - (78 + cls[c].size * 1.5);
          const [r, g, b] = cls[c].color;
          const sizeBoost = Math.min(0.25, cls[c].size * 0.015); // denser = a touch brighter
          ctx.fillStyle = `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, ${labelAlpha + sizeBoost})`;
          ctx.fillText(cls[c].label.toUpperCase(), sx, sy);
        }
        try {
          ctx.letterSpacing = "0px";
        } catch {
          /* ignore */
        }
      }

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

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        setHover({ text: node.text, x: e.clientX, y: e.clientY });
        canvas.style.cursor = "pointer";
      } else {
        setHover(null);
        canvas.style.cursor = "default";
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) selectNode(node.id);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [selectNode]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-white/10 bg-[#0c0d11]/90 px-3 py-2 text-xs leading-relaxed text-[#cfc9c0] shadow-lg backdrop-blur-sm"
          style={{ left: hover.x + 16, top: hover.y + 16 }}
        >
          {hover.text.slice(0, 120)}
          {hover.text.length > 120 ? "…" : ""}
        </div>
      )}
    </div>
  );
}
