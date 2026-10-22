"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise = null;
function loadTurnstile() {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile needs a browser"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Turnstile could not be loaded"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile bot check for a form.
 *
 *   const turnstile = useTurnstile();
 *   ...send { ...payload, turnstileToken: turnstile.token }, then call turnstile.reset() (tokens are single-use)
 *   ...render {turnstile.widget} above the submit button and disable it until turnstile.ready
 *
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set the check is switched off: the widget renders nothing
 * and `ready` is always true (the backend skips verification when its secret key is not set either).
 */
export function useTurnstile({ action } = {}) {
  const enabled = Boolean(SITE_KEY);
  const [container, setContainer] = useState(null);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState("");
  const widgetId = useRef(null);

  useEffect(() => {
    if (!enabled || !container) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId.current = turnstile.render(container, {
          sitekey: SITE_KEY,
          action,
          size: "flexible",
          theme: "auto",
          callback: (value) => { setToken(value); setLoadError(""); },
          "expired-callback": () => setToken(""),
          "timeout-callback": () => setToken(""),
          "error-callback": () => { setToken(""); setLoadError("The security check failed to load. Refresh the page and try again."); },
        });
      })
      .catch((error) => { if (!cancelled) setLoadError(error.message); });
    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* already removed */ }
      }
      widgetId.current = null;
    };
  }, [enabled, container, action]);

  const reset = useCallback(() => {
    setToken("");
    if (widgetId.current !== null && window.turnstile) {
      try { window.turnstile.reset(widgetId.current); } catch { /* widget gone */ }
    }
  }, []);

  const widget = enabled ? (
    <div className="my-1 w-full">
      <div ref={setContainer} className="w-full" />
      {loadError && <p className="mt-1 text-xs text-error" role="alert">{loadError}</p>}
    </div>
  ) : null;

  return { enabled, ready: !enabled || Boolean(token), token, reset, widget };
}
