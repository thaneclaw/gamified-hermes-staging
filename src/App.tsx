import { Route, Routes } from "react-router-dom";
import { OverlayRoute } from "./routes/OverlayRoute";
import { PlayRoute } from "./routes/PlayRoute";
import { ProducerRoute } from "./routes/ProducerRoute";

// Routing model:
//   /play       guest/host wrapper around the VDO.Ninja iframe
//   /overlay    transparent OBS browser source that renders animations
//   /producer   dockable panel: roster, reset cards, calibration, activity feed
export default function App() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0a0a" }}>
      <Routes>
        <Route path="/" element={<div>Gamified — pick a route: /play, /overlay, /producer</div>} />
        <Route path="/play" element={<PlayRoute />} />
        <Route path="/overlay" element={<OverlayRoute />} />
        <Route path="/producer" element={<ProducerRoute />} />
      </Routes>
    </div>
  );
}
