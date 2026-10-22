import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import ManagedText from "@/components/common/ManagedText";
import { richTextToPlainText } from "@/lib/richText";
import { getBreakingNews, getManagedPages } from "@/features/news/news.api";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const managed = (await getManagedPages()).about;
  return buildPageMetadata({ title: managed?.title || "About Us: Our Mission, Team & Standards", description: richTextToPlainText(managed?.description) || "Learn about Punjab Politics: our mission, editorial standards and the team behind our Punjab political blogs, expert analysis and professional services.", path: "/about" });
}

export default async function AboutPage() {
  const [breakingNews, pages] = await Promise.all([getBreakingNews(), getManagedPages()]);
  const managed = pages.about || {};
  if (managed.enabled === false) notFound();
  // The stored field is still named `cards` for backwards compatibility
  // with existing Site Data, but About-page entries are editorial sections.
  const sections = Array.isArray(managed.cards) ? managed.cards : [];

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-14 md:px-16 md:py-20">
          <div className="mx-auto max-w-4xl text-center">
                        <Breadcrumbs className="mb-6 [&_ol]:justify-center" items={[{ label: managed.title }]} />
<span className="font-label-sm text-xs font-bold uppercase tracking-[0.22em] text-secondary">{managed.eyebrow}</span>
            <h1 className="mt-3 font-display-lg text-4xl tracking-tight text-primary md:text-5xl">{managed.title}</h1>
            <ManagedText text={managed.description} className="mx-auto mt-5 max-w-3xl space-y-3 font-body-lg text-base leading-relaxed text-on-surface-variant md:text-lg" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-12 md:py-16">
          <div>
            {managed.cardsTitle && <h2 className="font-display-lg text-3xl text-on-surface">{managed.cardsTitle}</h2>}
          </div>

          <div className="mt-8 divide-y divide-outline-variant/30 border-y border-outline-variant/30">
            {sections.map((item, index) => (
              <section key={`${item.title}-${index}`} className="grid gap-5 py-9 md:grid-cols-[64px_minmax(0,1fr)] md:py-11">
                <span className="flex h-12 w-12 items-center justify-center border-l-4 border-primary bg-primary/5 text-primary">
                  <i className={`fa-solid ${item.icon || "fa-circle-info"}`} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-headline-md text-xl text-on-surface md:text-2xl">{item.title}</h3>
                  <ManagedText
                    text={item.text}
                    className="mt-3 max-w-5xl space-y-3 font-body-md text-base leading-7 text-on-surface-variant"
                  />
                  {item.href && (
                    <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                      Learn more <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
