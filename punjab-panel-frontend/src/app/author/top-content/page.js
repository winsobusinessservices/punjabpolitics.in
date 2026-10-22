import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import TopContentClient from "@/components/author/TopContentClient";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "Top Content" };

export default async function TopContentPage() {
  const breakingNews = await getBreakingNews();
  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="w-full flex-grow bg-background"><TopContentClient /></main>
    <Footer />
  </>;
}
