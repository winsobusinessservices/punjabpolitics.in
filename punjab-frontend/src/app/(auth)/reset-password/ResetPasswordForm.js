"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import { authApi } from "@/lib/api";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Missing or invalid reset link. Please request a new one.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: form.newPassword });
      setSuccess("Password reset successful. Redirecting to sign in...");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Choose a new password for your account."
      footer={
        <>
          <span className="text-on-surface-variant font-body-md">Remembered it?</span>
          <Link
            href="/login"
            className="font-label-md text-primary hover:text-primary-container hover:underline ml-1 uppercase tracking-wide"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {!token && (
        <p className="mt-8 text-sm text-error font-body-md" role="alert">
          This reset link is missing its token. Please{" "}
          <Link href="/forgot-password" className="underline">
            request a new one
          </Link>
          .
        </p>
      )}

      <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="mt-8 space-y-6">
        <div className="space-y-5">
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
          <AuthPasswordField
            id="confirm-password"
            name="confirmPassword"
            label="Confirm New Password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={handleChange}
          />
        </div>

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

        <div>
          <button
            type="submit"
            disabled={loading || !token}
            className="group relative flex w-full justify-center bg-primary py-3 px-4 font-label-md text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 uppercase tracking-widest overflow-hidden disabled:opacity-60"
          >
            <span className="absolute inset-0 w-full h-full -mt-1 opacity-30 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
            <span className="relative flex items-center gap-2">
              {loading ? "Resetting..." : "Reset Password"}
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
