import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import ServicesManagementClient from "@/components/author/ServicesManagementClient";
import { PERMISSIONS } from "@/lib/permissions";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "Services Management" };
export default async function ServicesManagementPage() {
  const breakingNews = await getBreakingNews();
  return <><BreakingNews text={breakingNews} /><Header /><main className="w-full flex-grow bg-background"><RequireContributorRole permissions={[PERMISSIONS.MANAGE_SERVICES]} roleLabel="a services manager"><div className="mx-auto max-w-full px-4 py-10 md:px-16"><h1 className="font-display-lg text-3xl text-primary">Services</h1><p className="mb-8 mt-2 text-on-surface-variant">Manage the services shown on your assigned website.</p><ServicesManagementClient /></div></RequireContributorRole></main><Footer /></>;
}
