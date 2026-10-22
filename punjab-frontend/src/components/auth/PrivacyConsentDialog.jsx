"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_LINKS = [
  { id: "privacy", title: "Privacy Policy", href: "/policies/privacy-policy" },
  { id: "policy pdf", title: "Privacy Policy PDF", href: "https://drive.google.com/file/d/16A9oyBmB1wYTcctZE07UA6-Y5fXRFPsq/view" },
];
const PRIVACY_PDF_LINK = DEFAULT_LINKS[1];

function PrivacyConsentDialog({ open, onAccept, onDecline, links = DEFAULT_LINKS }) {
  const dialogRef = useRef(null);
  const consentLinks = links.some((link) => link.href === PRIVACY_PDF_LINK.href)
    ? links
    : [...links, PRIVACY_PDF_LINK];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onDecline();
      }}
      aria-labelledby="privacy-consent-title"
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-md"
    >
      <div className="flex max-h-[90vh] flex-col items-center justify-center gap-6 overflow-y-auto p-7 text-center sm:p-10">
        <div className="flex flex-col items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <i className="fa-solid fa-shield-halved text-xl" aria-hidden="true" />
          </span>
          <h2 id="privacy-consent-title" className="mt-4 font-display-lg text-xl tracking-tight text-primary sm:text-2xl">
            Privacy Policy &amp; consent
          </h2>
          <p className="mt-2 max-w-md font-body-md text-sm leading-relaxed text-on-surface-variant">
            Please read and accept our Privacy Policy to continue. If you do not accept, we cannot sign you in or create your account.
          </p>
        </div>

        <div className="flex w-full flex-col items-center">
          <p className="font-body-md text-xs text-on-surface-variant">
            Read in full:{" "}
            {consentLinks.map((link, index) => (
              <span key={link.id}>
                {index > 0 && (index === consentLinks.length - 1 ? " and " : ", ")}
                <Link href={link.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                  {link.title}
                </Link>
              </span>
            ))}
            .
          </p>
          <div className="mt-5 flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onDecline}
              className="rounded-lg border-2 border-outline-variant/60 bg-surface px-6 py-3 font-label-md text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="rounded-lg border-2 border-primary bg-primary px-6 py-3 font-label-md text-xs font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container"
            >
              I Accept
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Promise-based consent prompt:
 *
 *   const { requestConsent, dialog } = usePrivacyConsent(links);
 *   ...
 *   if (!(await requestConsent())) return;   // declined: stop here
 *   ...
 *   return <>{form}{dialog}</>;
 *
 * The caller saves the result on the account (users.terms_accepted).
 */
export function usePrivacyConsent(links) {
  const [open, setOpen] = useState(false);
  const resolver = useRef(null);

  const requestConsent = useCallback(
    () => new Promise((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    }),
    []
  );

  const settle = useCallback((accepted) => {
    setOpen(false);
    resolver.current?.(accepted);
    resolver.current = null;
  }, []);

  const dialog = (
    <PrivacyConsentDialog
      open={open}
      links={links}
      onAccept={() => settle(true)}
      onDecline={() => settle(false)}
    />
  );

  return { requestConsent, dialog };
}

export default PrivacyConsentDialog;
