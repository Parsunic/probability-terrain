import { useSettings } from "../settings";
import { useAppStore } from "../store";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const geminiApiKey = useSettings((s) => s.geminiApiKey);
  const useGemini = useSettings((s) => s.useGemini);
  const setGeminiApiKey = useSettings((s) => s.setGeminiApiKey);
  const setUseGemini = useSettings((s) => s.setUseGemini);

  const modelReady = useAppStore((s) => s.modelReady);
  const datasetProvider = useAppStore((s) => s.datasetProvider);
  const loadSample = useAppStore((s) => s.loadSample);
  const clearTerrain = useAppStore((s) => s.clearTerrain);

  const activeProvider = useGemini && geminiApiKey.length > 0 ? "gemini" : "minilm";

  return (
    <>
      {open && <div className="absolute inset-0 z-40 bg-black/30" onClick={onClose} />}
      <div
        className={`absolute right-0 top-0 z-[45] h-full w-[380px] border-l border-white/5 bg-[#0b0c10]/95 backdrop-blur-md transition-transform duration-500 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-lg font-light tracking-tight text-[#f0ece3]">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="text-[#7a756d] transition-colors hover:text-[#cfc9c0]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {/* Embeddings provider */}
            <section className="mb-8">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#7a756d]">Embeddings</h3>
              <p className="mb-4 text-sm font-light leading-relaxed text-[#9b958c]">
                By default everything runs on a local in-browser model — no key, no network. Add a Gemini key for
                higher-fidelity embeddings.
              </p>

              <label className="mb-2 block text-xs text-[#9b958c]">Gemini API key</label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Paste your Gemini API key…"
                autoComplete="off"
                spellCheck={false}
                className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-[#e8e6e1] outline-none transition-colors placeholder:text-[#5c5750] focus:border-[#f5c57a]/40"
              />

              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-[#cfc9c0]">
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => setUseGemini(e.target.checked)}
                  disabled={geminiApiKey.length === 0}
                  className="accent-[#f5c57a] disabled:opacity-40"
                />
                Use Gemini embeddings
              </label>

              <div className="mt-4 space-y-1.5 rounded-lg border border-white/5 bg-white/[0.015] px-3.5 py-3 text-xs text-[#7a756d]">
                <StatusRow label="Active provider" value={activeProvider === "gemini" ? "Gemini" : "Local (MiniLM)"} hot={activeProvider === "gemini"} />
                <StatusRow label="Graph embedded with" value={datasetProvider === "gemini" ? "Gemini" : "Local (MiniLM)"} />
                <StatusRow
                  label="Local model"
                  value={modelReady ? "ready" : "warming up…"}
                  hot={modelReady}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#5c5750]">
                Your key is stored only in this browser and never leaves it except to call Gemini directly.
              </p>
            </section>

            {/* Terrain controls */}
            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#7a756d]">Terrain</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    loadSample();
                    onClose();
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-left text-sm text-[#cfc9c0] transition-colors hover:bg-white/[0.06]"
                >
                  Reset to sample terrain
                </button>
                <button
                  onClick={() => {
                    clearTerrain();
                    onClose();
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-left text-sm text-[#cfc9c0] transition-colors hover:bg-white/[0.06]"
                >
                  Clear the terrain
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusRow({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={hot ? "text-[#f5c57a]" : "text-[#9b958c]"}>{value}</span>
    </div>
  );
}
