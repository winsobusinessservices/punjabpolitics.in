import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MyActivityClient from "@/components/history/MyActivityClient";
import { getBreakingNews } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

// A personal page: no reason for search engines to list it.
export const metadata = buildPageMetadata({
  title: "My Activity",
  description: "Your donations, messages and applications on one page.",
  path: "/my-activity",
  noIndex: true,
});

export default async function MyActivityPage() {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <MyActivityClient />
      </main>
      <Footer />
    </>
  );
}
