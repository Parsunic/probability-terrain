import { useMemo } from "react";
import { useAppStore } from "../store";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "this", "that", "it", "as", "by",
  "at", "from", "about", "into", "than", "then", "so", "if", "not", "their",
  "its", "they", "we", "you", "i", "he", "she", "his", "her", "them",
]);

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [text];
}

function highlightScore(sentence: string, queryWords: Set<string>): number {
  const words = sentence.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) if (queryWords.has(w)) hits++;
  return hits / words.length;
}

export function NodePanel() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const nodes = useAppStore((s) => s.nodes);
  const clusters = useAppStore((s) => s.clusters);
  const query = useAppStore((s) => s.query);
  const selectNode = useAppStore((s) => s.selectNode);
  const findSimilarTo = useAppStore((s) => s.findSimilarTo);

  const node = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const cluster = node ? clusters[node.cluster] : undefined;

  const sentences = useMemo(() => (node ? splitSentences(node.text) : []), [node]);
  const queryWords = useMemo(() => {
    const words = (query.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOPWORDS.has(w));
    return new Set(words);
  }, [query]);

  const open = node !== null;
  const color = cluster?.color ?? [200, 200, 210];

  return (
    <div
      className={`pointer-events-none absolute right-[3vw] top-1/2 z-40 w-[440px] -translate-y-1/2 transition-all duration-500 ease-out ${
        open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
      }`}
    >
      {node && (
        <div className="pointer-events-auto flex max-h-[78vh] flex-col rounded-2xl border border-white/10 bg-[#0b0c10]/92 p-7 shadow-2xl backdrop-blur-md">
          <div className="mb-5 flex items-center justify-between">
            {cluster ? (
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{
                  color: `rgb(${Math.min(255, color[0] + 70)}, ${Math.min(255, color[1] + 70)}, ${Math.min(255, color[2] + 70)})`,
                  background: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.16)`,
                }}
              >
                {cluster.label}
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={() => selectNode(null)}
              aria-label="Close"
              className="text-[#7a756d] transition-colors hover:text-[#cfc9c0]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto pr-2 text-[15px] leading-[1.9] text-[#e8e6e1]">
            {sentences.map((sentence, i) => {
              const score = queryWords.size > 0 ? highlightScore(sentence, queryWords) : 0;
              const isHighlighted = score > 0;
              return (
                <span key={i} className={isHighlighted ? "rounded bg-[#f5c57a]/15 text-[#f5c57a]" : ""}>
                  {sentence}{" "}
                </span>
              );
            })}
          </div>

          <button
            onClick={() => findSimilarTo(node.id)}
            className="mt-6 w-fit rounded-full bg-[#f5c57a]/90 px-5 py-2.5 text-sm font-medium text-[#1a1408] transition-colors hover:bg-[#f5c57a]"
          >
            Find similar
          </button>
        </div>
      )}
    </div>
  );
}
