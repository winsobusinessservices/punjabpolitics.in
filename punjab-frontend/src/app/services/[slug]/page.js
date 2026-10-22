import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PostBody from "@/components/common/PostBody";
import { getBreakingNews } from "@/features/news/news.api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";
import { withSiteHeaders } from "@/lib/siteRequest";
async function load(slug) {
  const response = await fetch(`${API}/services/${encodeURIComponent(slug)}`, await withSiteHeaders({ next: { revalidate: 60 } }));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load service");
  return (await response.json()).service;
}
export async function generateMetadata({ params }) { const service = await load((await params).slug); return service ? { title: service.seo_title || service.title, description: service.seo_description || service.summary } : {}; }
export default async function ServicePage({ params }) {
  const [service, breakingNews] = await Promise.all([load((await params).slug), getBreakingNews()]);
  if (!service) notFound();
  return <><BreakingNews text={breakingNews} /><Header /><main className="bg-background px-4 py-12 md:px-16"><div className="mx-auto max-w-full"><Breadcrumbs items={[{ label: "Services", href: "/services" }, { label: service.title }]} /></div><article className="mx-auto max-w-full rounded-xl border border-outline-variant/25 bg-surface p-6 shadow-sm md:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><i className={`fa-solid ${service.icon || "fa-briefcase"}`} /></div><h1 className="mt-5 font-display-lg text-4xl text-primary">{service.title}</h1>{service.summary && <p className="mt-4 text-lg leading-7 text-on-surface-variant">{service.summary}</p>}<PostBody content={service.content} className="mt-8 space-y-5" />{service.cta_url && <a href={service.cta_url} className="mt-8 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary">{service.cta_label || "Get started"}</a>}</article></main><Footer /></>;
}
