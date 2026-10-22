import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import AuthorDashboardClient from "@/components/author/AuthorDashboardClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Author Dashboard" };

export default async function AuthorDashboardPage() {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full bg-background flex-grow">
        <RequireContributorRole roles={["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN", "INVESTOR"]} permissions={[PERMISSIONS.DASHBOARD]}>
          <AuthorDashboardClient />
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
