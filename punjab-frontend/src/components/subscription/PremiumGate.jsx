"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PostBody from "@/components/common/PostBody";
import AuthReturnLink from "@/components/auth/AuthReturnLink";
import { subscriptionApi, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePremium } from "@/lib/usePremium";

/**
 * The body of a premium story. Everyone gets the preview that came with the page. Premium members (and the
 * team, who must be able to read what they publish) get the full text, fetched with their sign-in, so the
 * full text is never part of the public page.
 */
export default function PremiumGate({ slug, title, preview, label }) {
  const { user } = useAuth();
  const { ready, isPremium } = usePremium();
  const isTeam = Boolean(user?.role && user.role !== "USER");
  const mayRead = ready && (isPremium || isTeam);
  const [full, setFull] = useState(null); // { slug, content, additionalImages }
  const [failedFor, setFailedFor] = useState(null);

  useEffect(() => {
    if (!mayRead) return undefined;
    let cancelled = false;
    subscriptionApi
      .premiumPost(slug)
      .then((data) => !cancelled && setFull({ slug, content: data.content, additionalImages: data.additionalImages || [] }))
      .catch(() => !cancelled && setFailedFor(slug));
    return () => {
      cancelled = true;
    };
  }, [mayRead, slug]);

  const unlocked = full?.slug === slug && full.content ? full : null;
  if (unlocked) {
    return (
      <>
        <PostBody content={unlocked.content} />
        {unlocked.additionalImages.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {unlocked.additionalImages.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={mediaUrl(url)} alt={`${title} — image ${index + 2}`} title={`${title} — image ${index + 2}`} loading="lazy" className="aspect-video w-full rounded-xl object-cover" />
            ))}
          </div>
        )}
      </>
    );
  }

  const loadingFull = mayRead && failedFor !== slug;

  return (
    <div className="premium-gate">
      <PostBody content={preview} />

      {/* The preview fades out into the sign-up card. */}
      <div className="pointer-events-none -mt-24 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />

      {loadingFull ? (
        <p className="rounded-xl bg-surface-container p-5 text-center font-body-md text-sm text-on-surface-variant" role="status">
          Loading the full story…
        </p>
      ) : (
        <section aria-label="Premium story" className="rounded-2xl border-2 border-primary/30 bg-surface p-6 text-center shadow-sm md:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <i className="fa-solid fa-crown text-lg" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-headline-md text-xl text-primary md:text-2xl">{label || "This is a premium story"}</h2>
          <p className="mx-auto mt-2 max-w-md font-body-md text-sm leading-relaxed text-on-surface-variant">
            {failedFor === slug && mayRead
              ? "We could not open the full story just now. Please refresh the page, or subscribe again if your Premium has ended."
              : "Premium members read the full story, with exclusive political analysis, reports and no ads."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/subscription#subscribe" className="rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
              Get Premium
            </Link>
            {!user && (
              <AuthReturnLink authPath="/login" returnTo={`/news/${slug}`} className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">
                Already Premium? Sign in
              </AuthReturnLink>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
