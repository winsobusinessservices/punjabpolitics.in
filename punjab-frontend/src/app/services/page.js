import Link from "next/link";
import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getBreakingNews, getListingPages } from "@/features/news/news.api";
import { notFound } from "next/navigation";
import { getCurrentSite } from "@/lib/currentSite";
import { buildPageMetadata } from "@/lib/seo";
import { withSiteHeaders } from "@/lib/siteRequest";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

async function getServices() {
  const response = await fetch(`${API}/services`, await withSiteHeaders({ cache: "no-store" }));
  if (!response.ok) throw new Error("Unable to load services");
  return (await response.json()).services || [];
}

export async function generateMetadata() {
  const page = (await getListingPages()).services || {};
  return buildPageMetadata({ title: page.title || "Professional Services from Punjab Politics", description: page.description || "Explore the services offered by Punjab Politics and learn how our team can help you. Browse each service in detail and get in touch to start a conversation.", path: "/services" });
}

export default async function ServicesPage() {
  const site = await getCurrentSite();
  if (!site?.services_enabled) notFound();
  const [services, breakingNews, pages] = await Promise.all([getServices(), getBreakingNews(), getListingPages()]);
  const page = pages.services || {};

  return <>
    <BreakingNews text={breakingNews} />
    <Header />
    <main className="min-h-[60vh] bg-background px-4 py-12 md:px-16">
      <div className="mx-auto max-w-6xl">
                <Breadcrumbs className="mb-6" items={[{ label: page.title }]} />
{page.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{page.eyebrow}</p>}
        <h1 className="mt-2 font-display-lg text-4xl text-primary">{page.title}</h1>
        {page.description && <p className="mt-3 max-w-2xl text-on-surface-variant">{page.description}</p>}
        {services.length ? <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => <Link key={service.id} href={`/services/${service.slug}`} className="group rounded-xl border border-outline-variant/25 bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><i className={`fa-solid ${service.icon || "fa-briefcase"}`} /></span>
            <h2 className="mt-5 font-headline-md text-xl text-on-surface group-hover:text-primary">{service.title}</h2>
            {service.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">{service.summary}</p>}
            {page.itemLinkLabel && <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">{page.itemLinkLabel} <i className="fa-solid fa-arrow-right text-xs" /></span>}
          </Link>)}
        </div> : <p className="mt-10 rounded-xl border border-outline-variant/25 bg-surface p-8 text-center text-on-surface-variant">{page.emptyText}</p>}
      </div>
    </main>
    <Footer />
  </>;
}
