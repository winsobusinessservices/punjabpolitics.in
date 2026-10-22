"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";

/**
 * A styled confirmation modal with a reason textarea — the same visual
 * pattern as ChangePasswordModal, reused here so "Delete" and "Send for
 * Changes" get a real form instead of the browser's native
 * confirm()/prompt() dialogs (which can't be styled and block the whole tab).
 *
 * `onConfirm` receives the trimmed reason (or undefined if left blank) and
 * is expected to return a promise; the modal shows its own loading/error
 * state and only closes itself on success — the caller doesn't need to.
 */
export default function ReasonModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  placeholder = "Add a reason...",
  required = false,
  danger = false,
}) {
  const mounted = useIsClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Resetting controlled modal fields when a new modal session opens is
      // intentional; the state belongs to the previous session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");
      setError("");
    }
  }, [open]);

  if (!mounted) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (required && !trimmed) {
      setError("Please add a reason.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onConfirm(trimmed || undefined);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Portaled to <body> for the same reason as ChangePasswordModal/MobileMenu
  // — escapes Header's backdrop-blur stacking context.
  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-[200] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 z-[210] w-full max-w-md transition-all duration-300 ${
          open ? "opacity-100 -translate-y-1/2" : "opacity-0 -translate-y-[45%] pointer-events-none"
        }`}
      >
        <div className="bg-surface-container-lowest rounded-lg shadow-2xl border border-outline-variant/20 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display-lg text-primary text-xl tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {description && <p className="font-body-md text-sm text-on-surface-variant mb-5">{description}</p>}

          <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="space-y-5">
            <div>
              <label htmlFor="reason-modal-textarea" className="block font-label-md text-xs text-on-surface-variant mb-1.5">
                Reason {required ? <span className="text-error">*</span> : <span className="opacity-60">(optional)</span>}
              </label>
              <textarea
                id="reason-modal-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={placeholder}
                rows={3}
                autoFocus
                className="w-full border border-outline-variant/40 bg-surface-container-low rounded px-3 py-2.5 text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none font-body-md transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-error font-body-md" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-outline-variant/40 text-on-surface py-2.5 font-label-md uppercase tracking-widest text-xs hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-2.5 font-label-md uppercase tracking-widest text-xs transition-colors disabled:opacity-60 ${
                  danger ? "bg-error text-on-error hover:bg-error/90" : "bg-primary text-on-primary hover:bg-primary-container"
                }`}
              >
                {loading ? "Working..." : confirmLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}
