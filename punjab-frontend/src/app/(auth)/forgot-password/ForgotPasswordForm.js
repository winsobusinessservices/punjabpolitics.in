"use client";

import { useTurnstile } from "@/hooks/useTurnstile";
import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import AuthTextField from "@/components/auth/AuthTextField";
import { authApi } from "@/lib/api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile({ action: "forgot_password" });



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetToken("");
    setLoading(true);

    try {
      const data = await authApi.forgotPassword({ email: email.trim(), turnstileToken: turnstile.token });
      setMessage(data.message);
      
      if (data.resetToken) setResetToken(data.resetToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      turnstile.reset();
    }
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Enter your email and we'll send you a link to reset your password."
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
      <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="mt-8 space-y-6">
        <AuthTextField
          id="email-address"
          name="email"
          label="Email Address"
          type="email"
          icon="fa-solid fa-envelope"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <p className="text-sm text-error font-body-md" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-primary font-body-md" role="status">
            {message}
          </p>
        )}
        {resetToken && (
          <div className="text-sm font-body-md bg-surface-container p-4 rounded border border-outline-variant/20">
            <p className="text-on-surface-variant mb-2">
              No email service is configured in this environment, so here&apos;s your reset link directly:
            </p>
            <Link
              href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
              className="font-label-md text-primary hover:underline break-all"
            >
              Reset your password →
            </Link>
          </div>
        )}

        <div>
          {turnstile.widget}
          <button
            type="submit"
            disabled={loading || !turnstile.ready}
            className="group relative flex w-full justify-center bg-primary py-3 px-4 font-label-md text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 uppercase tracking-widest overflow-hidden disabled:opacity-60"
          >
            <span className="absolute inset-0 w-full h-full -mt-1 opacity-30 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
            <span className="relative flex items-center gap-2">
              {loading ? "Sending..." : "Send Reset Link"}
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
