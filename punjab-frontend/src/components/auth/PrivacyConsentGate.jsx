"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi, policiesApi } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { isAuthPath } from "@/lib/cookieConsent";
import { PANEL_SITE_URL } from "@/lib/env";
import { usePrivacyConsent } from "@/components/auth/PrivacyConsentDialog";

/**
 * Site-wide check for signed-in visitors. When the account's Privacy Policy
 * consent (users.terms_accepted) is not true, the consent popup opens on
 * whatever page they are on - not only at sign-in.
 *
 *   Accept  -> saved as true, the visitor carries on.
 *   Decline -> saved as false and the visitor is signed out.
 *
 * Policy, registration, and password pages are skipped. An authenticated
 * user with missing consent can still be prompted on the login route after
 * successful sign-in.
 */
export default function PrivacyConsentGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, logout } = useAuth();
  const [consentPolicies, setConsentPolicies] = useState([]);
  const [policiesLoadedFor, setPoliciesLoadedFor] = useState(null);
  const consentLinks = consentPolicies.map((policy) => ({
    id: policy.id,
    title: policy.title,
    href: `/policies/${policy.slug}`,
  }));
  const { requestConsent, dialog } = usePrivacyConsent(consentLinks);
  // True while the popup is open / the answer is being saved, so it is never
  // opened twice at once.
  const pending = useRef(false);

  // Not accepted = false, 0 or "0" (the API sends a boolean, but older responses
  // carry the raw 0/1). A missing value means "unknown", which is left alone.
  const consentMissing = Boolean(user) && user.termsAccepted !== undefined && user.termsAccepted !== null && !Number(user.termsAccepted) && user.termsAccepted !== true;
  const blockedPath = pathname.startsWith("/policies") || (isAuthPath(pathname) && pathname !== "/login");
  const needsConsent =
    consentMissing &&
    !blockedPath;
  const userId = user?.id ?? null;
  const policiesLoaded = policiesLoadedFor === userId;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    policiesApi.listForRegistration()
      .then((data) => {
        if (cancelled) return;
        setConsentPolicies(data.policies || []);
        setPoliciesLoadedFor(userId);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  // The account is loaded once when the site first opens, so a consent value
  // changed afterwards (for example by an admin) would go unnoticed until a
  // refresh. Re-read it from the server on every page change and whenever the
  // tab becomes visible again. Failures are ignored: a network blip must not
  // sign anyone out - an expired session is handled by the API layer itself.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const syncConsent = () => {
      authApi.me()
        .then((data) => {
          const raw = data?.user?.termsAccepted;
          if (cancelled || raw === undefined || raw === null) return;
          const latest = raw === true || Boolean(Number(raw));
          setUser((current) => (current && current.termsAccepted !== latest ? { ...current, termsAccepted: latest } : current));
          if (!latest) {
            setPoliciesLoadedFor(null);
            policiesApi.listForRegistration()
              .then((policyData) => {
                if (cancelled) return;
                setConsentPolicies(policyData.policies || []);
                setPoliciesLoadedFor(userId);
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") syncConsent();
    };

    syncConsent();
    const refreshTimer = window.setInterval(syncConsent, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, pathname, setUser]);

  // `pathname` is a dependency on purpose: the check runs again on every page
  // change, so the popup returns on the next page until consent is actually saved.
  useEffect(() => {
    if (!needsConsent || !policiesLoaded || pending.current) return;
    pending.current = true;

    (async () => {
      try {
        const accepted = await requestConsent();
        try {
          const result = await authApi.recordPrivacyConsent(accepted, consentPolicies.map((policy) => policy.id));
          if (accepted) setUser((current) => (current ? { ...current, ...(result?.user || {}), termsAccepted: true } : current));
        } catch (error) {
          // Not saved: consent is still false, so the popup comes back on the next page.
          showToast(error?.message || "Your choice could not be saved. Please try again.", "error");
          return;
        }
        if (!accepted) {
          await logout();
          router.push("/");
        } else if (pathname === "/login") {
          if (user?.role === "INVESTOR") {
            window.location.assign(`${PANEL_SITE_URL}/author/dashboard`);
          } else {
            const requestedPath = new URLSearchParams(window.location.search).get("next") || "/";
            router.replace(requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/");
          }
        }
      } finally {
        pending.current = false;
      }
    })();
  }, [needsConsent, policiesLoaded, userId, user?.role, pathname, requestConsent, setUser, logout, router, consentPolicies]);

  return dialog;
}
