import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import WebsiteManagementClient from "@/components/author/WebsiteManagementClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";
export const metadata = { title: "Punjab Website Settings" };
export default async function WebsitesPage() {
  const breakingNews = await getBreakingNews();
  return <><BreakingNews text={breakingNews} /><Header /><main className="w-full flex-grow bg-background"><RequireContributorRole permissions={[PERMISSIONS.MANAGE_WEBSITES]} roleLabel="a website administrator"><div className="mx-auto max-w-full px-4 py-10 md:px-16"><h1 className="font-display-lg text-3xl text-primary">Punjab Politics Website Settings</h1><p className="mb-8 mt-2 text-on-surface-variant">Manage the branding, domain, colours, icon, and service availability for Punjab Politics.</p><WebsiteManagementClient /></div></RequireContributorRole></main><Footer /></>;
}
