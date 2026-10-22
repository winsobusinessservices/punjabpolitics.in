import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CategoryDetailView, { CategoryBreadcrumb, RecommendedNewsSection } from "@/components/category/CategoryDetailView";
import { getBreakingNews } from "@/features/news/news.api";
import { getHouseInfo } from "@/features/parliament/parliament.api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Lok Sabha: Members, Parties & Leadership",
  description: "The Lok Sabha explained: its leadership, party-wise composition and the latest developments from the lower house of India's Parliament, with key facts.",
  path: "/loksabha",
});

export default async function LokSabhaPage() {
  const info = await getHouseInfo("loksabha");
  if (!info) notFound();

  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        <div className="max-w-full mx-auto px-4 md:px-16 py-6">
          <CategoryBreadcrumb label={info.label} />
          <CategoryDetailView info={info} />
        </div>
      </main>

      <RecommendedNewsSection recommendedNews={info.recommendedNews} />

      <Footer />
    </>
  );
}
