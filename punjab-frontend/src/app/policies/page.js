import Link from "next/link";
import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getBreakingNews, getListingPages } from "@/features/news/news.api";
import { policiesApi } from "@/lib/api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export async function generateMetadata() {
  const page = (await getListingPages()).policies || {};
  return buildPageMetadata({ title: page.title || "Government Policies Explained Simply", description: page.description || "Plain-language explainers on Punjab and national government policies, welfare schemes and public-policy debates, so you can understand what they mean for you.", path: "/policies" });
}

export default async function PoliciesPage() {
  if (!(await isSiteFeatureEnabled("feature_policies"))) notFound();
  const [breakingNews, policyData, pages] = await Promise.all([
    getBreakingNews(),
    policiesApi.list().catch(() => ({ policies: [] })),
    getListingPages(),
  ]);
  const policies = policyData.policies || [];
  const page = pages.policies || {};

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="flex-grow bg-background">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
          <div className="mx-auto max-w-6xl">
            <Breadcrumbs className="mb-6" items={[{ label: page.title }]} />
            {page.eyebrow && <span className="font-label-md text-xs font-bold uppercase tracking-[0.2em] text-secondary">{page.eyebrow}</span>}
            <h1 className="mt-3 max-w-4xl font-display-lg text-4xl tracking-tight text-primary md:text-5xl">{page.title}</h1>
            {page.description && <p className="mt-4 max-w-3xl font-body-lg text-base leading-relaxed text-on-surface-variant md:text-lg">{page.description}</p>}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:px-16 md:py-14">
          <div className="mb-7 flex items-end justify-between gap-4 border-b border-outline-variant/30 pb-3">
            <div>
              <h2 className="font-headline-lg text-2xl text-on-surface">{page.sectionTitle}</h2>
              <p className="mt-1 font-body-md text-sm text-on-surface-variant">{policies.length} {policies.length === 1 ? "policy" : "policies"}</p>
            </div>
            <a href="https://drive.google.com/file/d/16A9oyBmB1wYTcctZE07UA6-Y5fXRFPsq/view" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 font-label-md text-sm font-semibold text-primary hover:underline">
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Privacy Policy PDF
            </a>
          </div>

          {policies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface p-10 text-center">
              <i className="fa-solid fa-landmark text-3xl text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-headline-lg text-xl text-on-surface">{page.emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-xl font-body-md text-sm text-on-surface-variant">{page.emptyText}</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {policies.map((policy) => (
                <article key={policy.id} className="flex min-h-72 flex-col rounded-2xl border border-outline-variant/25 bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
                  <span className="font-label-md text-[11px] font-bold uppercase tracking-widest text-secondary">{policy.policy_type}</span>
                  <h2 className="mt-4 font-headline-lg text-xl leading-snug text-on-surface">
                    <Link href={`/policies/${policy.slug}`} className="hover:text-primary">{policy.title}</Link>
                  </h2>
                  <p className="mt-3 flex-grow font-body-md text-sm leading-relaxed text-on-surface-variant">{policy.summary}</p>
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-4">
                    <span className="text-xs text-on-surface-variant">{new Date(policy.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <Link href={`/policies/${policy.slug}`} className="font-label-md text-sm font-semibold text-primary hover:underline">{page.itemLinkLabel} <i className="fa-solid fa-arrow-right ml-1 text-xs" /></Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
