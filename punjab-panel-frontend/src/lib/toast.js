export const TOAST_EVENT = "punjab-politics:toast";

export function showToast(message, type = "success") {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}
