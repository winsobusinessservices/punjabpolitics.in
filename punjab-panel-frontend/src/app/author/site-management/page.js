import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import SiteManagementClient from "@/components/author/SiteManagementClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Site Management" };

export default async function SiteManagementPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_SITE_MANAGEMENT]} roleLabel="a site manager">
          <div className="mx-auto max-w-full px-4 py-10 md:px-16">
            <h1 className="font-display-lg text-3xl text-primary">Site Management</h1>
            <p className="mb-8 mt-2 text-on-surface-variant">Manage the public header, navigation, countdown, homepage visibility, and homepage widgets.</p>
            <SiteManagementClient />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
