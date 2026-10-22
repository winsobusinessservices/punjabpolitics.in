import { pushApi } from "@/lib/api";

// Browser notifications ("Browser notification" channel in the My interests survey).
// Needs: /sw.js (public folder), NEXT_PUBLIC_VAPID_PUBLIC_KEY (same value as the server's VAPID_PUBLIC_KEY),
// and the server's /push/subscribe endpoint. Browsers only allow this on https:// (or localhost).

const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
}

// The browser wants the public key as bytes, not as text.
function keyToBytes(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing || navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => navigator.serviceWorker.ready);
}

/**
 * Subscribes this browser and tells the server about it.
 * With { prompt: true } the browser may ask the reader for permission.
 * Resolves "granted", "denied", "default" (the reader closed the prompt) or "unsupported".
 */
export async function subscribeThisBrowser({ prompt = false } = {}) {
  if (!pushSupported()) return "unsupported";

  let permission = Notification.permission;
  if (permission === "default" && prompt) permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const worker = await registration();
  const subscription = (await worker.pushManager.getSubscription())
    || (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  await pushApi.subscribe(subscription.toJSON());
  return "granted";
}

/** Stops notifications in this browser (called when the reader unticks the browser channel). */
export async function unsubscribeThisBrowser() {
  if (!pushSupported()) return;
  try {
    const worker = await navigator.serviceWorker.getRegistration("/");
    const subscription = await worker?.pushManager.getSubscription();
    if (!subscription) return;
    await pushApi.unsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    /* nothing to undo */
  }
}

export function friendlyPushError(error) {
  const message = String(error?.message || "");
  if (/denied|permission/i.test(message)) return "Your browser has blocked notifications for this website. Click the lock icon next to the address bar and allow notifications.";
  return "Notifications could not be switched on in this browser. Your interests were still saved.";
}
