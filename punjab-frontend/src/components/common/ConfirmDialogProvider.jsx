"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";

const ConfirmDialogContext = createContext(null);

export function useConfirmDialog() {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  return confirm;
}

export default function ConfirmDialogProvider({ children }) {
  const mounted = useIsClient();
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setDialog(typeof options === "string" ? { description: options } : options);
  }), []);

  const finish = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog, finish]);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {mounted && dialog && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]" onClick={() => finish(false)} aria-label="Close confirmation" />
          <section className="relative z-10 w-full max-w-md rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-2xl sm:p-7" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${dialog.danger === false ? "bg-primary/10 text-primary" : "bg-error-container text-error"}`}>
              <i className={`fa-solid ${dialog.icon || "fa-trash-can"} text-lg`} aria-hidden="true" />
            </div>
            <h2 id="confirm-dialog-title" className="font-display-lg text-xl text-primary">{dialog.title || (dialog.danger === false ? "Confirm action" : "Confirm deletion")}</h2>
            <p id="confirm-dialog-description" className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">{dialog.description || (dialog.danger === false ? "Are you sure you want to continue?" : "Are you sure you want to delete this item? This action cannot be undone.")}</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => finish(false)} autoFocus className="rounded-lg border border-outline-variant/50 px-5 py-2.5 font-label-md text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container">{dialog.cancelLabel || "Cancel"}</button>
              <button type="button" onClick={() => finish(true)} className={`rounded-lg px-5 py-2.5 font-label-md text-sm font-semibold transition-opacity hover:opacity-90 ${dialog.danger === false ? "bg-primary text-on-primary" : "bg-error text-on-error"}`}>
                <i className={`fa-solid ${dialog.icon || "fa-trash-can"} mr-2 text-xs`} aria-hidden="true" />{dialog.confirmLabel || (dialog.danger === false ? "Confirm" : "Delete")}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </ConfirmDialogContext.Provider>
  );
}
