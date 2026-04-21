import { BackButton } from "../components/shared/BackButton";
import { ShowSetupView } from "../components/producer/ShowSetupView";

export function ProducerRoute() {
  return (
    <>
      <BackButton />
      <ShowSetupView role="producer" />
    </>
  );
}
