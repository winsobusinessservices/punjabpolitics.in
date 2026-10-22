import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import EmptyState from "@/components/common/EmptyState";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import PostBody from "@/components/common/PostBody";
import { getBreakingNews, getSectionVisibility, getVidhanSabhas } from "@/features/news/news.api";
import { mediaUrl } from "@/lib/api";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const [assembly] = await getVidhanSabhas();
  return buildPageMetadata({
    title: assembly ? `${assembly.name}: Seats, Leadership & Profile` : "Vidhan Sabha: Assembly, Leadership & Seats",
    description: assembly
      ? `${assembly.name}: ${assembly.totalSeats} seats, Chief Minister ${assembly.chiefMinister || ""}, Speaker ${assembly.speaker || ""}, ruling and opposition parties, current term, next election and a full profile of the ${assembly.state} assembly.`.replace(/\s+,/g, ",")
      : "The state Vidhan Sabha explained: total seats, Chief Minister, Speaker, ruling and opposition parties, current term, next election and a full profile of the assembly.",
    path: "/vidhansabha",
    image: assembly?.imageUrl ? mediaUrl(assembly.imageUrl) : undefined,
    keywords: assembly ? [`${assembly.state} Vidhan Sabha`, `${assembly.state} assembly`, `${assembly.state} MLA`, `${assembly.state} election`] : undefined,
  });
}

const FACTS = [
  ["totalSeats", "Total seats", "fa-chair"],
  ["currentTerm", "Current term", "fa-calendar-days"],
  ["chiefMinister", "Chief Minister", "fa-user-tie"],
  ["rulingParty", "Ruling party", "fa-flag"],
  ["speaker", "Speaker", "fa-gavel"],
  ["oppositionLeader", "Leader of Opposition", "fa-user"],
  ["oppositionParty", "Opposition party", "fa-people-group"],
  ["nextElection", "Next election", "fa-check-to-slot"],
];

function AssemblyProfile({ assembly, primary }) {
  const Heading = primary ? "h1" : "h2";
  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-sm">
      <ImagePlaceholder image={mediaUrl(assembly.imageUrl)} alt={assembly.name} icon="fa-solid fa-landmark-dome" iconClassName="text-5xl" priority={primary} className="mx-auto aspect-[16/9] w-full max-w-4xl" sizes="(min-width: 896px) 896px, 100vw" />
      <div className="p-6 md:p-10">
        <span className="font-label-md text-xs font-bold uppercase tracking-[0.2em] text-secondary">{assembly.state} Vidhan Sabha</span>
        <Heading className="mt-2 font-display-lg text-3xl font-bold text-on-surface md:text-5xl">{assembly.name}</Heading>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.filter(([key]) => assembly[key]).map(([key, label, icon]) => (
            <div key={key} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
              <dt className="text-xs font-label-md uppercase tracking-wider text-on-surface-variant"><i className={`fa-solid ${icon} mr-2 text-primary`} />{label}</dt>
              <dd className="mt-2 font-headline-md text-on-surface">{assembly[key]}</dd>
            </div>
          ))}
        </dl>

        {assembly.content && <section className="mt-10 border-t border-outline-variant/30 pt-8"><PostBody content={assembly.content} /></section>}
      </div>
    </article>
  );
}

export default async function VidhanSabhaPage() {
  // Follows the Vidhan Sabha section's own show/hide setting, not the States feature.
  if ((await getSectionVisibility()).vidhan_sabha === false) notFound();
  const [assemblies, breakingNews] = await Promise.all([getVidhanSabhas(), getBreakingNews()]);

  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="w-full flex-grow bg-background">
      <div className="mx-auto max-w-full px-4 py-6 md:px-8 md:py-10">
        <Breadcrumbs items={[{ label: "Vidhan Sabha" }]} />
        {assemblies.length ? (
          <div className="space-y-10">
            {assemblies.map((assembly, index) => <AssemblyProfile key={assembly.id || assembly.state} assembly={assembly} primary={index === 0} />)}
          </div>
        ) : (
          <EmptyState icon="fa-landmark-dome" title="No Vidhan Sabha data available" description="Assembly details added through Site Data will appear here." />
        )}
      </div>
    </main>
    <Footer />
  </>;
}
