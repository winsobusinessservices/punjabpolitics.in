import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProfileClient from "@/components/profile/ProfileClient";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "My Profile", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <ProfileClient />
      </main>
      <Footer />
    </>
  );
}
