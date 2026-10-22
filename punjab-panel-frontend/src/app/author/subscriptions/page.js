import Link from "next/link";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import SubscriptionsAdminClient from "@/components/author/SubscriptionsAdminClient";

export const metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  return (
    <main className="w-full flex-grow bg-background">
      <RequireContributorRole roles={["ADMIN"]} roleLabel="an administrator">
        <div className="mx-auto max-w-full px-4 py-10 md:px-16">
          <h1 className="font-display-lg text-3xl text-primary">Subscriptions</h1>
          <p className="mb-8 mt-2 text-on-surface-variant">
            Premium purchases made on the Subscription page, and who is a member right now.{" "}
            <Link href="/author/subscription-plans" className="font-semibold text-primary hover:underline">Edit the cards and prices</Link>
          </p>
          <SubscriptionsAdminClient />
        </div>
      </RequireContributorRole>
    </main>
  );
}
