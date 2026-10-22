"use client";

import { useEffect, useState } from "react";
import { friendlyPushError, readPushState, subscribeThisBrowser, unsubscribeThisBrowser } from "@/lib/webPush";

/**
 * Shows whether browser notifications are on for this browser and lets the visitor turn them on or off.
 * (The permission question itself appears by itself while people browse: see AutoPushPrompt.)
 */
export default function EnableWebPush() {
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    readPushState()
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setState("off"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage("");
    try {
      const result = await subscribeThisBrowser({ prompt: true });
      if (result === "on") {
        setState("on");
        setMessage("Notifications are on. We will only send important political updates.");
      } else if (result === "denied") {
        setState("denied");
      } else {
        setMessage("Notifications were not allowed.");
      }
    } catch (error) {
      console.error("Web Push error:", error);
      setMessage(friendlyPushError(error));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage("");
    try {
      await unsubscribeThisBrowser();
      setState("off");
      setMessage("Notifications are off for this browser.");
    } catch (error) {
      console.error("Web Push error:", error);
      setMessage("Could not turn notifications off. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return <div className="h-24 animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />;

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface p-6 sm:p-8" aria-labelledby="web-push-heading">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <i className={`fa-solid ${state === "on" ? "fa-bell" : "fa-bell-slash"}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="web-push-heading" className="font-headline-md text-lg text-primary">Browser notifications</h2>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">
            {state === "unsupported" && "This browser cannot show notifications. On an iPhone, add this website to your Home Screen first, then open it from there."}
            {state === "denied" && "Notifications are blocked for this website. Allow them in your browser's site settings (the lock icon next to the address), then come back and try again."}
            {state === "on" && "This browser will show a notification for important political updates, even when the website is closed."}
            {state === "off" && "Get a notification for important political updates in this browser, even when the website is closed. You can turn it off any time."}
          </p>
          {(state === "off" || state === "on") && (
            <button
              type="button"
              onClick={state === "on" ? turnOff : turnOn}
              disabled={busy}
              className={`mt-4 rounded-lg px-5 py-2.5 font-label-md text-sm font-semibold transition-opacity disabled:opacity-60 ${state === "on" ? "border border-outline-variant/60 text-primary hover:border-primary" : "bg-primary text-on-primary hover:opacity-90"}`}
            >
              {busy ? "Please wait…" : state === "on" ? "Turn off notifications" : "Turn on notifications"}
            </button>
          )}
          {message && <p role="status" className="mt-3 font-body-md text-sm text-on-surface-variant">{message}</p>}
        </div>
      </div>
    </section>
  );
}
