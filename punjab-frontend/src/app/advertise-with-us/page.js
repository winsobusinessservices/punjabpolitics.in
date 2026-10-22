import Link from "next/link";
import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ManagedText from "@/components/common/ManagedText";
import { getBreakingNews, getManagedPages } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";
import { richTextToPlainText } from "@/lib/richText";

const fallback = {
  eyebrow: "Partnerships",
  title: "Advertise with Punjab Politics",
  description: "Reach readers engaged with Punjab politics, public policy and democratic life through clearly disclosed advertising opportunities.",
  cardsTitle: "Advertising opportunities",
  cards: [
    { title: "Display campaigns", text: "Responsive placements across selected news, analysis and category pages with clear advertising labels." },
    { title: "Sponsored features", text: "Clearly identified partner-supported formats produced under defined editorial and disclosure standards." },
    { title: "Campaign enquiries", text: "Share your audience, schedule and campaign goals with our partnerships team.", href: "/contact" },
  ],
};

export async function generateMetadata() {
  const saved = (await getManagedPages())["advertise-with-us"] || {};
  const page = saved.title === "Invest in independent political journalism"
    ? { ...fallback, enabled: saved.enabled }
    : { ...fallback, ...saved };
  return buildPageMetadata({ title: page.title, description: richTextToPlainText(page.description), path: "/advertise-with-us" });
}

export default async function AdvertiseWithUsPage() {
  const [breakingNews, pages] = await Promise.all([getBreakingNews(), getManagedPages()]);
  const saved = pages["advertise-with-us"] || {};
  const page = saved.title === "Invest in independent political journalism"
    ? { ...fallback, enabled: saved.enabled }
    : { ...fallback, ...saved };
  if (page.enabled === false) notFound();
  const cards = Array.isArray(page.cards) && page.cards.length ? page.cards : fallback.cards;

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="flex-grow bg-background">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
          <div className="mx-auto max-w-5xl">
            <Breadcrumbs className="mb-8" items={[{ label: page.title }]} />
            <div className="max-w-3xl">
              <span className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">{page.eyebrow}</span>
              <h1 className="mt-2 font-display-lg text-3xl tracking-tight text-primary md:text-5xl">{page.title}</h1>
              <ManagedText text={page.description} className="mt-3 space-y-3 font-body-md text-base leading-relaxed text-on-surface-variant" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
          <h2 className="mb-6 font-display-lg text-2xl text-primary md:text-3xl">{page.cardsTitle || fallback.cardsTitle}</h2>
          <div className="border-y border-outline-variant/30">
              {cards.map((card, index) => (
                <article key={`${card.title}-${index}`} className="grid gap-4 border-b border-outline-variant/30 py-8 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12 md:py-10">
                  <div className="flex items-start gap-4">
                    <span className="mt-1 font-label-md text-xs font-bold tracking-widest text-secondary">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="font-headline-lg text-xl leading-snug text-on-surface md:text-2xl">{card.title}</h3>
                  </div>
                  <div>
                    <ManagedText text={card.text} className="space-y-3 font-body-md text-base leading-7 text-on-surface-variant" />
                    {card.href && <Link href={card.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Learn more <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" /></Link>}
                  </div>
                </article>
              ))}
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
