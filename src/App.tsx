import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "./store";
import { Terrain } from "./components/Terrain";
import { SearchBar } from "./components/SearchBar";
import { NodePanel } from "./components/NodePanel";
import { TopControls } from "./components/TopControls";
import { WorkingOverlay } from "./components/WorkingOverlay";
import { ErrorToast } from "./components/ErrorToast";
import { LaunchPage } from "./components/LaunchPage";
import { preloadEmbeddingModel } from "./lib/embeddings";

function App() {
  const loadSample = useAppStore((s) => s.loadSample);
  const setModelReady = useAppStore((s) => s.setModelReady);
  const selectNode = useAppStore((s) => s.selectNode);

  // Tiny router: the app lives at "/"; "/launch" overlays the pitch screen. The
  // terrain is always mounted so it's alive (and cursor-reactive) behind launch.
  const [path, setPath] = useState(() => window.location.pathname);
  const showLaunch = path === "/launch" || path === "/launch/";

  useEffect(() => {
    loadSample();
    let alive = true;
    preloadEmbeddingModel()
      .then(() => alive && setModelReady(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loadSample, setModelReady]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const enterApp = useCallback(() => {
    selectNode(null); // discard any stray click made behind the scrim
    window.history.pushState({}, "", "/");
    setPath("/");
  }, [selectNode]);

  return (
    <div className="absolute inset-0">
      <Terrain />

      {showLaunch ? (
        <LaunchPage onEnter={enterApp} />
      ) : (
        <>
          <div className="absolute left-6 top-6 z-40 select-none text-sm font-light tracking-[0.22em] text-[#cfc9c0]/40">
            MINDSCAPE
          </div>
          <SearchBar />
          <NodePanel />
          <TopControls />
          <WorkingOverlay />
          <ErrorToast />
        </>
      )}
    </div>
  );
}

export default App;
