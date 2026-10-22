import RequireContributorRole from "@/components/author/RequireContributorRole";
import DonationsAdminClient from "@/components/author/DonationsAdminClient";

export const metadata = { title: "Donations" };

export default function DonationsPage() {
  return (
    <main className="w-full flex-grow bg-background">
      <RequireContributorRole roles={["ADMIN"]} roleLabel="an administrator">
        <div className="mx-auto max-w-full px-4 py-10 md:px-16">
          <h1 className="font-display-lg text-3xl text-primary">Donations</h1>
          <p className="mb-8 mt-2 text-on-surface-variant">Contributions received through the Support page.</p>
          <DonationsAdminClient />
        </div>
      </RequireContributorRole>
    </main>
  );
}
