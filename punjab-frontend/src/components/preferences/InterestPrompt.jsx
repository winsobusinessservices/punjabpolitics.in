"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { preferencesApi } from "@/lib/api";
import { isAuthPath } from "@/lib/cookieConsent";
import InterestsForm from "@/components/preferences/InterestsForm";

const DISMISS_KEY = "interest-survey-dismissed-until";
const DISMISS_DAYS = 7;
const SURVEY_DELAY_MS = 5 * 60 * 1000;

function recentlyDismissed() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
  } catch {
    /* the choice just is not remembered */
  }
}

/**
 * Shows the "My interests" survey as a popup to readers (signed in or not) who
 * have not answered it yet. "Maybe later" hides it for a week; answering it stops
 * it for good. For signed-in readers it waits for the Privacy Policy consent, and
 * it stays away from sign-in, policy and survey pages.
 */
export default function InterestPrompt() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const checkedFor = useRef(null);

  const blockedPage = isAuthPath(pathname) || pathname.startsWith("/policies") || pathname.startsWith("/my-interests");
  const consentPending = Boolean(user) && user.termsAccepted === false;
  // Everyone is asked, signed in or not: visitors are recognised by their browser.
  const eligible = !loading && !consentPending && !blockedPage;
  const userId = user?.id ?? null;
  const identity = userId ?? "visitor";

  // Let readers spend five minutes on the site before checking whether they
  // still need to answer the survey.
  useEffect(() => {
    if (!eligible || checkedFor.current === identity || recentlyDismissed()) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      checkedFor.current = identity;
      preferencesApi
        .getMine()
        .then((data) => { if (active && !data.completed) setOpen(true); })
        .catch(() => {});
    }, SURVEY_DELAY_MS);
    return () => { active = false; window.clearTimeout(timer); };
  }, [eligible, identity, userId]);

  // Open the popup only while it should show; close it (so the page is never left
  // blocked) when the reader moves to a page where it must stay away.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && eligible && !dialog.open) dialog.showModal();
    if ((!open || !eligible) && dialog.open) dialog.close();
  }, [open, eligible]);

  const later = () => {
    rememberDismissal();
    setOpen(false);
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); later(); }}
      aria-labelledby="interest-prompt-title"
      className={`m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-md`}
    >
      <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <i className="fa-solid fa-sliders text-xl" aria-hidden="true" />
          </span>
          <h2 id="interest-prompt-title" className="mt-4 font-display-lg text-2xl tracking-tight text-primary">
            What are you interested in?
          </h2>
          <p className="mt-2 font-body-md text-sm text-on-surface-variant">
            A one-minute survey so we can show and send you what matters to you.
          </p>
        </div>
        {open && eligible && <InterestsForm onSaved={() => setTimeout(() => setOpen(false), 1500)} onSkip={later} />}
      </div>
      <button
        type="button"
        onClick={later}
        aria-label="Close the survey for now"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </dialog>
  );
}
