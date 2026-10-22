import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import PostBody from "@/components/common/PostBody";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { getBreakingNews } from "@/features/news/news.api";
import { getDistrictBySlug } from "@/features/geography/district.api";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const district = await getDistrictBySlug(slug);
  if (!district) return { title: "District not found" };
  return buildPageMetadata({
    title: `${district.name} District, ${district.state}`,
    description: district.description || `${district.name} district in ${district.state}: headquarters, administration, population, Lok Sabha and Vidhan Sabha constituencies, history and a complete local profile.`,
    path: `/district/${district.slug}`,
    image: district.image,
    keywords: [`${district.name} district`, `${district.name} MLA`, `${district.name} Vidhan Sabha`, `${district.name} politics`],
  });
}

const FACTS = [
  ["headquarters", "Headquarters", "fa-building"],
  ["division", "Division", "fa-map"],
  ["established", "Established", "fa-calendar-days"],
  ["area", "Area", "fa-ruler-combined"],
  ["population", "Population", "fa-users"],
  ["lokSabhaConstituencies", "Lok Sabha", "fa-landmark-dome"],
  ["vidhanSabhaConstituencies", "Vidhan Sabha", "fa-building-columns"],
];

export default async function DistrictDetailPage({ params }) {
  const { slug } = await params;
  const [district, breakingNews] = await Promise.all([getDistrictBySlug(slug), getBreakingNews()]);
  if (!district) notFound();

  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="w-full flex-grow bg-background">
      <div className="mx-auto max-w-full px-4 py-6 md:px-8 md:py-10">
        <Breadcrumbs items={[{ label: "Districts", href: "/district" }, { label: district.name }]} />

        <article className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-sm">
          <ImagePlaceholder image={district.image} alt={`${district.name} district`} icon="fa-solid fa-map-location-dot" priority className="mx-auto aspect-[16/9] w-full max-w-4xl" sizes="(min-width: 896px) 896px, 100vw" />
          <div className="p-6 md:p-10">
            <span className="font-label-md text-xs font-bold uppercase tracking-[0.2em] text-secondary">{district.state} District</span>
            <h1 className="mt-2 font-display-lg text-3xl font-bold text-on-surface md:text-5xl">{district.name}</h1>
            {district.description && <p className="mt-4 max-w-4xl text-lg leading-8 text-on-surface-variant">{district.description}</p>}

            <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FACTS.filter(([key]) => district[key]).map(([key, label, icon]) => (
                <div key={key} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <dt className="text-xs font-label-md uppercase tracking-wider text-on-surface-variant"><i className={`fa-solid ${icon} mr-2 text-primary`} />{label}</dt>
                  <dd className="mt-2 whitespace-pre-line font-headline-md text-on-surface">{district[key]}</dd>
                </div>
              ))}
            </dl>

            {district.content && <section className="mt-10 border-t border-outline-variant/30 pt-8"><PostBody content={district.content} /></section>}
          </div>
        </article>
      </div>
    </main>
    <Footer />
  </>;
}
