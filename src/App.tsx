import { useEffect } from "react";
import { useAppStore } from "./store";
import { Terrain } from "./components/Terrain";
import { SearchBar } from "./components/SearchBar";
import { NodePanel } from "./components/NodePanel";
import { TopControls } from "./components/TopControls";
import { WorkingOverlay } from "./components/WorkingOverlay";
import { ErrorToast } from "./components/ErrorToast";
import { preloadEmbeddingModel } from "./lib/embeddings";

function App() {
  const loadSample = useAppStore((s) => s.loadSample);
  const setModelReady = useAppStore((s) => s.setModelReady);

  useEffect(() => {
    // Boot straight into a living terrain from precomputed sample embeddings,
    // then warm the in-browser model in the background for the first search.
    loadSample();
    let alive = true;
    preloadEmbeddingModel()
      .then(() => alive && setModelReady(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loadSample, setModelReady]);

  return (
    <div className="absolute inset-0">
      <Terrain />
      <SearchBar />
      <NodePanel />
      <TopControls />
      <WorkingOverlay />
      <ErrorToast />
    </div>
  );
}

export default App;
