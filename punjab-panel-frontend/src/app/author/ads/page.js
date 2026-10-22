import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import AdsAdminClient from "@/components/author/AdsAdminClient";
import { PERMISSIONS } from "@/lib/permissions";
import { getBreakingNews } from "@/features/news/news.api";

export const metadata = { title: "Advertisements" };
export default async function AdsManagementPage() {
  const breakingNews = await getBreakingNews();
  return <><BreakingNews text={breakingNews} /><Header /><main className="w-full flex-grow bg-background"><RequireContributorRole permissions={[PERMISSIONS.MANAGE_ADS]} roleLabel="an advertising manager"><div className="mx-auto max-w-full px-4 py-10 md:px-16"><h1 className="font-display-lg text-3xl text-primary">Advertisements</h1><p className="mb-8 mt-2 text-on-surface-variant">Add advertiser banners, choose where they appear and schedule when they run.</p><AdsAdminClient /></div></RequireContributorRole></main><Footer /></>;
}
