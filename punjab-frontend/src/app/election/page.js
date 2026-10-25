import { permanentRedirect } from "next/navigation";

// Common typo/short form of /elections.
export default function ElectionRedirect() {
  permanentRedirect("/elections");
}
