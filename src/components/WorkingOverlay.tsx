import { useAppStore } from "../store";

/** A quiet veil shown over the live terrain while notes are embedded or re-embedded. */
export function WorkingOverlay() {
  const isWorking = useAppStore((s) => s.isWorking);
  const workingMessage = useAppStore((s) => s.workingMessage);

  if (!isWorking) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#08090c]/55 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-end gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[#f5c57a]"
              style={{ animation: `terrain-pulse 1.2s ease-in-out ${i * 0.12}s infinite` }}
            />
          ))}
        </div>
        <p className="text-sm font-light tracking-wide text-[#cfc9c0]">{workingMessage}</p>
      </div>
    </div>
  );
}
