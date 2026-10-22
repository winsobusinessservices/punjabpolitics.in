"use client";

import Link from "next/link";
import AuthReturnLink from "@/components/auth/AuthReturnLink";
import PremiumStatusBanner from "@/components/subscription/PremiumStatusBanner";
import { useAuth } from "@/context/AuthContext";
import { usePremium } from "@/lib/usePremium";

/**
 * The Premium area (/premium and its sections) is for subscribers. Premium members, and the team who publish the
 * stories, get the content with a short status line on top. Everyone else gets a short note with the way to subscribe
 * and none of the lists or filters. (The story pages stay public: they show a preview and the subscribe card.)
 */
export default function PremiumAreaGate({ children, title = "Premium stories are for Premium members" }) {
  const { user } = useAuth();
  const { ready, isPremium } = usePremium();
  const isTeam = Boolean(user?.role && user.role !== "USER");

  if (!ready) return <div className="mx-auto my-12 h-64 max-w-3xl animate-pulse rounded-2xl bg-surface-container" aria-hidden="true" />;

  if (isPremium || isTeam) {
    return (
      <div className="flex flex-col gap-5">
        <PremiumStatusBanner className="" />
        {children}
      </div>
    );
  }

  return (
    <section aria-label="Premium members only" className="mx-auto my-14 max-w-xl px-4">
      <div className="rounded-2xl border border-secondary/40 bg-surface p-8 text-center shadow-sm md:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <i className="fa-solid fa-lock text-xl" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-headline-md text-2xl text-primary">{title}</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Subscribe to open every premium story and section in full, with no ads. {user ? "" : "Already a member? Sign in to continue."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/subscription#subscribe" className="rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
            Get Premium
          </Link>
          <Link href="/subscription" className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">
            See the plans
          </Link>
          {!user && (
            <AuthReturnLink authPath="/login" className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">
              Sign in
            </AuthReturnLink>
          )}
        </div>
      </div>
    </section>
  );
}
