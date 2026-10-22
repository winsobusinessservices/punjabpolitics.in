"use client";

import { useEffect, useRef } from "react";
import { useTurnstile } from "@/hooks/useTurnstile";

/**
 * Drop-in Cloudflare Turnstile box for a form.
 *
 *   <TurnstileCaptcha onVerify={setCaptchaToken} resetKey={submitCount} />
 *
 * - `onVerify(token)` is called with the one-time token when the check passes, and with "" when it
 *   expires or fails (disable your submit button while the token is empty).
 * - Change `resetKey` (for example after each submit) to get a fresh check; tokens work only once.
 * - Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set, and calls `onVerify` with "".
 *   (The backend skips the check when TURNSTILE_SECRET_KEY is not set either.)
 *
 * Forms that also need to know whether the check is switched off can use the `useTurnstile` hook
 * directly, which is what the sign-in, sign-up, password reset and contact forms do.
 */
export default function TurnstileCaptcha({ onVerify, resetKey = 0, action, className = "my-4" }) {
  const { token, reset, widget } = useTurnstile({ action });

  // Always call the latest callback without re-running the effects below.
  const onVerifyRef = useRef(onVerify);
  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    onVerifyRef.current?.(token);
  }, [token]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    reset();
  }, [resetKey, reset]);

  return widget ? <div className={className}>{widget}</div> : null;
}
