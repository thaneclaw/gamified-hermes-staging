import { Route, Routes } from "react-router-dom";
import { ContestantRoute } from "./routes/ContestantRoute";
import { HostRoute } from "./routes/HostRoute";
import { LoginRoute } from "./routes/LoginRoute";
import { OverlayRoute } from "./routes/OverlayRoute";
import { ProducerRoute } from "./routes/ProducerRoute";

// Routing model:
//   /          login — pick your seat (host, producer, or contestant)
//   /host      Show Setup scoped to the host chat role
//   /producer  Show Setup scoped to the producer chat role
//   /contestant?id=<id>   phone UI for a single contestant
//   /overlay   bare OBS browser-source view (no chrome)
//
// All crew + contestant surfaces drop their header chrome and expose a
// single back link to /. Only /overlay is truly bare.
export default function App() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0a0a" }}>
      <Routes>
        <Route path="/" element={<LoginRoute />} />
        <Route path="/host" element={<HostRoute />} />
        <Route path="/producer" element={<ProducerRoute />} />
        <Route path="/contestant" element={<ContestantRoute />} />
        <Route path="/overlay" element={<OverlayRoute />} />
      </Routes>
    </div>
  );
}
