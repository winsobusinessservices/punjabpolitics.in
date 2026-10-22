"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT } from "@/lib/toast";

const STYLE = {
  success: {
    icon: "fa-circle-check",
    border: "border-green-500",
    iconColor: "text-green-600",
    title: "Success",
  },
  error: {
    icon: "fa-circle-exclamation",
    border: "border-error",
    iconColor: "text-error",
    title: "Error",
  },
};

export default function ToastProvider() {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function handleToast(event) {
      const detail = event.detail || {};
      if (!detail.message) return;

      clearTimeout(timeoutRef.current);
      setToast({
        id: Date.now(),
        type: detail.type === "error" ? "error" : "success",
        message: detail.message,
      });
      timeoutRef.current = setTimeout(() => setToast(null), detail.type === "error" ? 6000 : 4000);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!toast) return null;
  const appearance = STYLE[toast.type];

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[10000] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6" aria-live="polite" aria-atomic="true">
      <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-xl border-l-4 ${appearance.border} bg-surface p-4 text-on-surface shadow-xl ring-1 ring-black/5 animate-[toast-in_200ms_ease-out]`}>
        <i className={`fa-solid ${appearance.icon} ${appearance.iconColor} mt-0.5 text-xl`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-label-md text-sm font-bold">{appearance.title}</p>
          <p className="mt-0.5 break-words font-body-md text-sm text-on-surface-variant">{toast.message}</p>
        </div>
        <button type="button" onClick={() => setToast(null)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface" aria-label="Dismiss notification">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
