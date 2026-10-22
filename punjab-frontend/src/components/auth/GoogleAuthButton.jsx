"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { authApi } from "@/lib/api";

const STATIC_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function GoogleAuthButton({ intent, disabled = false, onCredential, onError }) {
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const [clientId, setClientId] = useState(STATIC_GOOGLE_CLIENT_ID);
  const [configLoaded, setConfigLoaded] = useState(Boolean(STATIC_GOOGLE_CLIENT_ID));
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    if (STATIC_GOOGLE_CLIENT_ID) return;
    let active = true;
    authApi.getGoogleAuthConfig()
      .then((data) => {
        if (active) setClientId(data.clientId || "");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const renderButton = useCallback(() => {
    if (!clientId || !containerRef.current || !buttonRef.current || !window.google?.accounts?.id) return;

    const availableWidth = Math.floor(containerRef.current.getBoundingClientRect().width);
    if (availableWidth <= 0) return;

    window.__indianRajnitiGoogleCredential = onCredential;
    if (!window.__indianRajnitiGoogleInitialized) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => window.__indianRajnitiGoogleCredential?.(response.credential),
        auto_select: false,
        ux_mode: "popup",
      });
      window.__indianRajnitiGoogleInitialized = true;
    }

    buttonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: intent === "register" ? "signup_with" : "signin_with",
      logo_alignment: "left",
      width: Math.min(availableWidth, 400),
    });
  }, [clientId, intent, onCredential]);

  useEffect(() => {
    renderButton();
    return () => {
      if (window.__indianRajnitiGoogleCredential === onCredential) {
        window.__indianRajnitiGoogleCredential = null;
      }
    };
  }, [onCredential, renderButton]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let previousWidth = 0;
    const renderAtCurrentWidth = () => {
      const width = Math.floor(container.getBoundingClientRect().width);
      if (width > 0 && width !== previousWidth) {
        previousWidth = width;
        renderButton();
      }
    };

    renderAtCurrentWidth();
    const observer = new ResizeObserver(renderAtCurrentWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderButton]);

  if (!clientId) {
    return configLoaded && process.env.NODE_ENV === "development" ? (
      <p className="text-center font-body-md text-xs text-error" role="status">
        Set GOOGLE_CLIENT_ID in the backend to enable Google authentication.
      </p>
    ) : null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={renderButton}
        onError={() => {
          setScriptError(true);
          onError?.("Google sign-in could not be loaded. Please try again.");
        }}
      />
      <div
        ref={containerRef}
        className="relative flex min-h-10 w-full max-w-full justify-center overflow-hidden"
        aria-disabled={disabled}
      >
        <div
          ref={buttonRef}
          className={`w-full max-w-[400px] ${disabled ? "pointer-events-none opacity-60" : ""}`}
        />
      </div>
      {scriptError && (
        <p className="text-center font-body-md text-xs text-error" role="alert">
          Google sign-in could not be loaded.
        </p>
      )}
    </>
  );
}
