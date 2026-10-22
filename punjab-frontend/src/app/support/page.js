import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SupportDonation from "@/components/donation/SupportDonation";
import SupportersWall from "@/components/donation/SupportersWall";
import { getBreakingNews } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "Support independent political journalism in India. Your contribution helps us provide reliable reporting, election coverage, and insights into Indian politics, governance, and public life.";

export const metadata = buildPageMetadata({ title: "Support Independent Political Journalism", description: DESCRIPTION, path: "/support" });

export default async function SupportPage() {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full flex-grow bg-background">
        <section className="border-b border-outline-variant/20 bg-surface px-4 py-12 md:px-16 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">Support Us</span>
            <h1 className="mt-3 font-display-lg text-3xl tracking-tight text-primary md:text-5xl">Support Independent Political Journalism</h1>
            <p className="mx-auto mt-4 max-w-2xl font-body-lg text-base leading-relaxed text-on-surface-variant md:text-lg">{DESCRIPTION}</p>
          </div>
        </section>

        <section className="px-4 py-10 md:px-8 md:py-14">
          <p className="mx-auto mb-6 max-w-xl rounded-lg border border-outline-variant/30 bg-surface px-4 py-3 text-center font-body-md text-sm leading-relaxed text-on-surface-variant">
            Contributions to <a href="https://punjabpolitics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">punjabpolitics.com</a> are entirely voluntary and help support our platform’s operations, political news coverage, and content development. Contributions do not provide premium access, paid membership, exclusive content, or any other benefits in return.
            <br />


          </p>
          <SupportDonation />

        </section>

        <SupportersWall />
      </main>

      <Footer />
    </>
  );
}
