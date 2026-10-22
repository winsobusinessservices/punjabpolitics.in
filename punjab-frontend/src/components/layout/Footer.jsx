import Link from "next/link";
import { slugify } from "@/lib/slugify";
import { getParties, getChiefMinisters, getKeyFigures, getFormerPMs } from "@/features/politicians/politician.api";
import { getFollowUs, getManagedPages, getPopularTags, getSectionVisibility, getSiteFooter } from "@/features/news/news.api";
import { getCurrentSite } from "@/lib/currentSite";
import { richTextToPlainText } from "@/lib/richText";

function KeywordColumn({ title, viewAllHref, items }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 border-b border-outline-variant/20 pb-2">
        <h3 className="font-label-md text-primary text-xs uppercase tracking-widest">{title}</h3>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-[10px] font-label-md text-secondary hover:underline flex-shrink-0">
            View All
          </Link>
        )}
      </div>
      <ul className="space-y-1.5 font-body-md text-on-surface-variant text-xs">
        {items.map(({ label, href }) => (
          <li key={label}>
            <Link href={href} className="hover:text-primary hover:translate-x-1 transition-all inline-block">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function Footer() {
  const [parties, chiefMinisters, keyFigures, formerPMs, popularTags, followUs, site, visibility, managedPages, footerConfig] = await Promise.all([
    getParties(),
    getChiefMinisters(),
    getKeyFigures(),
    getFormerPMs(),
    getPopularTags(),
    getFollowUs(),
    getCurrentSite().catch(() => ({ name: "Punjab Politics", description: "Punjab political news, elections and public affairs." })),
    getSectionVisibility(),
    getManagedPages(),
    getSiteFooter(),
  ]);

  const visibleSections = (footerConfig.sections || []).map((section) => ({
    ...section,
    links: (section.links || []).filter((link) => (!link.feature || visibility[link.feature] !== false) && (!link.pageKey || managedPages[link.pageKey]?.enabled !== false)),
  }));

  // Capped to keep the columns roughly even — each group's "View All" link
  // (or the dedicated page it mirrors) covers whatever isn't shown here.
  const partyLinks = parties.slice(0, 8).map((party) => ({
    label: party.abbreviation,
    href: `/category/${slugify(party.abbreviation)}`,
  }));

  const leaderLinks = [...keyFigures, ...formerPMs].slice(0, 8).map((leader) => ({
    label: leader.name,
    href: `/category/${slugify(leader.name)}`,
  }));

  const stateLinks = chiefMinisters.slice(0, 8).map((cm) => ({
    label: cm.state,
    href: `/category/${slugify(cm.state)}`,
  }));

  const tagLinks = popularTags.slice(0, 8).map((tag) => ({
    label: tag,
    href: `/category/${slugify(tag)}`,
  }));
  const contactPage = managedPages.contact || {};
  const contactDescription = richTextToPlainText(contactPage.description)
    || "Questions, corrections, story ideas or partnership enquiries? Our team would be glad to hear from you.";

  return (
    <>
      {contactPage.enabled !== false && (
        <section className="border-t border-outline-variant/20 bg-primary px-4 py-10 text-on-primary md:px-16 md:py-14" aria-labelledby="contact-cta-title">
          <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-3xl">
              <span className="font-label-sm text-xs font-bold uppercase tracking-[0.22em] text-white/65">Contact Us</span>
              <h2 id="contact-cta-title" className="mt-2 font-display-lg text-3xl tracking-tight text-white md:text-4xl">{contactPage.title || "We’re here to listen"}</h2>
              <p className="mt-3 max-w-2xl font-body-md text-sm leading-6 text-white/75 md:text-base">{contactDescription}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-label-md text-sm font-bold text-primary transition-transform hover:-translate-y-0.5 hover:bg-surface-container-low">
                Contact Us <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
              </Link>
              {contactPage.email && <a href={`mailto:${contactPage.email}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/35 px-6 py-3 font-label-md text-sm font-semibold text-white transition-colors hover:bg-white/10"><i className="fa-solid fa-envelope text-xs" aria-hidden="true" />Email Us</a>}
            </div>
          </div>
        </section>
      )}
      <footer className="bg-surface-container-highest border-t border-outline-variant/50 pt-10 pb-6">
      <div className="max-w-[1280px] mx-auto px-4 md:px-16">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div>
            <h2 className="font-headline-md text-primary mb-3 text-base">{site.name.toUpperCase()}</h2>
            <p className="font-body-md text-on-surface-variant mb-4 text-xs">
              {site.description || site.subtitle || "Political news, election coverage, and analysis."}
            </p>
            {visibility.follow_us !== false && Array.isArray(followUs) && followUs.length > 0 && (
              <div>
                <h3 className="mb-2 font-label-md text-[10px] uppercase tracking-widest text-primary">Follow Us</h3>
                <div className="flex gap-2 flex-wrap">
                  {followUs.map((social) => (
                    <a
                      key={social.id || `${social.label}-${social.url}`}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit our ${social.label || "website"}`}
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant/30 bg-surface px-2.5 py-1.5 font-label-md text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                    >
                      <i className={`${social.icon || "fa-solid fa-globe"} text-base`} aria-hidden="true" />
                      <span>{social.label || "Website"}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {visibleSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-label-md text-primary mb-2 text-xs">{section.title}</h3>
              <ul className="space-y-1 font-body-md text-on-surface-variant text-xs">
                {section.links.map((link) => <li key={`${link.label}-${link.href}`} className="cursor-pointer transition-all hover:translate-x-1 hover:text-primary"><Link href={link.href} className="inline-block">{link.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* Political keyword directory — every link here resolves through
            the same /category/[slug] registry the sidebars and home page
            use, so nothing here is a dead end. Given its own card treatment
            (lighter surface + border) so it reads as a distinct directory
            rather than a continuation of the utility links above. */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <i className="fa-solid fa-hashtag text-secondary text-sm" />
            <h2 className="font-headline-md text-primary text-sm uppercase tracking-widest">{footerConfig.directoryTitle}</h2>
            <div className="h-px flex-grow bg-outline-variant/30" />
          </div>
          <div className="bg-surface rounded-lg border border-outline-variant/20 p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-6">
            <KeywordColumn title={footerConfig.coverageTitle} items={footerConfig.coverageLinks || []} />
            {visibility.political_parties !== false && visibility.feature_parties !== false && <KeywordColumn title="Political Parties" viewAllHref="/parties" items={partyLinks} />}
            {visibility.key_figures !== false && visibility.feature_leaders !== false && <KeywordColumn title="Political Leaders" viewAllHref="/key-political-figures" items={leaderLinks} />}
            {visibility.state_leadership !== false && visibility.feature_states !== false && <KeywordColumn title="States" viewAllHref="/state" items={stateLinks} />}
            {visibility.popular_tags !== false && <KeywordColumn title="Popular Keywords" items={tagLinks} />}
          </div>
        </div>

        <div className="border-t border-outline-variant/30 pt-4 flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant font-label-sm text-[10px]">
          <p>&copy; 2026 {site.name}. All rights reserved.</p>
          <p>Designed and Developed By Winso Business Services Private Limited .</p>

          
        </div>
      </div>
      </footer>
    </>
  );
}
