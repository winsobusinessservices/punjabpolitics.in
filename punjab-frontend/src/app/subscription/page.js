import Link from "next/link";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SubscriptionCard from "@/components/subscription/SubscriptionCard";
import SubscriptionForm from "@/components/subscription/SubscriptionForm";
import { getBreakingNews, getSubscriptionConfig } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "Go Premium for an ad-free experience, exclusive political analysis and reports, and premium election analysis. One month, one payment, no automatic renewal.";

export const metadata = buildPageMetadata({ title: "Premium Subscription: Ad-Free Reading and Exclusive Political Analysis", description: DESCRIPTION, path: "/subscription" });

// Shown only when the server cannot be reached; normally the cards come from the plans an admin saved.
const FALLBACK_PLANS = {
  free: {
    name: "Free",
    tagline: "Everything you need to follow Indian politics every day.",
    features: ["Latest news, top stories and breaking updates", "Free articles, blogs and videos in full", "Politician, party and Vidhan Sabha profiles", "Personal alerts with My Interests", "Comments and a free account"],
    notIncluded: ["Ad-free experience", "Exclusive political analysis & reports", "Premium election analysis"],
    ctaLabel: "Keep reading for free",
  },
  paid: [
    {
      id: "premium",
      name: "Premium",
      tagline: "Deeper analysis and a clean, ad-free reading experience.",
      features: ["Everything in the Free plan", "Ad-free experience on every page", "Exclusive political analysis & reports", "Premium election analysis", "Every premium story in full, as soon as it is published"],
      notIncluded: [],
      ctaLabel: "Get Premium",
      priceRupees: 199,
      days: 30,
      recommended: true,
    },
  ],
};

const periodLabel = (days) => (days === 365 || days === 366 ? "for 1 year" : `for ${days} days`);

export default async function SubscriptionPage({ searchParams }) {
  const { plan: planParam } = await searchParams;
  const [breakingNews, config] = await Promise.all([getBreakingNews(), getSubscriptionConfig()]);
  const plans = config.plans || FALLBACK_PLANS;
  const paid = plans.paid;
  const initialPlanId = typeof planParam === "string" && paid.some((item) => item.id === planParam) ? planParam : undefined;

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full flex-grow bg-background">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">Premium</span>
            <h1 className="mt-3 font-display-lg text-3xl tracking-tight text-primary md:text-5xl">Read Indian politics without the noise</h1>
            <p className="mx-auto mt-4 max-w-2xl font-body-lg text-base leading-relaxed text-on-surface-variant md:text-lg">{DESCRIPTION}</p>
          </div>
        </section>

        <section aria-label="Plans" className="px-4 py-12 md:px-16 md:py-14">
          <div className={`mx-auto grid gap-6 md:grid-cols-2 md:gap-8 ${paid.length > 1 ? "max-w-6xl lg:grid-cols-3" : "max-w-4xl"}`}>
            <SubscriptionCard
              name={plans.free.name}
              icon="fa-newspaper"
              price="₹0"
              period="forever"
              tagline={plans.free.tagline}
              features={plans.free.features}
              notIncluded={plans.free.notIncluded}
              cta={{ label: plans.free.ctaLabel, href: "/" }}
            />
            {paid.map((card) => (
              <SubscriptionCard
                key={card.id}
                name={card.name}
                icon="fa-crown"
                price={`₹${Number(card.priceRupees).toLocaleString("en-IN")}`}
                period={periodLabel(card.days)}
                tagline={card.tagline}
                features={card.features}
                notIncluded={card.notIncluded}
                cta={{ label: card.ctaLabel, href: paid.length > 1 ? `/subscription?plan=${card.id}#subscribe` : "#subscribe" }}
                highlighted={card.recommended}
              />
            ))}
          </div>
        </section>

        <section id="subscribe" className="scroll-mt-24 border-t border-outline-variant/20 bg-surface-container/40 px-4 py-12 md:px-8 md:py-14">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="font-headline-md text-2xl text-primary md:text-3xl">{paid.length > 1 ? "Choose your plan" : `Get ${paid[0].name}`}</h2>
            <p className="mt-2 font-body-md text-sm text-on-surface-variant">Fill in your details and pay securely. Premium starts the moment the payment is confirmed.</p>
          </div>
          <SubscriptionForm initialPlanId={initialPlanId} />
        </section>
      </main>

      <Footer />
    </>
  );
}
