import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import InterestsPageContent from "@/components/preferences/InterestsPageContent";
import { getBreakingNews } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

// A personal page: no reason for search engines to list it.
export const metadata = buildPageMetadata({
  title: "My Interests",
  description: "Tell us which topics, regions, parties and leaders you follow, and how you would like to hear from us.",
  path: "/my-interests",
  noIndex: true,
});

export default async function MyInterestsPage() {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full flex-grow bg-background">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="font-label-sm text-xs font-bold uppercase tracking-[0.22em] text-secondary">Survey</span>
            <h1 className="mt-3 font-display-lg text-4xl tracking-tight text-primary md:text-5xl">What are you interested in?</h1>
            <p className="mx-auto mt-4 max-w-2xl font-body-lg text-base leading-relaxed text-on-surface-variant md:text-lg">
              Tell us what you like to follow. It takes about a minute, and helps us show and send you what matters to you.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
          <InterestsPageContent />
        </section>
      </main>

      <Footer />
    </>
  );
}
