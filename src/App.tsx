import { Route, Routes } from "react-router-dom";
import { OverlayRoute } from "./routes/OverlayRoute";
import { PlayRoute } from "./routes/PlayRoute";
import { ProducerRoute } from "./routes/ProducerRoute";

// Routing model:
//   /play       guest/host wrapper around the VDO.Ninja iframe
//   /overlay    transparent OBS browser source that renders animations
//   /producer   dockable panel: roster, reset cards, calibration, activity feed
//
// No background here — the global default lives in src/index.css on
// html/body/#root, and /overlay overrides it via `body.overlay-route`.
// Painting #0a0a0a inline on this wrapper would sit on top of the
// overlay route's transparent surface and break the OBS composite.
export default function App() {
  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route path="/" element={<div>Gamified — pick a route: /play, /overlay, /producer</div>} />
        <Route path="/play" element={<PlayRoute />} />
        <Route path="/overlay" element={<OverlayRoute />} />
        <Route path="/producer" element={<ProducerRoute />} />
      </Routes>
    </div>
  );
}
