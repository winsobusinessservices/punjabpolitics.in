import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import WithdrawalRequestsAdmin from "@/components/author/WithdrawalRequestsAdmin";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Withdrawal Requests" };

export default async function WithdrawalRequestsPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_WITHDRAWALS]} roleLabel="a withdrawal manager">
          <div className="mx-auto max-w-full px-4 py-10 md:px-16">
            <div className="mb-8">
              <p className="mb-1 font-label-md text-xs uppercase tracking-[0.16em] text-on-surface-variant">Administration</p>
              <h1 className="font-display-lg text-3xl text-primary">Withdrawal Requests</h1>
            </div>
            <WithdrawalRequestsAdmin />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
