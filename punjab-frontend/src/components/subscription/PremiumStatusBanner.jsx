"use client";

import Link from "next/link";
import AuthReturnLink from "@/components/auth/AuthReturnLink";
import { usePremium } from "@/lib/usePremium";

const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

/**
 * Tells the reader, on the Premium page, where they stand: a member (everything below is open), signed in without
 * Premium, or not signed in. It renders nothing until the sign-in state is known, so it never flashes the wrong message.
 */
export default function PremiumStatusBanner({ className = "mx-auto mt-8 max-w-3xl" }) {
  const { ready, isPremium, endsAt, signedIn } = usePremium();
  if (!ready) return <div className={`${className} h-20 animate-pulse rounded-xl bg-surface-container`} aria-hidden="true" />;

  if (isPremium) {
    return (
      <div role="status" className={`${className} flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-left`}>
        <i className="fa-solid fa-circle-check mt-0.5 text-green-700" aria-hidden="true" />
        <p className="font-body-md text-sm text-green-900">
          <strong>You are a Premium member</strong>, valid until {dateLabel(endsAt)}. Every story below opens in full, without ads.{" "}
          <Link href="/subscription#subscribe" className="font-semibold underline">Extend Premium</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col items-start gap-4 rounded-xl border border-secondary/40 bg-secondary/5 p-4 text-left sm:flex-row sm:items-center sm:justify-between`}>
      <p className="font-body-md text-sm text-on-surface">
        <i className="fa-solid fa-lock mr-2 text-secondary" aria-hidden="true" />
        These stories are for Premium members. You can read the start of each one; subscribe to read them in full and remove ads.
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href="/subscription#subscribe" className="rounded-lg bg-primary px-5 py-2.5 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
          Get Premium
        </Link>
        {!signedIn && (
          <AuthReturnLink authPath="/login" returnTo="/premium" className="rounded-lg border border-outline-variant/60 px-5 py-2.5 font-label-md text-sm font-semibold text-primary hover:border-primary">
            Sign in
          </AuthReturnLink>
        )}
      </div>
    </div>
  );
}
