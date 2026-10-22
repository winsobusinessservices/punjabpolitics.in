import RequireContributorRole from "@/components/author/RequireContributorRole";
import AdminAnalyticsDashboard from "@/components/author/AdminAnalyticsDashboard";

import { PERMISSIONS } from "@/lib/permissions";
import Header from "@/components/layout/Header";

export const metadata = { title: "Audience Analytics", robots: { index: false, follow: false } };

export default function AdminAnalyticsPage() {
  return(
    <>
      <Header />
         <main className="w-full flex-grow bg-background">
        <RequireContributorRole roles={["ADMIN", "SUBADMIN", "EDITOR", "AUTHOR", "INVESTOR"]} permissions={[PERMISSIONS.VIEW_AUDIENCE_ANALYTICS]}>
          <AdminAnalyticsDashboard />
        </RequireContributorRole>
      </main>
    </>
  )

}
