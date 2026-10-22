import Link from "next/link";
import NewsCard from "@/components/news/NewsCard";
import NewsAsideLeft from "@/components/news/NewsAsideLeft";
import NewsAsideRight from "@/components/news/NewsAsideRight";
import Avatar from "@/components/common/Avatar";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import PostBody from "@/components/common/PostBody";
import Breadcrumbs from "@/components/common/Breadcrumbs";

const TYPE_BADGE = {
  state: "State Politics",
  party: "Political Party",
  topic: "Topic",
  politician: "Political Leader",
  house: "Parliament",
  election: "Elections",
  speech: "Speeches",
  rally: "Rallies",
};

const BIO_HEADING = {
  house: "About the House",
  election: "About the Process",
  speech: "Context",
  rally: "Context",
};

function FigureCard({ figure, accent, label, compact = false }) {
  if (compact) {
    return (
      <div className={`flex items-center gap-4 rounded-xl border-2 bg-surface-container p-4 sm:gap-5 sm:p-5 ${accent}`}>
        {figure.photo ? (
          <Avatar photo={figure.photo} fallbackPhoto={figure.photoFallback} alt={figure.name} gradient="from-primary to-primary-container" className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
        ) : (
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-container sm:h-24 sm:w-24">
            <span className="shimmer-sweep" aria-hidden="true" />
            <i className={`${figure.icon} relative z-10 text-3xl text-white`} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-headline-md text-xl text-on-surface">{figure.name}</h3>
          {figure.role && <p className="mt-1 font-body-md text-sm text-on-surface-variant">{figure.role}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center p-6 rounded-xl bg-surface-container border-2 ${accent}`}>
      <span className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant mb-4">{label}</span>
      {figure.photo ? (
        <Avatar photo={figure.photo} fallbackPhoto={figure.photoFallback} alt={figure.name} gradient="from-primary to-primary-container" className="w-28 h-28 mb-4" />
      ) : (
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mb-4 relative overflow-hidden">
          <span className="shimmer-sweep" aria-hidden="true" />
          <i className={`${figure.icon} text-white text-4xl relative z-10`} />
        </div>
      )}
      <h3 className="font-headline-md text-lg text-on-surface">{figure.name}</h3>
      <p className="font-body-md text-sm text-on-surface-variant mt-1">{figure.role}</p>
    </div>
  );
}

function CategoryDescription({ info }) {
  if (info.type !== "topic") {
    return <p className="mb-10 whitespace-pre-wrap break-words font-body-lg leading-relaxed text-on-surface-variant">{info.description}</p>;
  }

  if (String(info.description || "").includes("<")) {
    return <PostBody content={info.description} className="mb-10 space-y-5" />;
  }

  const blocks = String(info.description || "").trim().split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="mb-10 space-y-5">
      {blocks.map((block, index) => {
        const text = block.trim();
        const markdownHeading = text.match(/^#{1,3}\s+(.+)$/);
        const isShortHeading = !text.includes("\n") && text.length <= 100 && !/[.!?]$/.test(text);
        if (markdownHeading || isShortHeading) {
          return (
            <h2 key={`${text}-${index}`} className="border-l-4 border-primary pl-3 font-headline-lg text-xl text-primary">
              {markdownHeading?.[1] || text}
            </h2>
          );
        }
        return (
          <p key={`${text.slice(0, 30)}-${index}`} className="whitespace-pre-wrap break-words font-body-lg leading-relaxed text-on-surface-variant">
            {text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Shared layout for anything resolved like a "category": states, parties,
 * topics, individual politicians (via /category/[slug]), and — reusing the
 * same view — the Lok Sabha / Rajya Sabha detail pages. `info.facts` and
 * `info.composition` are house-specific extras; `info.profile` is the
 * state/party-specific extra. Both are optional and mutually exclusive.
 */
export default function CategoryDetailView({ info }) {
  const bioHeading = BIO_HEADING[info.type] || "Background & Career";
  const totalCompositionSeats = info.composition?.reduce((sum, row) => sum + row.seats, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <NewsAsideLeft />

      {/* Center: Category / person / house detail */}
      <article className="order-1 lg:order-2 flex-grow lg:w-3/5">
        <span className="inline-block px-3 py-1 bg-primary text-on-primary text-xs font-label-md uppercase tracking-widest rounded-sm mb-4">
          {TYPE_BADGE[info.type]}
        </span>
        <h1 className="font-display-lg font-bold text-3xl md:text-4xl text-on-surface tracking-tight leading-tight mb-4">
          {info.label}
          {info.type === "state" && " Politics"}
        </h1>
        <CategoryDescription info={info} />

        {info.type !== "topic" && (
          <>
            <h2 className="font-headline-lg text-primary text-xl mb-6">
              {info.type === "politician" ? "Profile" : "Current vs. Opposition"}
            </h2>
            <div className={`grid grid-cols-1 gap-6 mb-12 ${info.type === "politician" ? "" : "sm:grid-cols-2"}`}>
              <FigureCard figure={info.current} accent="border-primary" label={info.currentLabel} compact={info.type === "politician"} />
              {info.type !== "politician" && <FigureCard figure={info.opposition} accent="border-secondary" label={info.oppositionLabel} />}
            </div>
          </>
        )}

        {info.bio && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              {bioHeading}
            </h2>
            <div className="space-y-4">
              {info.bio.map((paragraph, index) => (
                <p key={index} className="font-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}

        {(info.born || info.education) && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              Personal &amp; Education
            </h2>
            <div className="flex flex-wrap gap-3 mb-4">
              {info.born && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-cake-candles text-primary mr-2" />
                  Born {info.born}
                  {info.birthPlace ? `, ${info.birthPlace}` : ""}
                  {info.died ? ` · Died ${info.died}` : ""}
                </span>
              )}
            </div>
            {info.education?.length > 0 && (
              <ul className="space-y-2">
                {info.education.map((line, index) => (
                  <li key={index} className="flex items-start gap-2 font-body-md text-on-surface-variant leading-relaxed">
                    <i className="fa-solid fa-graduation-cap text-primary mt-1 flex-shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {info.careerTimeline?.length > 0 && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              Career Timeline
            </h2>
            <ol className="relative border-l-2 border-outline-variant/30 ml-2 space-y-6">
              {info.careerTimeline.map((role, index) => (
                <li key={index} className="ml-6">
                  <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-primary border-2 border-surface" style={{ marginTop: "2px" }} />
                  <span className="font-label-sm text-primary text-xs uppercase tracking-wide">
                    {role.fromYear} &ndash; {role.toYear || "Present"}
                  </span>
                  <h4 className="font-headline-md text-sm text-on-surface mt-0.5">{role.role}</h4>
                  {role.organization && (
                    <p className="font-body-md text-xs text-on-surface-variant">{role.organization}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {info.facts && (
          <div className="mb-12">
            <div className="flex flex-wrap gap-3">
              {info.facts.map((fact, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20"
                >
                  <i className={`${fact.icon} text-primary mr-2`} />
                  {fact.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {info.profile && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              History &amp; Achievements
            </h2>

            {info.profile.image && (
              <ImagePlaceholder
                image={info.profile.image}
                alt={`${info.label} landscape`}                
                className="mb-6 aspect-[12/10] w-full rounded-lg object-cover object-center"
                sizes="(min-width: 1024px) 60vw, 100vw" 
              />
            )}

            <div className="flex flex-wrap gap-3 mb-6">
              {info.profile.capital && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-city text-primary mr-2" />
                  Capital: {info.profile.capital}
                </span>
              )}
              {info.profile.currentCmName && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-user-tie text-primary mr-2" />
                  Current CM: {info.profile.currentCmName}
                </span>
              )}
              {info.profile.oppositionParty && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-people-group text-primary mr-2" />
                  Opposition: {info.profile.oppositionParty}
                </span>
              )}
              {info.profile.founded && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-flag text-primary mr-2" />
                  Founded / Formed: {info.profile.founded}
                  {info.profile.foundedPlace ? ` in ${info.profile.foundedPlace}` : ""}
                </span>
              )}
              {info.profile.founders?.length > 0 && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-user-plus text-primary mr-2" />
                  Founded by {info.profile.founders.join(", ")}
                </span>
              )}
              {info.profile.ideology && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-scroll text-primary mr-2" />
                  {info.profile.ideology}
                </span>
              )}
              {info.profile.yearsInPower && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-landmark text-primary mr-2" />
                  {info.profile.yearsInPower}
                </span>
              )}
              {info.profile.yearsAsRuler != null && (
                <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20">
                  <i className="fa-solid fa-user-tie text-primary mr-2" />
                  {info.profile.rulingParty} in power since {info.profile.rulerSince} (~{info.profile.yearsAsRuler} years)
                </span>
              )}
            </div>

            {info.profile.history && (
              <div className="mb-4">
                <h3 className="font-label-md font-bold text-primary text-xs uppercase tracking-widest mb-2">History</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">{info.profile.history}</p>
              </div>
            )}

            {info.profile.achievements && (
              <div>
                <h3 className="font-label-md font-bold text-primary text-xs uppercase tracking-widest mb-2">Achievements</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">{info.profile.achievements}</p>
              </div>
            )}
          </div>
        )}

        {info.composition && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              Party-wise Composition
            </h2>
            <div className="space-y-3">
              {info.composition.map((row) => {
                const pct = Math.round((row.seats / totalCompositionSeats) * 1000) / 10;
                return (
                  <div key={row.party}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-label-md text-on-surface">{row.party}</span>
                      <span className="font-label-md text-on-surface-variant">
                        {row.seats} seats <span className="text-outline">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.colorClass || "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {info.relatedNews.length > 0 && (
          <div className="mb-12">
            <h2 className="font-headline-lg text-primary text-xl mb-6 border-b border-outline-variant/30 pb-2">
              {info.label} News
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {info.relatedNews.map((story) => (
                <NewsCard key={story.slug || story.id} variant="stacked" story={story} />
              ))}
            </div>
          </div>
        )}
      </article>

      <NewsAsideRight />
    </div>
  );
}

export function CategoryBreadcrumb({ label }) {
  return <Breadcrumbs items={[{ label: "Categories", href: "/category" }, { label }]} />;
}

export function RecommendedNewsSection({ recommendedNews }) {
  return (
    <section className="w-full bg-surface py-10 border-t border-outline-variant/30">
      <div className="max-w-[1280px] mx-auto px-4 md:px-16">
        <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2">
          <h2 className="font-display-lg text-2xl md:text-3xl text-primary tracking-tight">Recommended News</h2>
          <Link href="/" className="font-label-md text-secondary hover:underline flex items-center gap-1 text-sm">
            VIEW ALL <i className="fa-solid fa-arrow-right text-xs" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {recommendedNews.map((story) => (
            <NewsCard key={story.slug || story.id} variant="stacked" story={story} />
          ))}
        </div>
      </div>
    </section>
  );
}
