import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EmbeddingProvider } from "./types";

interface SettingsState {
  /** User-entered Gemini API key. Never hardcoded; lives only in localStorage. */
  geminiApiKey: string;
  /** Whether to prefer Gemini embeddings when a key is present. */
  useGemini: boolean;

  setGeminiApiKey: (key: string) => void;
  setUseGemini: (on: boolean) => void;
  /** The provider that should actually be used right now. */
  activeProvider: () => EmbeddingProvider;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      geminiApiKey: "",
      useGemini: false,

      setGeminiApiKey: (key) => set({ geminiApiKey: key.trim() }),
      setUseGemini: (on) => set({ useGemini: on }),

      activeProvider: () => {
        const { geminiApiKey, useGemini } = get();
        return useGemini && geminiApiKey.length > 0 ? "gemini" : "minilm";
      },
    }),
    {
      name: "probability-terrain-settings",
      // Only persist the durable preferences.
      partialize: (s) => ({ geminiApiKey: s.geminiApiKey, useGemini: s.useGemini }),
    }
  )
);

/** Non-reactive snapshot of the active provider + key, for use inside async store actions. */
export function getActiveEmbeddingConfig(): { provider: EmbeddingProvider; apiKey: string } {
  const s = useSettings.getState();
  return { provider: s.activeProvider(), apiKey: s.geminiApiKey };
}
