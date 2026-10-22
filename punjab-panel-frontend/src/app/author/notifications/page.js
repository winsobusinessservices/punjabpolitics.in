import RequireContributorRole from "@/components/author/RequireContributorRole";
import NotificationsAdminClient from "@/components/author/NotificationsAdminClient";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  return (
    <>
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole roles={["ADMIN"]} roleLabel="an administrator">
          <div className="mx-auto max-w-full px-4 py-10 md:px-16">
            <h1 className="font-display-lg text-3xl text-primary">Notifications</h1>
            <p className="mb-8 mt-2 text-on-surface-variant">Browser notifications sent to readers about the topics they chose in My Interests.</p>
            <NotificationsAdminClient />
          </div>
        </RequireContributorRole>
      </main>
    </>
  );
}
