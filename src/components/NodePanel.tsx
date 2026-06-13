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
  const query = useAppStore((s) => s.query);
  const selectNode = useAppStore((s) => s.selectNode);
  const findSimilarTo = useAppStore((s) => s.findSimilarTo);

  const node = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const sentences = useMemo(() => (node ? splitSentences(node.text) : []), [node]);

  const queryWords = useMemo(() => {
    const words = (query.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOPWORDS.has(w));
    return new Set(words);
  }, [query]);

  const open = node !== null;

  return (
    <div
      className={`absolute right-0 top-0 z-40 h-full w-[420px] border-l border-white/5 bg-[#0b0c10]/95 backdrop-blur-md transition-transform duration-500 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {node && (
        <div className="flex h-full flex-col p-8">
          <button
            onClick={() => selectNode(null)}
            className="mb-8 w-fit rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-[#9b958c] transition-colors hover:bg-white/[0.06]"
          >
            ← back to terrain
          </button>

          <div className="flex-1 overflow-y-auto pr-2 text-[15px] leading-[1.9] text-[#e8e6e1]">
            {sentences.map((sentence, i) => {
              const score = queryWords.size > 0 ? highlightScore(sentence, queryWords) : 0;
              const isHighlighted = score > 0;
              return (
                <span
                  key={i}
                  className={isHighlighted ? "rounded bg-[#f5c57a]/15 text-[#f5c57a]" : ""}
                >
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
