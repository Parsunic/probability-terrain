import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The pitch screen at /launch. It floats over the already-running terrain (so the
 * stars react to the cursor behind a soft scrim), and "Enter the Mindscape" dives
 * the camera forward into the living map.
 */
export function LaunchPage({ onEnter }: { onEnter: () => void }) {
  const [entering, setEntering] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const enter = useCallback(() => {
    if (entering) return;
    setEntering(true);
    timer.current = window.setTimeout(onEnter, 850);
  }, [entering, onEnter]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Soft scrim — keeps text legible while the terrain breathes through it. */}
      <div
        className="absolute inset-0 backdrop-blur-[3px] transition-opacity duration-[850ms] ease-in"
        style={{
          opacity: entering ? 0 : 1,
          background:
            "radial-gradient(ellipse at center, rgba(8,9,12,0.62) 0%, rgba(8,9,12,0.82) 70%, rgba(8,9,12,0.92) 100%)",
        }}
      />

      <div
        className="relative max-w-2xl px-8 text-center transition-all duration-[850ms] ease-in"
        style={{
          opacity: entering ? 0 : 1,
          transform: entering
            ? "scale(3)"
            : `translate(${parallax.x * -10}px, ${parallax.y * -10}px) scale(1)`,
        }}
      >
        <h1
          className="mb-8 text-6xl font-extralight tracking-[0.04em] text-[#f3eee4]"
          style={{ textShadow: "0 0 40px rgba(245,197,122,0.25)" }}
        >
          Mindscape
        </h1>

        <p className="mb-6 text-2xl font-light leading-snug text-[#e8e6e1]">
          Human memory isn't a list. It's a web.
        </p>

        <div className="mx-auto mb-10 max-w-xl space-y-4 text-[15px] font-light leading-relaxed text-[#9b958c]">
          <p>
            You don't recall in straight lines — you recall by resemblance, one idea quietly tugging
            at the next. Memory is <span className="text-[#cfc9c0]">relational</span>. It connects.
          </p>
          <p>
            So why are our notes still trapped in folders and endless feeds — flattened, alphabetized,
            and forgotten?
          </p>
          <p className="text-[#cfc9c0]">
            Mindscape turns your notes into a living landscape of thought. Say what you're reaching
            for, and the right ideas surface like stars through clearing fog.
          </p>
        </div>

        <button
          onClick={enter}
          className="pointer-events-auto group inline-flex items-center gap-2 rounded-full bg-[#f5c57a]/90 px-8 py-3.5 text-sm font-medium text-[#1a1408] transition-all hover:bg-[#f5c57a]"
          style={{ animation: "launch-glow 3.2s ease-in-out infinite" }}
        >
          Enter the Mindscape
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  );
}
