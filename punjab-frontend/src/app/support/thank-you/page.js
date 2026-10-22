import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThankYouContent from "@/components/donation/ThankYouContent";
import { getBreakingNews } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

// A personal result page: not for search engines.
export const metadata = buildPageMetadata({
  title: "Thank You for Your Support",
  description: "Thank you for supporting independent political journalism in India.",
  path: "/support/thank-you",
  noIndex: true,
});

export default async function ThankYouPage({ searchParams }) {
  const { d } = await searchParams;
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background px-4 py-14 md:px-8 md:py-20">
        <ThankYouContent publicId={typeof d === "string" ? d : ""} />
      </main>
      <Footer />
    </>
  );
}
