import { Route, Routes } from "react-router-dom";
import { OverlayRoute } from "./routes/OverlayRoute";
import { PlayRoute } from "./routes/PlayRoute";

// Routing model (MVP scaffold — /producer lands in Phase 6):
//   /play       guest/host wrapper around the VDO.Ninja iframe
//   /overlay    transparent OBS browser source that renders animations
//   /producer   dockable panel: roster, reset cards, calibration (Phase 6)
export default function App() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0a0a" }}>
      <Routes>
        <Route path="/" element={<div>Gamified — pick a route: /play, /overlay, /producer</div>} />
        <Route path="/play" element={<PlayRoute />} />
        <Route path="/overlay" element={<OverlayRoute />} />
        <Route path="/producer" element={<div>TODO</div>} />
      </Routes>
    </div>
  );
}
