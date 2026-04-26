import { Route, Routes } from "react-router-dom";

// Routing model (MVP scaffold — real implementations land in later phases):
//   /play       guest/host wrapper around the VDO.Ninja iframe (Phase 4)
//   /overlay    transparent OBS browser source that renders animations (Phase 5)
//   /producer   dockable panel: roster, reset cards, calibration (Phase 6)
export default function App() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0a0a" }}>
      <Routes>
        <Route path="/" element={<div>Gamified — pick a route: /play, /overlay, /producer</div>} />
        <Route path="/play" element={<div>TODO</div>} />
        <Route path="/overlay" element={<div>TODO</div>} />
        <Route path="/producer" element={<div>TODO</div>} />
      </Routes>
    </div>
  );
}
