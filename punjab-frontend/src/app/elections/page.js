import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CategoryDetailView, { CategoryBreadcrumb, RecommendedNewsSection } from "@/components/category/CategoryDetailView";
import { getBreakingNews } from "@/features/news/news.api";
import { getElectionInfo } from "@/features/parliament/parliament.api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Punjab Elections: Results, Parties & Election Commission",
  description: "The 2024 general election result, the ruling coalition versus the opposition, party-wise performance and the Election Commission's role in India's elections.",
  path: "/elections",
});

export default async function ElectionsPage() {
  const info = await getElectionInfo();
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
