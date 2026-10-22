import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import InvestorApplicationsAdminClient from "@/components/author/InvestorApplicationsAdminClient";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "Investor Applications" };

export default async function InvestorApplicationsPage() {
  const breakingNews = await getBreakingNews();
  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="w-full flex-grow bg-background">
      <RequireContributorRole roles={["ADMIN"]} roleLabel="an administrator">
        <div className="mx-auto w-full px-4 py-10 md:px-10">
          <h1 className="font-display-lg text-3xl text-primary">Investor Applications</h1>
          <p className="mb-8 mt-2 text-on-surface-variant">Review investor details, supporting documents and account requests.</p>
          <InvestorApplicationsAdminClient />
        </div>
      </RequireContributorRole>
    </main>
    <Footer />
  </>;
}
