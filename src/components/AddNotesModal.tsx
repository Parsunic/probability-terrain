import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../store";

export function AddNotesModal({ onClose }: { onClose: () => void }) {
  const ingest = useAppStore((s) => s.ingest);
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fresh, setFresh] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n\n${content}` : content));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onSubmit = useCallback(() => {
    if (text.trim().length === 0) return;
    ingest(text, { fresh });
    onClose();
  }, [text, fresh, ingest, onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-[#0c0d12]/95 p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-light tracking-tight text-[#f0ece3]">Add to the terrain</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#7a756d] transition-colors hover:text-[#cfc9c0]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <p className="mb-5 text-sm font-light leading-relaxed text-[#9b958c]">
          Paste or drop notes — each paragraph becomes a new star, drawn toward the ideas it resembles.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Paste or drop your notes here (.txt or .md also welcome)…"
          className={`h-56 w-full resize-none rounded-xl border bg-white/[0.02] p-4 text-sm leading-relaxed text-[#e8e6e1] outline-none transition-colors placeholder:text-[#5c5750] focus:border-[#f5c57a]/40 ${
            isDragging ? "border-[#f5c57a]/60 bg-white/[0.04]" : "border-white/10"
          }`}
        />

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-[#cfc9c0] transition-colors hover:bg-white/[0.07]"
            >
              Upload .txt / .md
            </button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-[#9b958c]">
              <input
                type="checkbox"
                checked={fresh}
                onChange={(e) => setFresh(e.target.checked)}
                className="accent-[#f5c57a]"
              />
              Start a fresh terrain
            </label>
          </div>
          <button
            onClick={onSubmit}
            disabled={text.trim().length === 0}
            className="rounded-full bg-[#f5c57a]/90 px-6 py-2 text-sm font-medium text-[#1a1408] transition-all hover:bg-[#f5c57a] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {fresh ? "Build terrain" : "Add to terrain"}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
