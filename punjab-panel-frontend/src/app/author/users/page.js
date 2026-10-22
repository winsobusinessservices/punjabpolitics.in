import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import UsersAdminClient from "@/components/author/UsersAdminClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_USERS]} roleLabel="a user administrator">
          <div className="mx-auto w-full px-4 py-10 md:px-10">
            <h1 className="font-display-lg text-3xl text-primary">Users</h1>
            <p className="mb-8 mt-2 text-on-surface-variant">View registered accounts for this website and remove accounts that are no longer required.</p>
            <UsersAdminClient />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
