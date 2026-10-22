import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True once hydrated on the client, false during SSR and the first client
 * render. Used to gate anything that can only be computed in the browser
 * (clock, geolocation, portals) without a hydration mismatch.
 *
 * Deliberately not `useState(false) + useEffect(() => setMounted(true))` —
 * that's a synchronous setState-in-effect, which react-hooks/set-state-in-effect
 * flags as a cascading-render risk. useSyncExternalStore reconciles the
 * server/client snapshot difference during hydration itself, so there's no
 * separate effect-driven render to warn about.
 */
export function useIsClient() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
