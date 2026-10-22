import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import ReferenceDataAdminClient from "@/components/author/ReferenceDataAdminClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Manage Site Data", robots: { index: false, follow: false } };

export default async function SiteDataAdminPage() {
  const breakingNews = await getBreakingNews();
  return <><BreakingNews text={breakingNews} /><Header /><main className="w-full flex-grow bg-background"><RequireContributorRole roles={["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN", "INVESTOR"]} permissions={[PERMISSIONS.MANAGE_SITE_DATA]}><div className="mx-auto max-w-full px-4 py-10 md:px-16"><h1 className="font-display-lg text-3xl text-primary">Manage Site Data</h1><p className="mb-8 mt-2 text-on-surface-variant">Create, edit and delete the site data included in your assigned privileges.</p><ReferenceDataAdminClient /></div></RequireContributorRole></main><Footer /></>;
}
