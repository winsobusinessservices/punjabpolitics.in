import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import DeletedItemsClient from "@/components/author/DeletedItemsClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Deleted Items & Audit History" };

export default async function DeletedItemsPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_DELETED_ITEMS]} roleLabel="a deletion administrator">
          <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-16">
            <h1 className="font-display-lg text-3xl text-primary">Deleted Items</h1>
            <p className="mb-8 mt-2 font-body-md text-on-surface-variant">Review who deleted each item, restore soft-deleted records, or permanently remove them from the database.</p>
            <DeletedItemsClient />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
