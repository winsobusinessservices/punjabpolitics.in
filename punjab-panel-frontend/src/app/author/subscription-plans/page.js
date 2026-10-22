import Link from "next/link";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import SubscriptionPlansEditor from "@/components/author/SubscriptionPlansEditor";

export const metadata = { title: "Subscription plans" };

export default function SubscriptionPlansPage() {
  return (
    <main className="w-full flex-grow bg-background">
      <RequireContributorRole roles={["ADMIN"]} roleLabel="an administrator">
        <div className="mx-auto max-w-full px-4 py-10 md:px-16">
          <h1 className="font-display-lg text-3xl text-primary">Subscription plans</h1>
          <p className="mb-8 mt-2 text-on-surface-variant">
            The cards, prices and lengths shown on the website&apos;s Subscription page.{" "}
            <Link href="/author/subscriptions" className="font-semibold text-primary hover:underline">See who has subscribed</Link>
          </p>
          <SubscriptionPlansEditor />
        </div>
      </RequireContributorRole>
    </main>
  );
}
