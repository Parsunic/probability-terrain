import { useAppStore } from "../store";

export function ErrorToast() {
  const errorMessage = useAppStore((s) => s.errorMessage);
  const dismissError = useAppStore((s) => s.dismissError);

  if (!errorMessage) return null;

  return (
    <div className="absolute left-1/2 top-6 z-50 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-red-400/20 bg-[#1a1012]/95 px-4 py-3 text-sm text-[#e8d6d0] shadow-xl backdrop-blur-sm">
      <span className="mt-0.5 text-red-400/80">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16.5" x2="12" y2="16.5" />
        </svg>
      </span>
      <span className="flex-1 font-light leading-relaxed">{errorMessage}</span>
      <button
        onClick={dismissError}
        aria-label="Dismiss"
        className="text-[#9b8a86] transition-colors hover:text-[#e8d6d0]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
