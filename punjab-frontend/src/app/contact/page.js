import BreakingNews from "@/components/layout/BreakingNews";
import Link from "next/link";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ManagedText from "@/components/common/ManagedText";
import ContactForm from "@/components/contact/ContactForm";
import GoogleAd from "@/components/common/GoogleAd";
import { getBreakingNews, getManagedPages } from "@/features/news/news.api";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { richTextToPlainText } from "@/lib/richText";

export async function generateMetadata() {
  const managed = (await getManagedPages()).contact;
  return buildPageMetadata({ title: managed?.title || "Contact Us: Enquiries, Feedback & Support", description: richTextToPlainText(managed?.description) || "Get in touch with the Punjab Politics team for service enquiries, feedback, advertising, partnerships and general support using our simple contact form.", path: "/contact" });
}

export default async function ContactPage() {
  const [breakingNews, pages] = await Promise.all([getBreakingNews(), getManagedPages()]);
  const managed = pages.contact || {};
  if (managed.enabled === false) notFound();
  const details = [
    managed.email && { icon: "fa-envelope", label: "Email", value: managed.email, href: `mailto:${managed.email}` },
    managed.phone && { icon: "fa-phone", label: "Phone", value: managed.phone, href: `tel:${managed.phone.replace(/\s/g, "")}` },
    managed.location && { icon: "fa-location-dot", label: "Location", value: managed.location, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(managed.location)}` },
  ].filter(Boolean);
  const contactSections = managed.cards || [];

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="flex-grow bg-background">
        <div className="mx-auto max-w-7xl px-4 pt-8 md:px-16">
          <GoogleAd slot="7333331502" />
        </div>

        <section className="bg-gradient-to-br from-primary via-primary-container to-inverse-surface px-4 py-14 text-on-primary md:px-16 md:py-20">
          <div className="mx-auto max-w-5xl text-center">
                        <Breadcrumbs className="mb-6 [&_ol]:justify-center [&_ol]:text-white/70 [&_span]:!text-white [&_a:hover]:!text-white" items={[{ label: managed.title }]} />
<span className="font-label-sm text-xs font-bold uppercase tracking-[0.24em] text-white/70">{managed.eyebrow}</span>
            <h1 className="mt-3 font-display-lg text-4xl tracking-tight text-white md:text-5xl">{managed.title}</h1>
            <ManagedText text={managed.description} className="mx-auto mt-4 max-w-2xl space-y-3 font-body-md text-base leading-relaxed text-white/80" />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-16 lg:grid-cols-[0.8fr_1.4fr] lg:py-16">
          <aside className="rounded-xl border border-outline-variant/25 bg-surface p-6 shadow-sm md:p-8">
            {managed.detailsTitle && <h2 className="font-display-lg text-2xl text-on-surface">{managed.detailsTitle}</h2>}
            {managed.detailsDescription && <ManagedText text={managed.detailsDescription} className="mt-2 space-y-3 font-body-md text-sm leading-relaxed text-on-surface-variant" />}

            <div className="mt-7 space-y-4">
              {details.map((detail) => (
                <a key={detail.label} href={detail.href} target={detail.label === "Location" ? "_blank" : undefined} rel={detail.label === "Location" ? "noopener noreferrer" : undefined} className="group flex items-center gap-4 rounded-xl border border-outline-variant/25 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <i className={`fa-solid ${detail.icon}`} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-label-sm text-xs uppercase tracking-wider text-on-surface-variant">{detail.label}</span>
                    <span className="mt-1 block break-words font-body-md text-sm font-semibold text-on-surface group-hover:text-primary">{detail.value}</span>
                  </span>
                </a>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {contactSections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="rounded-xl bg-surface-container p-5">
                  <h3 className="font-headline-md text-base text-on-surface">{section.title}</h3>
                  <ManagedText text={section.text} className="mt-2 space-y-3 font-body-md text-sm leading-relaxed text-on-surface-variant" />
                  {section.href && <Link href={section.href} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Learn more <i className="fa-solid fa-arrow-right text-xs" /></Link>}
                </div>
              ))}
            </div>
          </aside>

          <ContactForm eyebrow={managed.formEyebrow} title={managed.formTitle} description={managed.formDescription} />
        </div>
      </main>

      <Footer />
    </>
  );
}
