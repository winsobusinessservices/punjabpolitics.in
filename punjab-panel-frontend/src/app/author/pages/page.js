import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import ReferenceDataAdminClient from "@/components/author/ReferenceDataAdminClient";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Website Pages", robots: { index: false, follow: false } };

export default function WebsitePagesPage() {
  return <><Header /><main className="w-full flex-grow bg-background"><RequireContributorRole roles={["ADMIN", "SUBADMIN"]} permissions={[PERMISSIONS.SITE_PAGE_PROFILES]}><div className="mx-auto max-w-full px-4 py-10 md:px-16"><h1 className="font-display-lg text-3xl text-primary">Website Pages</h1><p className="mb-8 mt-2 text-on-surface-variant">Edit About, Contact, editorial and partnership pages for the active website.</p><ReferenceDataAdminClient initialTab="websitePages" /></div></RequireContributorRole></main><Footer /></>;
}
