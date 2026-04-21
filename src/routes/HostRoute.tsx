import { BackButton } from "../components/shared/BackButton";
import { ShowSetupView } from "../components/producer/ShowSetupView";

// The Host surface is a clone of Show Setup — same rundown, overlay
// preview, timer, and chat column — but scoped to the "host" chat
// role so backstage messages land in the host feed.
export function HostRoute() {
  return (
    <>
      <BackButton />
      <ShowSetupView role="host" />
    </>
  );
}
