"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isAuthPath, useCookieConsent } from "@/lib/cookieConsent";
import { PUBLIC_VAPID_KEY } from "@/lib/env";
import { pushSupported, readPushState, subscribeThisBrowser } from "@/lib/webPush";

const ASKED_KEY = "push-permission-asked-at";
const SYNCED_KEY = "push-synced";
const FIRST_ASK_AFTER_MS = 8000; // time on the website before the question may appear
const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;

const read = (key) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* just not remembered */ } };

/**
 * Asks for permission to show browser notifications, by itself, while someone is using the website. It never
 * renders anything: the question is the browser's own permission prompt.
 *
 * Browsers punish websites that ask too eagerly (Chrome starts hiding the prompt for sites people keep
 * dismissing; Firefox and Safari ignore a prompt that is not triggered by a click). So it asks:
 *   - only after the visitor has answered the cookie question,
 *   - after they have been on the website a few seconds AND click or tap something (the click is what lets
 *     every browser show the prompt),
 *   - never while another pop-up is open, and never on sign-in or policy pages,
 *   - once, then not again for 30 days if they ignore or dismiss it,
 *   - never again if they block it (the "turn on" card on My Interests is still there).
 * When permission was already given it just keeps the subscription in order (no prompt): it is re-saved
 * once a day and again after someone signs in, so the browser gets linked to their account.
 */
export default function AutoPushPrompt() {
  const consent = useCookieConsent();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading || !PUBLIC_VAPID_KEY || !pushSupported()) return undefined;
    if (consent !== "accepted" && consent !== "rejected") return undefined;
    if (isAuthPath(pathname) || pathname.startsWith("/policies")) return undefined;

    let cancelled = false;
    let stopListening = () => {};

    (async () => {
      const state = await readPushState();
      if (cancelled || state === "denied" || state === "unsupported") return;

      // Already allowed: no prompt, just keep the saved subscription current.
      if (state === "on" || Notification.permission === "granted") {
        const identity = String(userId ?? "anonymous");
        const [savedFor, savedAt] = String(read(SYNCED_KEY) || "").split("|");
        if (savedFor === identity && Date.now() - Number(savedAt) < SYNC_EVERY_MS) return;
        write(SYNCED_KEY, `${identity}|${Date.now()}`);
        subscribeThisBrowser({ prompt: false }).catch((error) => console.warn("Web Push:", error.message));
        return;
      }

      // Not answered yet. Do not pester someone who ignored or dismissed it recently.
      if (Date.now() - Number(read(ASKED_KEY) || 0) < ASK_AGAIN_AFTER_MS) return;

      const onGesture = () => {
        // performance.now() counts from when the website was opened, so moving between pages does not restart the wait.
        if (performance.now() < FIRST_ASK_AFTER_MS) return;
        if (document.querySelector("dialog[open]")) return; // another pop-up is on screen
        stopListening();
        write(ASKED_KEY, String(Date.now()));
        subscribeThisBrowser({ prompt: true }).catch((error) => console.warn("Web Push:", error.message));
      };
      window.addEventListener("pointerup", onGesture, { passive: true });
      window.addEventListener("keydown", onGesture, { passive: true });
      stopListening = () => {
        window.removeEventListener("pointerup", onGesture);
        window.removeEventListener("keydown", onGesture);
      };
    })().catch(() => {});

    return () => {
      cancelled = true;
      stopListening();
    };
  }, [consent, pathname, userId, loading]);

  return null;
}
