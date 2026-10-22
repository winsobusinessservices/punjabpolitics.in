import Link from "next/link";
import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CategoryDetailView, { CategoryBreadcrumb, RecommendedNewsSection } from "@/components/category/CategoryDetailView";
import { getBreakingNews, getManagedPages } from "@/features/news/news.api";
import { getStandaloneCategoryInfo } from "@/features/category/category.api";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo";
import ManagedText from "@/components/common/ManagedText";
import InvestorApplicationForm from "@/components/investor/InvestorApplicationForm";
import { richTextToPlainText } from "@/lib/richText";


export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = (await getManagedPages())[slug];
  if (page?.enabled === false) return { title: "Page not found", robots: { index: false, follow: false } };
  if (page) return buildPageMetadata({ title: page.title, description: richTextToPlainText(page.description), path: `/${slug}` });

  const info = await getStandaloneCategoryInfo(slug);
  if (!info) return { title: "Page not found" };
  return buildPageMetadata({ title: info.label, description: info.description, path: `/${slug}` });
}

export default async function ManagedOrCategoryPage({ params }) {
  const { slug } = await params;
  const page = (await getManagedPages())[slug];
  if (page?.enabled === false) notFound();
  const categoryInfo = page ? null : await getStandaloneCategoryInfo(slug);
  if (!page && !categoryInfo) notFound();

  const breakingNews = await getBreakingNews();
  if (categoryInfo) {
    return <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <div className="mx-auto max-w-full px-4 py-6 md:px-16">
          <CategoryBreadcrumb label={categoryInfo.label} />
          <CategoryDetailView info={categoryInfo} />
        </div>
      </main>
      <RecommendedNewsSection recommendedNews={categoryInfo.recommendedNews} />
      <Footer />
    </>;
  }


  const cards = Array.isArray(page.cards) ? page.cards : [];
  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="w-full flex-grow bg-background">
      <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs className="mb-8" items={[{ label: page.title }]} />
          <div>
            {page.eyebrow && <span className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">{page.eyebrow}</span>}
            <h1 className="mt-2 font-display-lg text-3xl tracking-tight text-primary md:text-5xl">{page.title}</h1>
            <ManagedText text={page.description} className="mt-3 max-w-3xl space-y-3 font-body-md text-base leading-relaxed text-on-surface-variant" />
          </div>
        </div>
      </section>

      {cards.length > 0 && <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
        {page.cardsTitle && <h2 className="mb-6 font-display-lg text-2xl text-primary md:text-3xl">{page.cardsTitle}</h2>}
        <div className="border-y border-outline-variant/30">
          {cards.map((card, index) => <article key={`${card.title}-${index}`} className="grid gap-4 border-b border-outline-variant/30 py-8 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12 md:py-10">
            <div className="flex items-start gap-4">
              <span className="mt-1 font-label-md text-xs font-bold tracking-widest text-secondary">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="font-headline-lg text-xl leading-snug text-on-surface md:text-2xl">{card.title}</h3>
            </div>
            <div>
              <ManagedText text={card.text} className="space-y-3 font-body-md text-base leading-7 text-on-surface-variant" />
              {card.href && <Link href={card.href} className="mt-5 inline-flex items-center gap-2 font-label-md text-sm font-semibold text-primary hover:underline">Learn more <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" /></Link>}
            </div>
          </article>)}
        </div>
      </section>}

      {slug === "investors" && page.formEnabled !== false && <section className="mx-auto max-w-5xl px-4 pb-14 md:px-8 md:pb-20">
        <InvestorApplicationForm settings={page} />
      </section>}
    </main>
    <Footer />
  </>;
}
