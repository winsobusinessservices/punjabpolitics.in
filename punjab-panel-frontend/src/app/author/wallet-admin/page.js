import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import WalletAdminClient from "@/components/author/WalletAdminClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Wallet & Points" };

export default async function WalletAdminPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole
          permissions={[PERMISSIONS.MANAGE_WALLETS, PERMISSIONS.MANAGE_POINT_RATES]}
          roleLabel="a wallet administrator"
        >
          <WalletAdminClient />
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
