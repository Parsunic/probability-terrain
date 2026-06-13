import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../store";
import { useSettings } from "../settings";

// Minimal surface of the Web Speech API we rely on; not in lib.dom.d.ts.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

const SpeechRecognitionCtor: (new () => SpeechRecognitionLike) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
    .SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

const DEBOUNCE_MS = 450;

export function SearchBar() {
  const runSearch = useAppStore((s) => s.runSearch);
  const clearSearch = useAppStore((s) => s.clearSearch);
  const isSearching = useAppStore((s) => s.isSearching);
  const modelReady = useAppStore((s) => s.modelReady);
  const setError = useAppStore((s) => s.setError);
  const query = useAppStore((s) => s.query);
  const useGemini = useSettings((s) => s.useGemini);
  const geminiApiKey = useSettings((s) => s.geminiApiKey);

  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const debounceRef = useRef<number | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const usingGemini = useGemini && geminiApiKey.length > 0;
  const warming = !modelReady && !usingGemini;

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (value.trim()) runSearch(value);
        else clearSearch();
      }, DEBOUNCE_MS);
    },
    [runSearch, clearSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // Mirror store-driven query changes (Find similar, clear, add-notes) into the
  // input so the box always reflects the active search and stays clearable.
  useEffect(() => {
    setText(query);
  }, [query]);

  const clear = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setText("");
    clearSearch();
  }, [clearSearch]);

  const toggleListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Voice streams to Google's servers — it's the one feature that needs a
    // connection while everything else runs offline. Fail loud, not silent.
    if (!navigator.onLine) {
      setError("Voice needs an internet connection — type your description below instead.");
      textInputRef.current?.focus();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(transcript);
      scheduleSearch(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setIsListening(false);
      const code = e?.error;
      if (code === "network") {
        setError("Voice needs an internet connection — type your description below instead.");
        textInputRef.current?.focus();
      } else if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access is blocked — allow it, or type your description below.");
        textInputRef.current?.focus();
      } else if (code && code !== "no-speech" && code !== "aborted") {
        setError("Voice input isn't available right now — type your description below instead.");
        textInputRef.current?.focus();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, scheduleSearch, setError]);

  return (
    <div className="pointer-events-none absolute bottom-10 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-4">
      {/* Query echo — the spoken thought, floating above the controls. */}
      <div className="flex h-8 items-end">
        <p
          className={`max-w-xl text-center text-lg font-light tracking-wide text-[#f0ece3]/80 transition-opacity duration-500 ${
            isListening || text ? "opacity-100" : "opacity-0"
          }`}
        >
          {text || (isListening ? "Listening…" : "")}
        </p>
      </div>

      {SpeechRecognitionCtor && (
        <button
          onClick={toggleListening}
          aria-label={isListening ? "Stop listening" : "Start voice search"}
          className={`pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300 ${
            isListening
              ? "border-[#f5c57a]/60 bg-[#f5c57a]/15 shadow-[0_0_30px_rgba(245,197,122,0.25)]"
              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
          }`}
        >
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full border border-[#f5c57a]/40" style={{ animation: "mic-ring 1.8s ease-out infinite" }} />
              <span className="absolute inset-0 rounded-full border border-[#f5c57a]/40" style={{ animation: "mic-ring 1.8s ease-out 0.9s infinite" }} />
            </>
          )}
          <MicIcon active={isListening} />
        </button>
      )}

      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <div className="relative">
          <input
            ref={textInputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              scheduleSearch(e.target.value);
            }}
            placeholder={
              SpeechRecognitionCtor
                ? "Or type a vague description of what you're looking for…"
                : "Describe what you're looking for…"
            }
            className="w-[440px] rounded-full border border-white/10 bg-white/[0.02] px-5 py-2.5 text-center text-sm text-[#e8e6e1] outline-none transition-colors placeholder:text-[#5c5750] focus:border-[#f5c57a]/30"
          />
          {text.length > 0 && (
            <button
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#7a756d] transition-colors hover:bg-white/[0.06] hover:text-[#cfc9c0]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <span className="h-4 text-xs text-[#7a756d]">
          {warming ? "warming up the model…" : isSearching ? "searching the terrain…" : ""}
        </span>
      </div>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#f5c57a" : "#cfc9c0"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
