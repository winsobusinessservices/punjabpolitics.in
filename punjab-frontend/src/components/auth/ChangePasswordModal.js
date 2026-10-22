"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import { authApi } from "@/lib/api";

export default function ChangePasswordModal({ open, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Portals can only be rendered after the browser document is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      // Each opening starts with a clean password form and feedback state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ currentPassword: "", newPassword: "" });
      setError("");
      setSuccess("");
    }
  }, [open]);

  if (!mounted) return null;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await authApi.changePassword(form);
      setSuccess("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Portaled to <body> for the same reason as MobileMenu — escapes Header's
  // backdrop-blur stacking context so the overlay reliably paints on top.
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display-lg text-primary text-xl tracking-tight">Change Password</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="space-y-5">
            <AuthPasswordField
              id="current-password"
              name="currentPassword"
              label="Current Password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={handleChange}
            />
            <AuthPasswordField
              id="new-password"
              name="newPassword"
              label="New Password"
              autoComplete="new-password"
              required
              value={form.newPassword}
              onChange={handleChange}
              showStrength
            />

            {error && (
              <p className="text-sm text-error font-body-md" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-primary font-body-md" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3 font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}
