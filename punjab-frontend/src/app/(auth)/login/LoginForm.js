"use client";

import { useTurnstile } from "@/hooks/useTurnstile";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthTextField from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { authApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PANEL_SITE_URL } from "@/lib/env";

export default function LoginForm({ nextPath = "/" }) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile({ action: "login" });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const completeLogin = useCallback((data) => {
    const role = data?.user?.role;
    setUser(data.user);
    const termsAccepted = data?.user?.termsAccepted === true || Number(data?.user?.termsAccepted) === 1;
    if (!termsAccepted) return;
    // Signing in on the public website keeps every role on the public
    // website. Staff reach their workspace only by explicitly opening the
    // separate panel.
    if (role === "INVESTOR") {
      window.location.assign(`${PANEL_SITE_URL}/author/dashboard`);
      return;
    }
    router.replace(nextPath);
  }, [nextPath, router, setUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login({ ...form, turnstileToken: turnstile.token });
      await completeLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      turnstile.reset();
    }
  };

  const handleGoogleCredential = useCallback(async (credential) => {
    setError("");
    setLoading(true);
    try {
      const data = await authApi.googleAuth({ credential, intent: "login" });
      await completeLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [completeLogin]);

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Access authoritative political discourse.."
      footer={
        <>
          <span className="text-on-surface-variant font-body-md">
            Don&apos;t have an account?
          </span>
          <Link
            href="/register"
            className="font-label-md text-primary hover:text-primary-container hover:underline ml-1 uppercase tracking-wide"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="mt-8 space-y-6">
        <GoogleAuthButton
          intent="login"
          disabled={loading}
          onCredential={handleGoogleCredential}
          onError={setError}
        />

        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-outline-variant/30" />
          <span className="font-label-sm text-xs uppercase tracking-widest text-on-surface-variant">or</span>
          <span className="h-px flex-1 bg-outline-variant/30" />
        </div>

        <div className="space-y-5 rounded-md">
          <AuthTextField
            id="email-address"
            name="email"
            label="Email Address"
            type="email"
            icon="fa-solid fa-envelope"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
          />
          <AuthPasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={handleChange}
          />
        </div>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="font-label-md text-sm text-primary hover:text-primary-container hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="text-sm text-error font-body-md" role="alert">
            {error}
          </p>
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
              {loading ? "Signing In..." : "Sign In"}
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
