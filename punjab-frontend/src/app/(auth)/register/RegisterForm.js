"use client";

import { useTurnstile } from "@/hooks/useTurnstile";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthTextField from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { authApi, policiesApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function RegisterForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile({ action: "register" });
  const [step, setStep] = useState("details");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");

  const [registrationPolicies, setRegistrationPolicies] = useState([]);

  useEffect(() => {
    policiesApi.listForRegistration()
      .then((data) => setRegistrationPolicies(data.policies || []))
      .catch(() => setRegistrationPolicies([]));
  }, []);

  const consentPolicies = registrationPolicies.length > 0
    ? registrationPolicies.map((policy) => ({ id: policy.id, title: policy.title, href: `/policies/${policy.slug}` }))
    : [
      // { id: "terms", title: "Terms of Service", href: "/policies/terms-of-service" },
      { id: "privacy", title: "Privacy Policy", href: "/policies/privacy-policy" },
    ];


  // Keep the page the reader came from (for example /subscription) through sign-up and sign-in.
  const loginUrl = () => {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    return next.startsWith("/") && !next.startsWith("//") ? `/login?next=${encodeURIComponent(next)}` : "/login";
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (step === "details" && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (step === "details" && !STRONG_PASSWORD_REGEX.test(form.password)) {
      setError("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.");
      return;
    }

    if (step === "details" && !agreedToTerms) {
      setError("You must accept the Privacy Policy to create an account.");
      return;
    }

    setLoading(true);


    try {
      if (step === "details") {
        const data = await authApi.requestRegistrationOtp({
          turnstileToken: turnstile.token,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          agreeToTerms: agreedToTerms,
          acceptedPolicyIds: registrationPolicies.map((policy) => policy.id),
        });
        setChallengeToken(data.challengeToken);
        setOtp("");
        setStep("otp");
        setSuccess(`A six-digit verification code was sent to ${form.email.trim()}.`);
        return;
      }

      const verified = await authApi.verifyRegistrationOtp({
        email: form.email.trim(),
        otp,
        challengeToken,
      });
      await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        agreeToTerms: agreedToTerms,
        acceptedPolicyIds: registrationPolicies.map((policy) => policy.id),
        verificationToken: verified.verificationToken,
      });
      setSuccess("Account created successfully. Redirecting to sign in...");
      setTimeout(() => router.push(loginUrl()), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      turnstile.reset();
    }
  };

  const resendOtp = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await authApi.requestRegistrationOtp({
        turnstileToken: turnstile.token,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeToTerms: agreedToTerms,
        acceptedPolicyIds: registrationPolicies.map((policy) => policy.id),
      });
      setChallengeToken(data.challengeToken);
      setOtp("");
      setSuccess("A new verification code was sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      turnstile.reset();
    }
  };

  const changeEmail = () => {
    setStep("details");
    setForm((current) => ({ ...current, email: "" }));
    setOtp("");
    setChallengeToken("");
    setError("");
    setSuccess("");
  };

  const handleGoogleCredential = useCallback(async (credential) => {
    setError("");
    setSuccess("");
    if (!agreedToTerms) {
      setError("Please accept the privacy policy before continuing with Google.");
      return;
    }

    setLoading(true);
    try {
      await authApi.googleAuth({
        credential,
        intent: "register",
        agreeToTerms: true,
        acceptedPolicyIds: registrationPolicies.map((policy) => policy.id),
      });
      await refreshUser();
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agreedToTerms, refreshUser, router, registrationPolicies]);

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join the definitive chronicle of Indian political discourse."
      footer={
        <>
          <div>
            <span className="text-on-surface-variant font-body-md">
              Already have an account?
            </span>
            <Link
              href="/login"
              className="font-label-md text-primary hover:text-primary-container hover:underline ml-1 uppercase tracking-wide"
            >
              Sign in instead
            </Link>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit} inert={loading} aria-busy={loading} className="mt-8 space-y-6">
        {step === "details" && (
          <>
            <div className="space-y-5 rounded-md">
              <AuthTextField
                id="full-name"
                name="name"
                label="Full Name"
                icon="fa-solid fa-user"
                autoComplete="name"
                required
                value={form.name}
                onChange={handleChange}
              />
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
                autoComplete="new-password"
                required
                value={form.password}
                onChange={handleChange}
                showStrength
              />
              <div className="mt-4">
                <AuthPasswordField
                  id="confirm-password"
                  name="confirmPassword"
                  label="Confirm Password"
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
              </div>
              <label className="flex items-start gap-3 text-sm leading-6 text-on-surface-variant">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  required
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  I have read and agree to the{" "}
                  {consentPolicies.map((policy, index) => (
                    <span key={policy.id}>
                      {index > 0 && (index === consentPolicies.length - 1 ? " and " : ", ")}
                      <Link href={policy.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">{policy.title}</Link>
                    </span>
                  ))}
                  .
                </span>
              </label>
            </div>
          </>
        )}

        {step !== "details" && (
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-5 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <i className="fa-solid fa-envelope-circle-check" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-headline-md text-lg text-on-surface">Verify your email</h2>
            <p className="mt-1 font-body-md text-sm text-on-surface-variant">
              Enter the six-digit code sent to <strong className="text-on-surface">{form.email}</strong>.
            </p>
            <label htmlFor="registration-otp" className="sr-only">Verification code</label>
            <input
              id="registration-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-5 w-full rounded border border-outline-variant/40 bg-surface px-4 py-3 text-center font-headline-lg text-2xl tracking-[0.45em] text-on-surface outline-none focus:border-primary"
              placeholder="000000"
            />
            <div className="mt-4 text-xs font-label-md">
              <button type="button" onClick={resendOtp} disabled={loading || !turnstile.ready} className="text-primary hover:underline disabled:opacity-50">
                Resend code
              </button>
            </div>
            <p className="mt-5 border-t border-outline-variant/30 pt-4 font-body-md text-sm text-on-surface-variant">
              Want to change your email?{" "}
              <button type="button" onClick={changeEmail} disabled={loading} className="font-label-md font-semibold text-primary hover:underline disabled:opacity-50">
                Return to sign up
              </button>
            </p>
          </div>
        )}

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
          {turnstile.widget}
          <button
            type="submit"
            disabled={loading || (step === "details" && !turnstile.ready)}
            className="group relative flex w-full justify-center bg-primary py-3 px-4 font-label-md text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 uppercase tracking-widest overflow-hidden disabled:opacity-60"
          >
            <span className="absolute inset-0 w-full h-full -mt-1 opacity-30 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
            <span className="relative flex items-center gap-2">
              {loading
                ? step === "details" ? "Sending Code..." : "Verifying..."
                : step === "details" ? "Send Verification Code" : "Verify & Create Account"}
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        {step === "details" && (
          <section aria-labelledby="google-signup-title" className="mt-7 border-t border-outline-variant/30 pt-6">
            <h2 id="google-signup-title" className="font-headline-md text-lg text-on-surface">Or continue with Google</h2>
            <div className="mt-4">
              <GoogleAuthButton
                intent="register"
                disabled={loading || !agreedToTerms}
                onCredential={handleGoogleCredential}
                onError={setError}
              />
            </div>
          </section>
        )}

      </form>

    </AuthShell>
  );
}
