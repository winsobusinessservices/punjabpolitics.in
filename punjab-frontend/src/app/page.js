import HomeVideo from "@/components/home/HomeVideo";
import Link from "next/link";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AdSlot from "@/components/common/AdSlot";
import GoogleAd from "@/components/common/GoogleAd";
import HeroNews from "@/components/news/HeroNews";
import NewsCard from "@/components/news/NewsCard";
import TrendingNews from "@/components/news/TrendingNews";
import PollOfTheDay from "@/components/news/PollOfTheDay";
import PoliticianCard from "@/components/politician/PoliticianCard";
import CMCard from "@/components/politician/CMCard";
import PartyCard from "@/components/politician/PartyCard";
import VidhanSabhaGrid from "@/components/politician/VidhanSabhaGrid";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import EmptyState from "@/components/common/EmptyState";
import { slugify } from "@/lib/slugify";
import { formatViews } from "@/lib/formatViews";

import {
  getBreakingNews,
  getSectionVisibility,
  getHeroSlides,
  getTopStories,
  getEditorialOpinion,
  getRegionalFocus,
  getInDepthAnalysis,
  getMultimediaHub,
  getPressConferenceArchive,
  getVideoHighlights,
  getXFeed,
  getFacebookUpdates,
  getTrending,
  getDigitalPulse,
  getTheBriefing,
  getElectionResults,
  getPopularTags,
  getCategoryDefinitions,
  getLegislativeTracker,
  getPoliticalKeywords,
  getPartyPulse,
  getConstituencySpotlight,
  getCmCorner,
  getPmCorner,
  getPoliticalCalendar,
  getFromTheArchives,
  getFactCheck,
  getPollOfTheDay,
  getRtiCorner,
  getFollowUs,
  getBlogs,
  getLatestPosts,
  getAllVideos,
  getVoicesOfNation,
  getOpinionLeaders,
  getHomepageLabels,
  getHomepageSections,
  getHomeVideo,
  getHomepageServices,
  getVidhanSabhas,
} from "@/features/news/news.api";
import {
  getKeyFigures,
  getFormerPMs,
  getChiefMinisters,
  getParties,
} from "@/features/politicians/politician.api";
import { getParliamentSummary } from "@/features/parliament/parliament.api";
import { getStates, getUnionTerritories } from "@/features/geography/geography.api";

export const metadata = { alternates: { canonical: "/" } };

function SectionHeader({ title, viewAllHref }) {
  return (
    <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2">
      <h1 className="font-display-lg text-2xl md:text-3xl text-primary tracking-tight">{title}</h1>
      {viewAllHref && (
        <a href={viewAllHref} className="font-label-md text-secondary hover:underline flex items-center gap-1 text-sm">
          VIEW ALL <i className="fa-solid fa-arrow-right text-xs" />
        </a>
      )}
    </div>
  );
}

// Sidebar keyword pill group — every href resolves through the same
// /category/[slug] registry the footer and other sidebars already use.
function KeywordTagGroup({ title, icon, tags }) {
  const safeTags = Array.isArray(tags) ? tags : [];
  return (
    <div className="pt-4 border-t border-outline-variant/30">
      <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
        <h3 className="font-headline-md text-primary tracking-tight text-lg">{title}</h3>
        <i className={`${icon} text-secondary text-lg`} />
      </div>
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
        {safeTags.map((tag) => (
          <Link
            key={tag}
            href={`/category/${slugify(tag)}`}
            className="px-2 py-1 bg-surface-container-high text-on-surface font-bold text-xs rounded-sm border border-outline-variant/20 hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
          >
            {tag}
          </Link>
        ))}
        {!safeTags.length && <p className="text-sm text-on-surface-variant">No items are available for this website yet.</p>}
      </div>
    </div>
  );
}

function SocialPostCard({ post, children }) {
  const className = "bg-surface p-3 rounded-lg border border-outline-variant/20 flex flex-col gap-2 transition-colors hover:border-primary/40";
  const rawHref = String(post.url || post.link || "").trim();
  const embeddedUrl = rawHref.match(/https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s"'<>]+\/status\/\d+[^\s"'<>]*/i)?.[0];
  const href = (embeddedUrl || rawHref).replace(/&amp;/g, "&");
  if (!href) return <div className={className}>{children}</div>;
  let host = "";
  try { host = new URL(href).hostname.replace(/^www\./, ""); } catch { /* Show the safe external-link fallback below. */ }
  if (["facebook.com", "m.facebook.com"].includes(host)) {
    const src = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(href)}&show_text=true&width=500`;
    return <iframe src={src} title="Facebook post" loading="lazy" className="h-[500px] w-full rounded-lg border-0 bg-surface" allow="encrypted-media; clipboard-write" />;
  }
  const tweetId = ["x.com", "twitter.com", "mobile.twitter.com"].includes(host) ? href.match(/\/status\/(\d+)/)?.[1] : null;
  if (tweetId) {
    return <iframe src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=light`} title="X post" loading="lazy" className="h-[520px] w-full rounded-lg border-0 bg-surface" allowFullScreen />;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>Open social post</a>;
}

function AddedHomepageSection({ section, sources, order }) {
  if (!section?.enabled) return null;
  const limit = Math.min(12, Math.max(1, Number(section.limit) || 3));
  const sourceItems = Array.isArray(sources[section.type]) ? sources[section.type] : [];
  const items = sourceItems.slice(0, limit);

  return (
    <section className="border-t border-outline-variant/30 pt-6" style={Number.isFinite(order) ? { order } : undefined}>
      <SectionHeader title={section.title} viewAllHref={section.viewAllHref || undefined} />
      {!items.length && <EmptyState compact icon="fa-box-open" title={`${section.title} is not available yet`} description="Content added for this website will appear here automatically." />}
      {section.type === "leaders" && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{items.map((leader) => <PoliticianCard key={leader.id} name={leader.name} subtitle={leader.position} photo={leader.photo} photoFallback={leader.photoFallback} href={`/category/${slugify(leader.name)}`} />)}</div>}
      {section.type === "parties" && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{items.map((party) => <PartyCard key={party.id} name={party.name} abbreviation={party.abbreviation} founded={party.founded} photo={party.photo} photoFallback={party.photoFallback} href={`/category/${party.slug}`} />)}</div>}
      {section.type === "services" && <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((service) => <Link key={service.id} href={`/services/${service.slug}`} className="group flex min-h-56 flex-col rounded-xl border border-outline-variant/25 bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><i className={`fa-solid ${service.icon || "fa-briefcase"}`} /></span><h3 className="mt-4 font-headline-md text-lg text-on-surface group-hover:text-primary">{service.title}</h3>{service.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">{service.summary}</p>}<span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary">Learn more <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" /></span></Link>)}</div>}
      {section.type === "videos" && <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((video) => <a key={video.id} href={video.videoUrl || "/videos"} target={video.videoUrl ? "_blank" : undefined} rel={video.videoUrl ? "noopener noreferrer" : undefined} className="group rounded-xl border border-outline-variant/25 bg-surface p-4"><ImagePlaceholder image={video.image} alt={video.title} icon="fa-solid fa-video" className="aspect-video w-full rounded-lg" /><h3 className="mt-3 font-headline-md text-base text-on-surface group-hover:text-primary">{video.title}</h3></a>)}</div>}
      {["top_news", "latest_news", "blogs"].includes(section.type) && <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{items.map((story) => <NewsCard key={`${section.id}-${story.id}`} variant="stacked" story={story} />)}</div>}
    </section>
  );
}

function LeadershipCorner({ corner, emptyName, linkHref, linkLabel }) {
  const initiatives = Array.isArray(corner?.initiatives)
    ? corner.initiatives.filter((initiative) => initiative?.title || initiative?.excerpt)
    : [];
  return (
    <article className="group flex flex-col gap-8 md:flex-row">
      <ImagePlaceholder
        icon="fa-solid fa-user-tie"
        image={corner?.image}
        alt={corner?.name || emptyName}
        gradient="primary"
        className="aspect-square w-full rounded-lg md:w-1/2"
        iconClassName="text-6xl"
      />
      <div className="flex w-full flex-col justify-center md:w-1/2">
        {corner?.tag && <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary">{corner.tag}</span>}
        <h3 className="mb-4 font-display-lg text-2xl text-on-surface md:text-3xl">{corner?.name || emptyName}</h3>
        {corner?.quote && <p className="mb-6 text-sm italic text-on-surface-variant">&ldquo;{corner.quote}&rdquo;</p>}
        <div className="space-y-4">
          {initiatives.map((initiative, index) => (
            <div key={`${initiative.title || "initiative"}-${index}`} className="border-l-4 border-primary pl-4">
              {initiative.title && <h4 className="font-headline-md text-sm text-primary">{initiative.title}</h4>}
              {initiative.excerpt && <p className="text-xs text-on-surface-variant">{initiative.excerpt}</p>}
            </div>
          ))}
          {!initiatives.length && <EmptyState compact icon="fa-list-check" title="No initiatives available" description="Add initiative details from Site Data in the editorial panel." />}
        </div>
        <Link href={linkHref} className="mt-8 flex items-center gap-1 font-label-sm text-primary hover:underline">
          {linkLabel} <i className="fa-solid fa-arrow-right text-xs" />
        </Link>
      </div>
    </article>
  );
}

export default async function Home() {
  const [
    sectionVisibility,
    homepageLabels,
    homepageSections,
    homeVideo,
    homepageServices,
    breakingNews,
    heroSlides,
    topStories,
    editorialOpinion,
    regionalFocus,
    inDepthAnalysis,
    multimediaHub,
    pressConference,
    videoHighlights,
    xFeed,
    facebookUpdates,
    trending,
    digitalPulse,
    theBriefing,
    electionResults,
    popularTags,
    siteCategories,
    legislativeTracker,
    politicalKeywords,
    partyPulse,
    constituencySpotlight,
    cmCorner,
    pmCorner,
    keyFigures,
    formerPMs,
    chiefMinisters,
    voicesOfNation,
    opinionLeaders,
    politicalCalendar,
    fromTheArchives,
    factCheck,
    pollOfTheDay,
    rtiCorner,
    followUs,
    blogs,
    parties,
    parliamentSummary,
    states,
    unionTerritories,
    latestPosts,
    allVideos,
    vidhanSabhas,
  ] = await Promise.all([
    getSectionVisibility(),
    getHomepageLabels(),
    getHomepageSections(),
    getHomeVideo(),
    getHomepageServices(),
    getBreakingNews(),
    getHeroSlides(),
    getTopStories(),
    getEditorialOpinion(),
    getRegionalFocus(),
    getInDepthAnalysis(),
    getMultimediaHub(),
    getPressConferenceArchive(),
    getVideoHighlights(),
    getXFeed(),
    getFacebookUpdates(),
    getTrending(),
    getDigitalPulse(),
    getTheBriefing(),
    getElectionResults(),
    getPopularTags(),
    getCategoryDefinitions(),
    getLegislativeTracker(),
    getPoliticalKeywords(),
    getPartyPulse(),
    getConstituencySpotlight(),
    getCmCorner(),
    getPmCorner(),
    getKeyFigures(),
    getFormerPMs(),
    getChiefMinisters(),
    getVoicesOfNation(),
    getOpinionLeaders(),
    getPoliticalCalendar(),
    getFromTheArchives(),
    getFactCheck(),
    getPollOfTheDay(),
    getRtiCorner(),
    getFollowUs(),
    getBlogs(),
    getParties(),
    getParliamentSummary(),
    getStates(),
    getUnionTerritories(),
    getLatestPosts(10),
    getAllVideos(),
    getVidhanSabhas(),
  ]);

  const homeVideoSection = (placement) => homeVideo?.placement === placement && (
    <section className={sectionClass("homeVideo", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("home_video") }}>
      <div className="mx-auto px-4 md:px-16">
        <SectionHeader title={homeVideo.title} />
        <div className="max-w-4xl"><HomeVideo src={homeVideo.src} poster={homeVideo.poster} title={homeVideo.title} /></div>
      </div>
    </section>
  );

  const featureForSection = {
    latest_blogs: "feature_blogs",
    multimedia_hub: "feature_videos",
    press_conferences: "feature_videos",
    key_figures: "feature_leaders",
    former_prime_ministers: "feature_leaders",
    state_leadership: "feature_states",
    regional_focus: "feature_states",
    political_parties: "feature_parties",
    cm_corner: "feature_leaders",
  };
  const sectionClass = (key, base = "") => {
    const feature = featureForSection[key];
    const hidden = sectionVisibility[key] === false || (feature && sectionVisibility[feature] === false);
    return `${base}${hidden ? " hidden" : ""}`.trim();
  };
  const isSectionVisible = (key) => {
    const feature = featureForSection[key];
    return sectionVisibility[key] !== false && (!feature || sectionVisibility[feature] !== false);
  };
  const sectionLabel = (key) => homepageLabels[key] || { title: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) };
  const addedFeatureForType = { leaders: "feature_leaders", blogs: "feature_blogs", videos: "feature_videos", parties: "feature_parties" };
  const homepageSectionSources = { top_news: topStories, latest_news: latestPosts, leaders: keyFigures, services: homepageServices, blogs, videos: allVideos, parties };
  const visibleHomepageSections = homepageSections.filter((section) => section.type !== "builtin" && (!addedFeatureForType[section.type] || sectionVisibility[addedFeatureForType[section.type]] !== false));
  const afterHeroSections = visibleHomepageSections.filter((section) => section.placement === "after_hero");
  const mainContentSections = visibleHomepageSections.filter((section) => section.placement !== "after_hero");
  const defaultMainSectionOrder = ["top_stories", "vidhan_sabha", "editorial_opinion", "latest_blogs", "regional_focus", "in_depth_analysis", "multimedia_hub", "main_ad", "key_figures", "former_prime_ministers", "voices_of_nation", "state_leadership", "political_parties", "parliament", "digital_dispatches", "cm_corner", "pm_corner", "press_conferences"];
  const savedMainOrder = homepageSections
    .filter((section) => section.placement !== "after_hero")
    .map((section) => section.type === "builtin" ? section.sectionKey : section.id)
    .filter(Boolean);
  const configuredMainOrder = homepageSections.some((section) => section.type === "builtin")
    ? savedMainOrder
    : [...defaultMainSectionOrder, ...savedMainOrder];
  const mainSectionOrder = [...configuredMainOrder, ...defaultMainSectionOrder.filter((key) => !configuredMainOrder.includes(key))];
  const homepageOrder = (key) => {
    const index = mainSectionOrder.indexOf(key);
    return index < 0 ? mainSectionOrder.length : index;
  };

  return (
    <>
      {sectionVisibility.breaking_news !== false && <BreakingNews text={breakingNews} />}
      <Header />

      <main className="w-full bg-background flex-grow">
        <div className={sectionClass("hero_news", "max-w-full mx-auto px-4 md:px-16 flex flex-col lg:flex-row gap-6 py-6")}>
          <HeroNews slides={heroSlides} />
        </div>

        {homeVideoSection("after_hero")}

        {afterHeroSections.length > 0 && <div className="mx-auto flex max-w-full flex-col gap-6 px-4 pb-6 md:px-16">
          {afterHeroSections.map((section) => <AddedHomepageSection key={section.id} section={section} sources={homepageSectionSources} />)}
        </div>}

        <div className="max-w-full mx-auto px-4 md:px-16 flex flex-col lg:flex-row gap-6 py-6">
          {/* Main column */}
          <div className="flex-grow flex flex-col gap-6 lg:w-2/3">

            {/* Top Stories */}
            <section className={sectionClass("top_stories")} style={{ order: homepageOrder("top_stories") }}>
              <SectionHeader title={sectionLabel("top_stories").title} viewAllHref={sectionLabel("top_stories").viewAllHref} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {topStories.map((story) => (
                  <NewsCard key={story.id} variant="stacked" story={story} />
                ))}
                {!topStories.length && <div className="md:col-span-3"><EmptyState compact icon="fa-newspaper" title="No top stories yet" description="Approved stories for this website will appear here." /></div>}
              </div>
            </section>

            {/* Punjab Vidhan Sabha */}
            <section className={sectionClass("vidhan_sabha", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("vidhan_sabha") }}>
              <SectionHeader title={sectionLabel("vidhan_sabha").title} />
              <VidhanSabhaGrid items={vidhanSabhas} />
            </section>

            {/* Editorial Opinion */}
            <section className={sectionClass("editorial_opinion", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("editorial_opinion") }}>
              <SectionHeader title={sectionLabel("editorial_opinion").title} viewAllHref={sectionLabel("editorial_opinion").viewAllHref} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {editorialOpinion.map((story) => (
                  <NewsCard key={story.id} variant="horizontal" story={story} />
                ))}
                {!editorialOpinion.length && <div className="md:col-span-2"><EmptyState compact icon="fa-pen-nib" title="No editorial stories yet" description="Published opinion and analysis will appear here." /></div>}
              </div>
            </section>

            {/* Latest Blogs */}
            <section className={sectionClass("latest_blogs", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("latest_blogs") }}>
              <SectionHeader title={sectionLabel("latest_blogs").title} viewAllHref={sectionLabel("latest_blogs").viewAllHref} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogs.slice(0, 3).map((blog) => (
                  <NewsCard key={blog.id} variant="stacked" story={blog} />
                ))}
                {!blogs.length && <div className="md:col-span-3"><EmptyState compact icon="fa-blog" title="No blogs published yet" description="Approved blogs for this website will appear here." /></div>}
              </div>
            </section>

            {/* Regional Focus */}
            <section className={sectionClass("regional_focus", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("regional_focus") }}>
              <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2 flex-wrap gap-3">
                <h1 className="font-display-lg text-2xl md:text-3xl text-primary tracking-tight w-full sm:w-auto">{sectionLabel("regional_focus").title}</h1>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {regionalFocus.states.map((state, index) => (
                    <Link
                      key={state}
                      href={`/category/${slugify(state)}`}
                      className={
                        index === 0
                          ? "px-3 py-1 bg-primary text-on-primary text-xs rounded-sm font-label-sm"
                          : "px-3 py-1 bg-surface border border-outline-variant/50 text-on-surface text-xs rounded-sm hover:bg-surface-variant transition-colors font-label-sm"
                      }
                    >
                      {state}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {regionalFocus.stories.map((story) => (
                  <NewsCard key={story.id} variant="compact" story={story} />
                ))}
                {!regionalFocus.stories.length && <div className="md:col-span-3"><EmptyState compact icon="fa-map-location-dot" title="No regional stories yet" description="Stories connected to states and regions will appear here." /></div>}
              </div>
            </section>

            {/* In-Depth Analysis */}
            {inDepthAnalysis && (
              <section className={sectionClass("in_depth_analysis", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("in_depth_analysis") }}>
                <SectionHeader title={sectionLabel("in_depth_analysis").title} />
                <article className="group flex flex-col md:flex-row gap-6 cursor-pointer">
                  <ImagePlaceholder
                    icon={inDepthAnalysis.icon}
                    image={inDepthAnalysis.image}
                    alt={inDepthAnalysis.title}
                    gradient="primary"
                    className="w-full md:w-1/2 aspect-video rounded-lg"
                    iconClassName="text-5xl"
                  />
                  <div className="w-full md:w-1/2 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-error uppercase tracking-wider mb-2">
                      {inDepthAnalysis.tag}
                    </span>
                    <h3 className="font-display-lg text-xl md:text-2xl text-on-surface group-hover:text-primary transition-colors leading-tight mb-3">
                      {inDepthAnalysis.title}
                    </h3>
                    <p className="font-body-md text-on-surface-variant text-sm mb-4">{inDepthAnalysis.excerpt}</p>
                    <Link href={`/news/${inDepthAnalysis.slug}`} className="font-label-sm text-primary hover:underline flex items-center gap-1">
                      READ FULL REPORT <i className="fa-solid fa-arrow-right text-xs" />
                    </Link>
                  </div>
                </article>
              </section>
            )}
            {!inDepthAnalysis && isSectionVisible("in_depth_analysis") && (
              <section className="border-t border-outline-variant/30 pt-6" style={{ order: homepageOrder("in_depth_analysis") }}>
                <SectionHeader title={sectionLabel("in_depth_analysis").title} />
                <EmptyState compact icon="fa-newspaper" title="No in-depth analysis yet" description="Published analysis for this website will appear here." />
              </section>
            )}

            {homeVideo?.placement === "main_content" && <div style={{ order: homepageOrder("main_ad") }}>{homeVideoSection("main_content")}</div>}

            {/* Advertisement banner — honours the existing "main_ad" visibility toggle */}
            {sectionVisibility.main_ad !== false && <div style={{ order: homepageOrder("main_ad") }}><AdSlot placement="home_banner" /></div>}

            {/* Multimedia Hub */}
            <section className={sectionClass("multimedia_hub", "bg-inverse-surface text-inverse-on-surface py-6 rounded-xl px-6")} style={{ order: homepageOrder("multimedia_hub") }}>
              <div className="flex items-center justify-between mb-6 border-b border-white/20 pb-2">
                <h1 className="font-display-lg text-2xl md:text-3xl tracking-tight text-white">{sectionLabel("multimedia_hub").title}</h1>
                <Link href={sectionLabel("multimedia_hub").viewAllHref} className="font-label-md text-inverse-primary hover:underline flex items-center gap-1 text-sm">
                  MORE VIDEOS <i className="fa-solid fa-arrow-right text-xs" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {multimediaHub.map((video) => (
                  <a
                    key={video.id}
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Play video: ${video.title}`}
                    className="group cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-inverse-primary"
                  >
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3">
                      <ImagePlaceholder icon="fa-solid fa-video" image={video.image} alt={video.title} gradient="inverse" className="w-full h-full" iconClassName="text-4xl" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        <i className="fa-solid fa-circle-play text-white text-5xl opacity-90 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                    <h3 className="font-headline-md text-lg text-white group-hover:text-inverse-primary transition-colors leading-snug">
                      {video.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] text-white/70 mt-1">
                      <i className="fa-regular fa-eye" /> {formatViews(video.views)}
                    </span>
                  </a>
                ))}
                {!multimediaHub.length && <div className="md:col-span-2"><EmptyState compact icon="fa-video" title="No videos available" description="Published videos for this website will appear here." /></div>}
              </div>
            </section>


            {/* Key Political Figures */}
            <section className={sectionClass("key_figures")} style={{ order: homepageOrder("key_figures") }}>
              <SectionHeader title={sectionLabel("key_figures").title} viewAllHref={sectionLabel("key_figures").viewAllHref} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {keyFigures.map((figure) => (
                  <PoliticianCard key={figure.id} name={figure.name} subtitle={figure.position} photo={figure.photo} photoFallback={figure.photoFallback} href={`/category/${slugify(figure.name)}`} />
                )).slice(0, 5)}
                {!keyFigures.length && <div className="col-span-full"><EmptyState compact icon="fa-user-tie" title="No leaders available" description="Add visible political leaders for this website from Site Data." /></div>}
              </div>
            </section>

            {/* Former  Ministers */}
            <section className={sectionClass("former_prime_ministers", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("former_prime_ministers") }}>
              <SectionHeader title={sectionLabel("former_prime_ministers").title} viewAllHref={sectionLabel("former_prime_ministers").viewAllHref} />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {formerPMs.map((pm) => (
                  <CMCard key={pm.id} name={pm.name} subtitle={pm.tenure} photo={pm.photo} href={`/category/${slugify(pm.name)}`} />
                )).slice(0, 5)}
                {!formerPMs.length && <div className="col-span-full"><EmptyState compact icon="fa-users" title="No former prime ministers available" description="Visible records will appear here after they are added." /></div>}
              </div>
            </section>

            {/* Voices of the Nation */}
            <section className={sectionClass("voices_of_nation", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("voices_of_nation") }}>
              <SectionHeader title={sectionLabel("voices_of_nation").title} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {voicesOfNation.map((voice) => (
                  <div key={voice.id} className="bg-surface p-6 rounded-lg border border-outline-variant/20 relative">
                    <i className="fa-solid fa-quote-left absolute top-4 left-4 text-3xl text-outline-variant/30" />
                    <p className="font-headline-md text-lg text-on-surface mb-4 relative z-10 pl-6 italic">
                      &ldquo;{voice.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center">
                        <i className="fa-solid fa-user text-sm" />
                      </span>
                      <span className="font-label-md text-sm text-on-surface-variant">{voice.attribution}</span>
                    </div>
                  </div>
                )).slice(0, 2)}
                {!voicesOfNation.length && <div className="md:col-span-2"><EmptyState compact icon="fa-quote-left" title="No featured voices yet" description="Add this widget's content from Site Data." /></div>}
              </div>
            </section>

            {/* State Leadership */}
            <section className={sectionClass("state_leadership", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("state_leadership") }}>
              <SectionHeader title={sectionLabel("state_leadership").title} viewAllHref={sectionLabel("state_leadership").viewAllHref} />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {chiefMinisters.map((cm) => (
                  <CMCard key={cm.id} name={cm.name} subtitle={`Chief Minister, ${cm.state}`} photo={cm.photo} photoFallback={cm.photoFallback} href={`/category/${slugify(cm.name)}`} />
                )).slice(0, 5)}
                {!chiefMinisters.length && <div className="col-span-full"><EmptyState compact icon="fa-building-columns" title="No state leaders available" description="Visible state leadership records will appear here." /></div>}
              </div>
            </section>


            {/* Indian Political Parties */}
            <section className={sectionClass("political_parties", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("political_parties") }}>
              <SectionHeader title={sectionLabel("political_parties").title} viewAllHref={sectionLabel("political_parties").viewAllHref} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {parties.slice(0, 5).map((party) => (
                  <PartyCard key={party.id} name={party.name} abbreviation={party.abbreviation} founded={party.founded} photo={party.photo} photoFallback={party.photoFallback} href={`/category/${party.slug}`} />
                ))}
                {!parties.length && <div className="col-span-full"><EmptyState compact icon="fa-people-group" title="No political parties available" description="Add or enable parties for this website from Site Data." /></div>}
              </div>
            </section>

            {/* Parliament */}
            <section className={sectionClass("parliament", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("parliament") }}>
              <SectionHeader title={sectionLabel("parliament").title} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {parliamentSummary.map((house) => (
                  <Link
                    key={house.key}
                    href={house.href}
                    className="group flex flex-col bg-surface-container-low rounded-lg border border-outline-variant/20 hover:shadow-md transition-all p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-headline-lg text-xl text-on-surface group-hover:text-primary transition-colors">
                        {house.label}
                      </h3>
                      <span className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-landmark" />
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div>
                        <span className="block font-label-md text-[10px] text-on-surface-variant uppercase tracking-wide">
                          Total Seats
                        </span>
                        <span className="font-headline-md text-lg text-primary">{house.totalSeats}</span>
                      </div>
                      <div>
                        <span className="block font-label-md text-[10px] text-on-surface-variant uppercase tracking-wide">
                          Leading Bloc
                        </span>
                        <span className="font-headline-md text-lg text-on-surface">
                          {house.leadingParty} ({house.leadingSeats})
                        </span>
                      </div>
                    </div>
                    <p className="font-body-md text-xs text-on-surface-variant mb-4">
                      {house.presidingOfficer.role}: <span className="text-on-surface">{house.presidingOfficer.name}</span>
                    </p>
                    <span className="mt-auto font-label-sm text-primary flex items-center gap-1 text-sm">
                      VIEW DETAILS <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                ))}
                {!parliamentSummary.length && <div className="md:col-span-2"><EmptyState compact icon="fa-landmark" title="Parliament data is not available" description="Parliament details will appear here when they are added." /></div>}
              </div>
            </section>

            {/* Digital Dispatches */}
            <section className={sectionClass("digital_dispatches", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("digital_dispatches") }}>
              <SectionHeader title={sectionLabel("digital_dispatches").title} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Video Highlights */}
                {isSectionVisible("video_highlights") && <div className="flex flex-col gap-4">
                  <h3 className="font-headline-md text-base text-secondary border-l-4 border-secondary pl-3">
                    {sectionLabel("video_highlights").title}
                  </h3>
                  {videoHighlights.map((video) => (
                    <a
                      key={video.id}
                      href={video.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Play video: ${video.title}`}
                      className="block bg-surface rounded-lg overflow-hidden border border-outline-variant/20 group cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <div className="relative aspect-video">
                        <ImagePlaceholder icon="fa-solid fa-video" image={video.image} alt={video.title} gradient="secondary" className="w-full h-full" iconClassName="text-3xl" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                          <i className="fa-solid fa-circle-play text-white text-4xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-body-md font-semibold text-sm text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                          {video.title}
                        </h4>
                      </div>
                    </a>
                  )).slice(0, 2)}
                  {!videoHighlights.length && <EmptyState compact icon="fa-video" title="No video highlights" description="New video highlights will appear here." />}
                </div>}

                {/* X Feed */}
                {isSectionVisible("x_feed") && <div className="flex flex-col gap-4">
                  <h3 className="font-headline-md text-base text-primary border-l-4 border-primary pl-3">{sectionLabel("x_feed").title}</h3>
                  {xFeed.map((post) => (
                    <SocialPostCard key={post.id} post={post}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
                          <i className="fa-solid fa-user text-sm" />
                        </div>
                        <div>
                          <p className="font-label-md text-on-surface font-bold flex items-center gap-1 text-sm">
                            {post.name}
                            {post.verified && <i className="fa-solid fa-circle-check text-[12px] text-surface-tint" />}
                          </p>
                          <p className="font-label-sm text-outline text-[10px]">{post.handle}</p>
                        </div>
                      </div>
                      <p className="font-body-md text-on-surface-variant text-xs">{post.text}</p>
                      {post.hasImage && (
                        <ImagePlaceholder icon="fa-solid fa-image" image={post.image} gradient="tint" className="w-full h-24 rounded-md" />
                      )}
                      <div className="flex items-center justify-between text-outline mt-1 pt-2 border-t border-outline-variant/20">
                        <span className="flex items-center gap-1 text-[10px]">
                          <i className="fa-regular fa-comment" /> {post.stats?.comments || 0}
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <i className="fa-solid fa-retweet" /> {post.stats?.retweets || 0}
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <i className="fa-solid fa-heart" /> {post.stats?.likes || 0}
                        </span>
                      </div>
                    </SocialPostCard>
                  ))}
                  {!xFeed.length && <EmptyState compact icon="fa-message" title="No X updates" description="Social updates will appear here when available." />}
                </div>}

                {/* Facebook Updates */}
                {isSectionVisible("facebook_updates") && <div className="flex flex-col gap-4">
                  <h3 className="font-headline-md text-base text-surface-tint border-l-4 border-surface-tint pl-3">
                    {sectionLabel("facebook_updates").title}
                  </h3>
                  {facebookUpdates.map((post) => (
                    <SocialPostCard key={post.id} post={post}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
                          <i className="fa-solid fa-people-group text-sm" />
                        </div>
                        <div>
                          <p className="font-label-md text-on-surface font-bold text-sm">{post.name}</p>
                          <p className="font-label-sm text-outline text-[10px]">{post.time}</p>
                        </div>
                      </div>
                      <p className="font-body-md text-on-surface-variant text-xs">{post.text}</p>
                      {post.hasImage && (
                        <ImagePlaceholder icon="fa-solid fa-image" image={post.image} gradient="primary" className="w-full aspect-[4/3] rounded-md" />
                      )}
                      <div className="flex items-center justify-between text-outline mt-1 pt-2 border-t border-outline-variant/20">
                        <span className="flex items-center gap-1 text-xs font-label-md">
                          <i className="fa-regular fa-thumbs-up" /> Like
                        </span>
                        <span className="flex items-center gap-1 text-xs font-label-md">
                          <i className="fa-regular fa-comment" /> Comment
                        </span>
                        <span className="flex items-center gap-1 text-xs font-label-md">
                          <i className="fa-solid fa-share" /> Share
                        </span>
                      </div>
                    </SocialPostCard>
                  ))}
                  {!facebookUpdates.length && <EmptyState compact icon="fa-message" title="No Facebook updates" description="Social updates will appear here when available." />}
                </div>}
              </div>
            </section>

            {/* Chief Minister's Corner */}
            <section className={sectionClass("cm_corner", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("cm_corner") }}>
              <SectionHeader title={sectionLabel("cm_corner").title} />
              <LeadershipCorner
                corner={{
                  ...cmCorner,
                  name: cmCorner.name || chiefMinisters[0]?.name,
                  image: cmCorner.image || chiefMinisters[0]?.photo,
                }}
                emptyName="Chief Minister"
                linkHref={sectionLabel("cm_corner").viewAllHref || "/cm"}
                linkLabel="VIEW STATE LEADERSHIP"
              />
            </section>

            {/* Prime Minister's Corner */}
            <section className={sectionClass("pm_corner", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("pm_corner") }}>
              <SectionHeader title={sectionLabel("pm_corner").title} />
              <LeadershipCorner corner={pmCorner} emptyName="Prime Minister" linkHref={sectionLabel("pm_corner").viewAllHref || "/speeches"} linkLabel="VIEW ALL SPEECHES" />
            </section>

            {/* Press Conference Archive */}
            <section className={sectionClass("press_conferences", "border-t border-outline-variant/30 pt-6")} style={{ order: homepageOrder("press_conferences") }}>
              <SectionHeader title={sectionLabel("press_conferences").title} viewAllHref={sectionLabel("press_conferences").viewAllHref} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {pressConference.map((item) => (
                  <a
                    key={item.id}
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Play press conference: ${item.title}`}
                    className="group block cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3">
                      <ImagePlaceholder icon="fa-solid fa-microphone" image={item.image} alt={item.title} gradient="secondary" className="w-full h-full" iconClassName="text-3xl" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        <i className="fa-solid fa-circle-play text-white text-4xl opacity-90 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                    <h3 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors leading-snug">
                      {item.title}
                    </h3>
                  </a>
                )).slice(0, 4)}
                {!pressConference.length && <div className="col-span-full"><EmptyState compact icon="fa-microphone" title="No press conferences yet" description="Published press conference videos will appear here." /></div>}
              </div>
            </section>

            {mainContentSections.map((section) => <AddedHomepageSection key={section.id} section={section} sources={homepageSectionSources} order={homepageOrder(section.id)} />)}
          </div>

          {/* Sidebar */}
          <aside className={sectionClass("home_sidebar", "self-stretch lg:w-1/4 flex flex-col bg-surface-container rounded-xl p-4 border border-outline-variant/30 gap-6")}>
            <div className={sectionClass("trending_news")}><TrendingNews items={trending} viewAllHref="/trending" title={sectionLabel("trending_news").title} /></div>

            {isSectionVisible("follow_us") && Array.isArray(followUs) && followUs.length > 0 && (
              <div className="pt-4 border-t border-outline-variant/30">
                <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                  <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("follow_us").title}</h3>
                  <i className="fa-solid fa-share-nodes text-secondary text-lg" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {followUs.map((social) => (
                    <a
                      key={social.id || `${social.label}-${social.url}`}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 font-label-md text-xs font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
                      aria-label={`Visit our ${social.label || "website"}`}
                    >
                      <i className={`${social.icon || "fa-solid fa-globe"} text-base`} aria-hidden="true" />
                      <span>{social.label || "Website"}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className={sectionClass("poll_of_the_day")}><PollOfTheDay initialPoll={pollOfTheDay} title={sectionLabel("poll_of_the_day").title} /></div>

            <div className={sectionClass("legislative_tracker", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("legislative_tracker").title}</h3>
                <i className="fa-solid fa-file-lines text-secondary text-lg" />
              </div>
              <ul className="space-y-4">
                {legislativeTracker.map((bill) => (
                  <li key={bill.id} className="group cursor-pointer">
                    <h4 className="font-body-md font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
                      {bill.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${bill.statusClass}`}>
                        {bill.status}
                      </span>
                      <span className="text-outline text-xs">{bill.stage}</span>
                    </div>
                  </li>
                ))}
                {!legislativeTracker.length && <li><EmptyState compact icon="fa-file-lines" title="No legislative updates" description="New bills and legislative activity will appear here." /></li>}
              </ul>
            </div>

            <div className={sectionClass("parliament_strength", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("parliament_strength").title}</h3>
                <i className="fa-solid fa-landmark text-secondary text-lg" />
              </div>
              <div className="flex flex-col gap-3">
                {parliamentSummary.map((house, index) => (
                  <Link
                    key={house.key}
                    href={house.href}
                    className={`group block ${index > 0 ? "border-t border-outline-variant/20 pt-3" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors">
                        {house.label}
                      </h4>
                      <span className="text-[10px] font-label-md text-on-surface-variant">{house.totalSeats} seats</span>
                    </div>
                    <p className="font-body-md text-xs text-on-surface-variant">
                      Leading bloc: {house.leadingParty} ({house.leadingSeats} seats)
                    </p>
                  </Link>
                ))}
                {!parliamentSummary.length && <EmptyState compact icon="fa-landmark" title="No Parliament data" description="Parliament strength data is not available yet." />}
              </div>
            </div>

            <div className={sectionClass("political_calendar", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("political_calendar").title}</h3>
                <i className="fa-solid fa-calendar-days text-secondary text-lg" />
              </div>
              <ul className="space-y-3">
                {politicalCalendar.map((event) => (
                  <li key={event.id} className="flex gap-3 group cursor-pointer">
                    <span className="font-label-md text-xs text-primary bg-primary-fixed px-2 py-1 rounded-sm flex-shrink-0 h-fit">
                      {event.date}
                    </span>
                    <p className="font-body-md text-sm text-on-surface group-hover:text-primary transition-colors">
                      {event.title}
                    </p>
                  </li>
                ))}
                {!politicalCalendar.length && <li><EmptyState compact icon="fa-calendar" title="No upcoming events" description="Political events will appear here when scheduled." /></li>}
              </ul>
            </div>

            <div className={sectionClass("rti_corner", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("rti_corner").title}</h3>
                <i className="fa-solid fa-file-circle-question text-secondary text-lg" />
              </div>
              <ul className="space-y-3">
                {rtiCorner.map((item) => (
                  <li key={item.id} className="group cursor-pointer">
                    <p className="font-body-md text-sm text-on-surface group-hover:text-primary transition-colors leading-snug">
                      {item.title}
                    </p>
                    <span className="text-outline text-[10px]">{item.date}</span>
                  </li>
                ))}
                {!rtiCorner.length && <li><EmptyState compact icon="fa-file-circle-question" title="No RTI updates" description="RTI information will appear here when available." /></li>}
              </ul>
            </div>

            <div className={sectionClass("digital_pulse", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("digital_pulse").title}</h3>
                <i className="fa-solid fa-bolt text-secondary text-lg" />
              </div>
              <div className="flex flex-col gap-3">
                {digitalPulse.map((item, index) => (
                  <div key={item.id} className={index > 0 ? "border-t border-outline-variant/20 pt-3" : ""}>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm inline-block mb-1 uppercase tracking-widest ${item.tagClass}`}>
                      {item.tag}
                    </span>
                    <p className="font-body-md text-sm text-on-surface">{item.text}</p>
                  </div>
                ))}
                {!digitalPulse.length && <EmptyState compact icon="fa-bolt" title="No digital updates" description="Digital pulse updates will appear here." />}
              </div>
            </div>

            <div className={sectionClass("opinion_leaders", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("opinion_leaders").title}</h3>
              </div>
              <div className="flex flex-col gap-4">
                {opinionLeaders.map((leader) => (
                  <div key={leader.id} className="flex gap-3 items-center group cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-feather-pointed text-white text-xs" />
                    </div>
                    <h4 className="font-headline-md text-xs text-on-surface group-hover:text-primary transition-colors italic leading-tight">
                      &ldquo;{leader.quote}&rdquo;
                    </h4>
                  </div>
                ))}
                {!opinionLeaders.length && <EmptyState compact icon="fa-quote-left" title="No opinions available" description="Featured opinions will appear here when published." />}
              </div>
            </div>

            <div className={sectionClass("party_pulse", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("party_pulse").title}</h3>
                <i className="fa-solid fa-people-group text-secondary text-lg" />
              </div>
              <div className="group cursor-pointer">
                <h4 className="font-body-md font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
                  {partyPulse.title}
                </h4>
                <p className="font-body-md text-xs text-on-surface-variant line-clamp-2">{partyPulse.excerpt}</p>
              </div>
            </div>

            <div className={sectionClass("fact_check", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("fact_check").title}</h3>
                <i className="fa-solid fa-magnifying-glass text-secondary text-lg" />
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/20">
                <p className="font-body-md text-sm text-on-surface mb-2">{factCheck.claim}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase inline-block mb-2 ${factCheck.verdictClass}`}>
                  {factCheck.verdict}
                </span>
                <p className="font-body-md text-xs text-on-surface-variant">{factCheck.explanation}</p>
              </div>
            </div>

            <div className={sectionClass("the_briefing", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("the_briefing").title}</h3>
              </div>
              <ul className="space-y-2">
                {theBriefing.map((item) => (
                  <li key={item} className="flex gap-2 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
                    <p className="font-body-md text-xs text-on-surface-variant">{item}</p>
                  </li>
                ))}
                {!theBriefing.length && <li><EmptyState compact icon="fa-list" title="No briefing available" description="The latest briefing will appear here." /></li>}
              </ul>
            </div>

            <div className={sectionClass("from_the_archives", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("from_the_archives").title}</h3>
                <i className="fa-solid fa-landmark-flag text-secondary text-lg" />
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/20">
                <h4 className="font-headline-md text-sm text-primary mb-1">{fromTheArchives.title}</h4>
                <p className="font-body-md text-xs text-on-surface-variant">{fromTheArchives.note}</p>
              </div>
            </div>

            <div className={sectionClass("election_results", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("election_results").title}</h3>
              </div>
              <div className="bg-surface-container-low rounded p-2 border border-outline-variant/20">
                <table className="w-full text-[10px] font-label-md">
                  <thead>
                    <tr className="text-outline border-b border-outline-variant/30">
                      <th className="text-left py-1">STATE</th>
                      <th className="text-right py-1">PARTY</th>
                      <th className="text-right py-1">SEATS</th>
                    </tr>
                  </thead>
                  <tbody className="text-on-surface">
                    {electionResults.map((row, index) => (
                      <tr key={row.id} className={index < electionResults.length - 1 ? "border-b border-outline-variant/10" : ""}>
                        <td className="py-1.5">{row.state}</td>
                        <td className="text-right py-1.5">{row.party}</td>
                        <td className={`text-right py-1.5 ${String(row.change || "").startsWith('+') ? "text-green-600" : "text-error"}`}>{row.seats}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!electionResults.length && <div className="py-2"><EmptyState compact icon="fa-chart-column" title="No election results" description="Results will appear here when available." /></div>}
              </div>
            </div>


            {isSectionVisible("political_keywords") && <KeywordTagGroup
              title={sectionLabel("political_keywords").title}
              icon="fa-solid fa-tag"
              tags={[...politicalKeywords.parties, ...politicalKeywords.states, ...politicalKeywords.categories]}
            />}

            {isSectionVisible("states_keywords") && sectionVisibility.feature_states !== false && <KeywordTagGroup title={sectionLabel("states_keywords").title} icon="fa-solid fa-map" tags={states.map((s) => s.name)} />}

            {isSectionVisible("union_territories") && sectionVisibility.feature_states !== false && <KeywordTagGroup
              title={sectionLabel("union_territories").title}
              icon="fa-solid fa-map-pin"
              tags={unionTerritories.map((ut) => ut.name)}
            />}

            {isSectionVisible("elections_by_state") && sectionVisibility.feature_states !== false && <KeywordTagGroup
              title={sectionLabel("elections_by_state").title}
              icon="fa-solid fa-box-ballot"
              tags={[...states, ...unionTerritories].map((place) => `Election in ${place.name}`)}
            />}

            {isSectionVisible("parties_keywords") && sectionVisibility.feature_parties !== false && <KeywordTagGroup title={sectionLabel("parties_keywords").title} icon="fa-solid fa-people-group" tags={parties.map((p) => p.abbreviation)} />}

            {isSectionVisible("category_keywords") && <KeywordTagGroup title={sectionLabel("category_keywords").title} icon="fa-solid fa-list" tags={siteCategories.map((category) => category.name)} />}

            <div className={sectionClass("constituency_spotlight", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("constituency_spotlight").title}</h3>
                <i className="fa-solid fa-location-dot text-secondary text-lg" />
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/20 group cursor-pointer">
                <h4 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors">
                  {constituencySpotlight.title}
                </h4>
                <p className="font-body-md text-xs text-on-surface-variant mt-1">{constituencySpotlight.excerpt}</p>
              </div>
            </div>

            <div className={sectionClass("latest_updates", "pt-4 border-t border-outline-variant/30")}>
              <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("latest_updates").title}</h3>
                <Link href="/top-news" className="text-[10px] font-label-md text-secondary hover:underline">VIEW ALL</Link>
              </div>
              <div className="flex flex-col gap-4">
                {latestPosts.map((post, index) => (
                  <Link
                    key={`${post.type}-${post.id}`}
                    href={`/news/${post.slug}`}
                    className={`group flex gap-3 ${index ? "border-t border-outline-variant/20 pt-4" : ""}`}
                  >
                    <ImagePlaceholder
                      image={post.image}
                      alt={post.title}
                      className="h-16 w-20 flex-shrink-0 rounded-md"
                      sizes="80px"
                    />
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-secondary">{post.type}</span>
                      <h4 className="mt-1 line-clamp-2 font-headline-md text-xs leading-snug text-on-surface transition-colors group-hover:text-primary">
                        {post.title}
                      </h4>
                      {post.time && <span className="mt-1 block text-[9px] text-outline">{post.time}</span>}
                    </div>
                  </Link>
                ))}
                {!latestPosts.length && <EmptyState compact icon="fa-newspaper" title="No latest updates" description="Published content for this website will appear here." />}
              </div>
            </div>

            {sectionVisibility.feature_blogs !== false && blogs.length > 3 && (
              <div className={sectionClass("more_blogs", "pt-4 border-t border-outline-variant/30")}>
                <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
                  <h3 className="font-headline-md text-primary tracking-tight text-lg">{sectionLabel("more_blogs").title}</h3>
                  <Link href="/blogs" className="text-[10px] font-label-md text-secondary hover:underline">VIEW ALL</Link>
                </div>
                <div className="space-y-3">
                  {blogs.slice(3, 6).map((blog) => (
                    <Link key={blog.id} href={`/news/${blog.slug}`} className="group block rounded-md bg-surface-container-low p-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-secondary">{blog.category || "Blog"}</span>
                      <h4 className="mt-1 line-clamp-2 font-headline-md text-sm text-on-surface transition-colors group-hover:text-primary">{blog.title}</h4>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <GoogleAd slot="3691353983" className="flex justify-center" style={{ width: 250, height: 250 }} />
          </aside>
        </div>
              {homeVideoSection("above_footer")}

      </main>

      {/* Popular Tags */}
      <section className={sectionClass("popular_tags", "w-full bg-surface py-6 border-t border-outline-variant/30")}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-16">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="font-label-md text-primary tracking-widest uppercase text-xs">{sectionLabel("popular_tags").title}</h1>
            <div className="h-px flex-grow bg-outline-variant/30" />
          </div>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Link
                key={tag}
                href={`/category/${slugify(tag)}`}
                className="px-2 py-1 border border-outline-variant/50 rounded-sm text-[10px] font-label-md text-on-surface-variant hover:border-primary hover:text-primary transition-all uppercase tracking-wider"
              >
                {tag}
              </Link>
            ))}
            {!popularTags.length && <EmptyState compact icon="fa-tags" title="No popular tags" description="Popular topics will appear here as content is published." />}
          </div>
        </div>
      </section>


      <Footer />
    </>
  );
}
