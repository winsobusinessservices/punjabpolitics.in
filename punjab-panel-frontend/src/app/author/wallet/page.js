import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import WalletClient from "@/components/author/WalletClient";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole roles={["AUTHOR", "EDITOR"]} roleLabel="an author or editor">
          <WalletClient />
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
