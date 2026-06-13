import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const TOTAL = 5;
const TEAL = "#5ba89a";
const ROSE = "#c4768a";
const PURPLE = "#7b8fd4";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Slow-drifting colored orbs + a field of tiny stars, behind everything. */
function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const palette = ["#5ba89a", "#c4768a", "#7b8fd4", "#8ab5c4", "#a07bc4"].map(hexToRgb);

    type Orb = { x: number; y: number; vx: number; vy: number; r: number; c: [number, number, number]; o: number };
    type Star = { x: number; y: number; r: number; o: number; tw: number };
    let orbs: Orb[] = [];
    let stars: Star[] = [];
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (orbs.length === 0) {
        orbs = Array.from({ length: 52 }, () => {
          const a = Math.random() * Math.PI * 2;
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            vx: Math.cos(a) * 0.22,
            vy: Math.sin(a) * 0.22,
            r: 0.7 + Math.random() * 2.4,
            c: palette[(Math.random() * palette.length) | 0],
            o: 0.1 + Math.random() * 0.48,
          };
        });
        stars = Array.from({ length: 130 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.3 + Math.random() * 0.9,
          o: 0.2 + Math.random() * 0.5,
          tw: Math.random() * Math.PI * 2,
        }));
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const tw = s.o * (0.45 + 0.55 * Math.sin(t * 1.3 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.fill();
      }

      for (const orb of orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;
        const m = orb.r * 6;
        if (orb.x < -m) orb.x = w + m;
        if (orb.x > w + m) orb.x = -m;
        if (orb.y < -m) orb.y = h + m;
        if (orb.y > h + m) orb.y = -m;
        const [r, g, b] = orb.c;
        const glow = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r * 3.4);
        glow.addColorStop(0, `rgba(${r},${g},${b},${orb.o})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

const eyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.28em",
  textTransform: "uppercase",
  color: TEAL,
};
const h1Style: CSSProperties = {
  fontSize: "clamp(30px, 5vw, 58px)",
  fontWeight: 700,
  color: "#edf0f7",
  lineHeight: 1.08,
  letterSpacing: "-0.02em",
};
const subStyle: CSSProperties = { fontSize: 15, fontWeight: 300, color: "#4a5a74", lineHeight: 1.85 };

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div style={eyebrow} className="mb-5">
    {children}
  </div>
);
const H1 = ({ children }: { children: ReactNode }) => <h1 style={h1Style}>{children}</h1>;
const Sub = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p style={subStyle} className={className}>
    {children}
  </p>
);

function MockCard({ title, items, bullet }: { title: string; items: string[]; bullet: boolean }) {
  return (
    <div
      className="p-5 text-left"
      style={{ background: "rgba(255,255,255,0.038)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}
    >
      <div className="mb-4" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: "#586781", textTransform: "uppercase" }}>
        {title}
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 13, color: "#6b7891" }}>
            {bullet ? `•  ${it}` : it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The "brain" cluster: a central node tethered to four outer nodes. */
function ClusterSVG() {
  const center = { x: 130, y: 110 };
  const outer = [
    { x: 38, y: 40, label: "teams", c: TEAL },
    { x: 222, y: 40, label: "energy", c: ROSE },
    { x: 38, y: 180, label: "sleep", c: PURPLE },
    { x: 222, y: 180, label: "focus", c: TEAL },
  ];
  return (
    <svg width="260" height="220" viewBox="0 0 260 220">
      {outer.map((o, i) => (
        <line key={i} x1={center.x} y1={center.y} x2={o.x} y2={o.y} stroke={o.c} strokeOpacity={0.5} strokeWidth={1.2} />
      ))}
      {outer.map((o, i) => (
        <g key={i}>
          <circle cx={o.x} cy={o.y} r={6} fill={o.c} fillOpacity={0.85} />
          <text x={o.x} y={o.y + (o.y < 110 ? -14 : 22)} fill={o.c} fontSize="12" textAnchor="middle">
            {o.label}
          </text>
        </g>
      ))}
      <circle cx={center.x} cy={center.y} r={17} fill={TEAL} fillOpacity={0.9} />
      <text x={center.x} y={center.y + 4} fill="#ffffff" fontSize="12" fontWeight={600} textAnchor="middle">
        burnout
      </text>
    </svg>
  );
}

function Slide5({ onEnterApp }: { onEnterApp: (e: React.MouseEvent) => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setStep(1), 420);
    const t2 = window.setTimeout(() => setStep(2), 420 + 550);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <>
      <Eyebrow>The New Interface</Eyebrow>
      <H1>
        What if notes
        <br />
        felt like memory?
      </H1>
      <div className="mt-12 flex flex-col items-center gap-5">
        <div
          className="rounded-full px-7 py-3.5 italic"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9aa6bd", fontSize: 18, fontWeight: 300 }}
        >
          “I'm burning out and my team feels distant”
        </div>
        <div style={{ opacity: step >= 1 ? 1 : 0, transition: "opacity 400ms ease", color: "#586781", fontSize: 22 }}>↓</div>
        <div className="flex gap-3" style={{ opacity: step >= 2 ? 1 : 0, transform: step >= 2 ? "translateY(0)" : "translateY(6px)", transition: "all 500ms ease" }}>
          <Tag color={TEAL}>RESILIENCE</Tag>
          <Tag color={ROSE}>TEAMS</Tag>
        </div>
      </div>
      <Sub className="mt-9">Type a feeling. Navigate to meaning.</Sub>
      <button
        onClick={onEnterApp}
        className="mt-8 rounded-full transition-colors"
        style={{
          border: `1px solid rgba(91,168,154,0.5)`,
          color: TEAL,
          background: "transparent",
          padding: "12px 32px",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.12em",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(91,168,154,0.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        Enter the Mindscape
      </button>
    </>
  );
}

function Tag({ color, children }: { color: string; children: ReactNode }) {
  const [r, g, b] = hexToRgb(color);
  return (
    <span
      className="rounded-full px-5 py-2"
      style={{ border: `1px solid rgba(${r},${g},${b},0.5)`, color, background: `rgba(${r},${g},${b},0.08)`, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em" }}
    >
      {children}
    </span>
  );
}

function renderSlide(slide: number, onEnterApp: (e: React.MouseEvent) => void): ReactNode {
  switch (slide) {
    case 0:
      return (
        <>
          <Eyebrow>New Interfaces · TillyHacks 2026</Eyebrow>
          <H1>
            Your ideas
            <br />
            don't live in lines.
          </H1>
          <Sub className="mt-7">But every tool treats them like they do.</Sub>
        </>
      );
    case 1:
      return (
        <>
          <Eyebrow>The Old Interface</Eyebrow>
          <H1>20+ years. Same list.</H1>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
            <MockCard title="Notion" bullet items={["Ideas list", "Team retro", "Q3 goals", "…"]} />
            <MockCard title="Google Docs" bullet={false} items={["1.  Project plan", "2.  Meeting notes", "3.  Brainstorm", "4.  …"]} />
            <MockCard title="Apple Notes" bullet items={["Random thoughts", "Ideas dump", "Jul 14 note", "…"]} />
          </div>
          <Sub className="mt-8">Different icon. Same cursor. Same list going down.</Sub>
        </>
      );
    case 2:
      return (
        <>
          <Eyebrow>How Memory Actually Works</Eyebrow>
          <H1>
            Memory is a web,
            <br />
            not a list.
          </H1>
          <div className="mt-10 flex items-center justify-center gap-10">
            <div className="flex flex-col items-center">
              <div className="mb-3" style={{ ...eyebrow, color: TEAL }}>
                The Brain
              </div>
              <ClusterSVG />
            </div>
            <div style={{ color: "#3a4761", fontSize: 13, letterSpacing: "0.1em" }}>vs</div>
            <div className="flex flex-col items-center">
              <div className="mb-3" style={{ ...eyebrow, color: ROSE }}>
                The Tool
              </div>
              <div
                className="p-5 text-left"
                style={{ background: "rgba(255,255,255,0.038)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, width: 190 }}
              >
                <ul className="space-y-2.5">
                  {["burnout", "teams", "energy", "sleep", "focus", "…"].map((it) => (
                    <li key={it} style={{ fontSize: 13, color: "#6b7891" }}>
                      •  {it}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <Sub className="mx-auto mt-8 max-w-xl">
            When you think of <span style={{ color: "#9aa6bd" }}>“burnout”</span>, your mind navigates toward a cluster. Not down a list.
          </Sub>
        </>
      );
    case 3:
      return (
        <>
          <Eyebrow>The Mismatch</Eyebrow>
          <H1>I built Mindscape</H1>
          <Sub className="mt-7">A tool that thinks and remembers the way you do.</Sub>
        </>
      );
    default:
      return <Slide5 onEnterApp={onEnterApp} />;
  }
}

export function LaunchPage({ onEnter }: { onEnter: () => void }) {
  const [slide, setSlide] = useState(0);
  const [entering, setEntering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const next = () => setSlide((s) => Math.min(TOTAL - 1, s + 1));
  const prev = () => setSlide((s) => Math.max(0, s - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar" || e.key === "ArrowDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enterApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entering) return;
    setEntering(true);
    window.setTimeout(onEnter, 450);
  };

  const onZoneClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.45) prev();
    else next();
  };

  return (
    <div
      ref={containerRef}
      onClick={onZoneClick}
      className="absolute inset-0 z-50 overflow-hidden select-none"
      style={{
        background: "#0b0f1a",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        opacity: entering ? 0 : 1,
        transition: "opacity 450ms ease",
      }}
    >
      <Starfield />

      {/* Skip straight into the app */}
      <button
        onClick={enterApp}
        title="Enter Mindscape"
        className="absolute right-6 top-6 z-20 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: "rgba(255,255,255,0.92)", color: "#0b0f1a" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {/* Slide content */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <div key={slide} className="w-full max-w-3xl text-center" style={{ animation: "launch-slide 600ms ease both" }}>
          {renderSlide(slide, enterApp)}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <NavArrow dir="left" disabled={slide === 0} onClick={prev} />
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              className="transition-all duration-300"
              style={{
                height: 5,
                width: i === slide ? 20 : 5,
                borderRadius: 9999,
                background: i === slide ? TEAL : "rgba(255,255,255,0.14)",
              }}
            />
          ))}
        </div>
        <NavArrow dir="right" disabled={slide === TOTAL - 1} onClick={next} />
      </div>

      <div className="absolute bottom-7 right-8 z-10" style={{ fontSize: 12, color: "#3a4761" }}>
        {slide + 1} / {TOTAL}
      </div>
    </div>
  );
}

function NavArrow({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="flex h-9 w-11 items-center justify-center rounded-lg transition-opacity"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#7a87a0", opacity: disabled ? 0.3 : 1 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <polyline points="14 6 8 12 14 18" /> : <polyline points="10 6 16 12 10 18" />}
      </svg>
    </button>
  );
}
