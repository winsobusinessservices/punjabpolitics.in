import Link from "next/link";
import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getBreakingNews } from "@/features/news/news.api";
import { policiesApi } from "@/lib/api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { absoluteUrl, buildPageMetadata, serializeJsonLd } from "@/lib/seo";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";
import PostBody from "@/components/common/PostBody";
import Breadcrumbs from "@/components/common/Breadcrumbs";

async function getPolicy(slug) {
  try {
    return (await policiesApi.getBySlug(slug)).policy;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) return { title: "Policy not found", robots: { index: false, follow: true } };
  return buildPageMetadata({ title: policy.title, description: policy.summary, path: `/policies/${slug}`, type: "article" });
}

export default async function PolicyDetailPage({ params }) {
  if (!(await isSiteFeatureEnabled("feature_policies"))) notFound();
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) notFound();
  const breakingNews = await getBreakingNews();

  const policySchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: policy.title,
    description: policy.summary,
    articleSection: policy.policy_type,
    datePublished: policy.published_at,
    dateModified: policy.updated_at,
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    author: { "@type": "Person", name: policy.created_by_name },
    publisher: { "@type": "NewsMediaOrganization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/policies/${slug}`) },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Policies", item: absoluteUrl("/policies") },
      { "@type": "ListItem", position: 3, name: policy.title, item: absoluteUrl(`/policies/${slug}`) },
    ],
  };
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="flex-grow bg-background w-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([policySchema, breadcrumbSchema]) }} />
        <article className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-12">
          <Breadcrumbs withSchema={false} className="mb-7" items={[{ label: "Policies", href: "/policies" }, { label: policy.title }]} />

          <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 font-label-md text-xs font-bold uppercase tracking-widest text-secondary">{policy.policy_type}</span>
          <h1 className="mt-5 font-display-lg text-3xl leading-tight text-on-surface md:text-5xl">{policy.title}</h1>
          <p className="mt-5 border-l-4 border-secondary pl-5 font-body-lg text-lg leading-relaxed text-on-surface-variant">{policy.summary}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-outline-variant/30 pb-6 font-label-md text-xs text-on-surface-variant">

            <time dateTime={policy.published_at}><i className="fa-regular fa-calendar mr-2 text-primary" />{new Date(policy.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>
            <a href="https://drive.google.com/file/d/16A9oyBmB1wYTcctZE07UA6-Y5fXRFPsq/view" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Privacy Policy PDF
            </a>
          </div>

          <PostBody content={policy.content} className="mt-9 space-y-6 text-base leading-8 text-on-surface-variant" />

          <div className="mt-12 border-t border-outline-variant/30 pt-6">
            <Link href="/policies" className="inline-flex items-center gap-2 font-label-md text-sm font-semibold text-primary hover:underline"><i className="fa-solid fa-arrow-left text-xs" /> Back to all policies</Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
