import { useEffect } from "react";
import { OverlayPreview } from "../components/overlay/OverlayPreview";

// OBS browser source: transparent background. The CSS rule in index.css
// keys off body.overlay-route so only this route wipes the background.
export function OverlayRoute() {
  useEffect(() => {
    document.body.classList.add("overlay-route");
    return () => {
      document.body.classList.remove("overlay-route");
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <OverlayPreview />
    </div>
  );
}
