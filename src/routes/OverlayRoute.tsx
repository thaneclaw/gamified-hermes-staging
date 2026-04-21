import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { OverlayPreview } from "../components/overlay/OverlayPreview";

// OBS browser source: transparent background. The CSS rule in index.css
// keys off body.overlay-route so only this route wipes the background.
//
// Pattern A (default): loads with the studio backdrop baked in, so you
// can point a single OBS browser source at /overlay and you're done.
// Pattern B (?transparent=1): drops the backdrop so effects, placards,
// arrows and MVP confetti render over VDO Ninja video feeds placed
// BELOW the browser source in OBS. See README / obs-scene.json.
export function OverlayRoute() {
  const [params] = useSearchParams();
  const transparent = params.get("transparent") === "1";

  useEffect(() => {
    document.body.classList.add("overlay-route");
    return () => {
      document.body.classList.remove("overlay-route");
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <OverlayPreview transparent={transparent} />
    </div>
  );
}
