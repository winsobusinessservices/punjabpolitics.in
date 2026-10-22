/**
 * News API — backed by the backend's GET /news/home and GET /news/posts/:slug
 * (see indian-rajniti-backend/src/controllers/news/news.controller.js). Every
 * "post" (top stories, editorial, regional, trending, blogs, careers,
 * speeches, rallies, videos) is real author-created, editor-approved content
 * from the articles/blogs/videos tables — there is no separate dummy-content
 * table. Non-authored homepage furniture (election results, poll of the day,
 * social feed mockups, PM corner, etc.) still comes from home_widgets.
 * Every function below keeps the exact name/shape it had as static dummy
 * data, so no consuming component needed to change.
 */
import { mediaUrl } from "@/lib/api";
import { createJsonResource } from "@/lib/jsonResource";
import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

const REQUIRED_MORE_LINKS = [
  { label: "Investors", href: "/investors" },
  { label: "Advertise with Us", href: "/advertise-with-us" },
];

const EMPTY_HOME_DATA = {
  sectionVisibility: {},
  posts: [],
  news: {
    heroSlides: [],
    topStories: [],
    editorialOpinion: [],
    regionalFocus: { states: [], stories: [] },
    inDepthAnalysis: null,
    multimediaHub: [],
    pressConferenceArchive: [],
    videoHighlights: [],
    allVideos: [],
    trending: [],
    blogs: [],
    careers: [],
    speeches: [],
    rallies: [],
  },
  widgets: {
    breaking_news: "Punjab Politics updates will appear here when the newsroom is available.",
    site_header: {},
    managed_pages: {},
    site_navigation: { more: [], legal: [] },
    site_footer: { sections: [], coverageLinks: [] },
    homepage_labels: {},
    homepage_sections: [],
    listing_pages: {},
    x_feed: [],
    facebook_updates: [],
    digital_pulse: [],
    the_briefing: [],
    election_results: [],
    popular_tags: [],
    extra_keywords: [],
    political_calendar: [],
    political_rallys: [],
    from_the_archives: {},
    fact_check: {},
    poll_of_the_day: { question: "No poll is available yet.", options: [] },
    rti_corner: [],
    follow_us: [],
    voices_of_nation: [],
    opinion_leaders: [],
    page_profiles: null,
    legislative_tracker: [],
    political_keywords: { parties: [], states: [], categories: [] },
    party_pulse: {},
    constituency_spotlight: {},
    cm_corner: { initiatives: [] },
    pm_corner: { initiatives: [] },
  },
};

const HOME_NEWS_LISTS = [
  "heroSlides",
  "topStories",
  "editorialOpinion",
  "multimediaHub",
  "pressConferenceArchive",
  "videoHighlights",
  "allVideos",
  "trending",
  "blogs",
  "careers",
  "speeches",
  "rallies",
];

const HOME_WIDGET_LISTS = [
  "homepage_sections",
  "x_feed",
  "facebook_updates",
  "digital_pulse",
  "the_briefing",
  "election_results",
  "popular_tags",
  "extra_keywords",
  "political_calendar",
  "political_rallys",
  "rti_corner",
  "follow_us",
  "voices_of_nation",
  "opinion_leaders",
  "legislative_tracker",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStructuredWidget(key, value) {
  return asArray(value).map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return { ...item, id: item.id || `${key}-${index + 1}` };
    }
    const raw = String(item || "").trim();
    const parts = raw.split("|").map((part) => part.trim());
    if (key === "rti_corner") {
      return { id: `${key}-${index + 1}`, title: parts[0] || "", date: parts[1] || "" };
    }
    if (["political_calendar", "political_rallys"].includes(key)) {
      return { id: `${key}-${index + 1}`, date: parts[0] || "", title: parts[1] || "" };
    }
    if (key === "digital_pulse") return { id: `digital-pulse-${index + 1}`, tag: parts[0] || "Update", text: parts.slice(1).join(" | ") || raw, tagClass: "bg-primary text-on-primary" };
    if (key === "election_results") return { id: `election-result-${index + 1}`, state: parts[0] || "", party: parts[1] || "", seats: Number(parts[2]) || 0, change: parts[3] || "" };
    if (key === "voices_of_nation") return { id: `voice-${index + 1}`, quote: parts[0] || "", attribution: parts[1] || "" };
    if (key === "legislative_tracker") return { id: `bill-${index + 1}`, title: parts[0] || "", status: parts[1] || "", stage: parts[2] || "", statusClass: "bg-secondary text-on-secondary" };
    return { id: `${key}-${index + 1}`, quote: raw };
  });
}

// A successful API response may legitimately omit widgets that have not been
// configured for a new website. Keep the public getter contracts stable so a
// missing section renders its empty state instead of crashing the whole page.
function normalizeHomeData(value) {
  const source = asObject(value);
  const rawNews = asObject(source.news);
  const rawWidgets = asObject(source.widgets);
  const rawRegionalFocus = asObject(rawNews.regionalFocus);

  const news = { ...EMPTY_HOME_DATA.news, ...rawNews };
  for (const key of HOME_NEWS_LISTS) news[key] = asArray(rawNews[key]);
  news.regionalFocus = {
    states: asArray(rawRegionalFocus.states),
    stories: asArray(rawRegionalFocus.stories),
  };
  news.inDepthAnalysis = asObject(rawNews.inDepthAnalysis);
  if (!Object.keys(news.inDepthAnalysis).length) news.inDepthAnalysis = null;

  const widgets = { ...EMPTY_HOME_DATA.widgets, ...rawWidgets };
  for (const key of HOME_WIDGET_LISTS) widgets[key] = asArray(rawWidgets[key]);
  for (const key of ["digital_pulse", "election_results", "political_calendar", "political_rallys", "rti_corner", "voices_of_nation", "opinion_leaders", "legislative_tracker"]) {
    widgets[key] = normalizeStructuredWidget(key, rawWidgets[key]);
  }
  widgets.site_header = asObject(rawWidgets.site_header);
  widgets.managed_pages = asObject(rawWidgets.managed_pages);
  widgets.homepage_labels = asObject(rawWidgets.homepage_labels);
  widgets.listing_pages = asObject(rawWidgets.listing_pages);
  widgets.from_the_archives = asObject(rawWidgets.from_the_archives);
  widgets.fact_check = asObject(rawWidgets.fact_check);
  widgets.party_pulse = asObject(rawWidgets.party_pulse);
  widgets.constituency_spotlight = asObject(rawWidgets.constituency_spotlight);
  widgets.page_profiles = rawWidgets.page_profiles ?? null;

  const navigation = asObject(rawWidgets.site_navigation);
  const savedMoreLinks = asArray(navigation.more);
  widgets.site_navigation = {
    ...EMPTY_HOME_DATA.widgets.site_navigation,
    ...navigation,
    more: [
      ...REQUIRED_MORE_LINKS.filter((required) => !savedMoreLinks.some((link) => link?.href === required.href)),
      ...savedMoreLinks,
    ],
    legal: asArray(navigation.legal),
  };

  const footer = asObject(rawWidgets.site_footer);
  widgets.site_footer = {
    ...EMPTY_HOME_DATA.widgets.site_footer,
    ...footer,
    sections: asArray(footer.sections),
    coverageLinks: asArray(footer.coverageLinks),
  };

  const poll = asObject(rawWidgets.poll_of_the_day);
  widgets.poll_of_the_day = {
    ...EMPTY_HOME_DATA.widgets.poll_of_the_day,
    ...poll,
    options: asArray(poll.options),
  };

  const politicalKeywords = asObject(rawWidgets.political_keywords);
  widgets.political_keywords = {
    parties: asArray(politicalKeywords.parties),
    states: asArray(politicalKeywords.states),
    categories: asArray(politicalKeywords.categories),
  };

  const pmCorner = asObject(rawWidgets.pm_corner);
  widgets.pm_corner = {
    ...EMPTY_HOME_DATA.widgets.pm_corner,
    ...pmCorner,
    initiatives: asArray(pmCorner.initiatives),
  };
  const cmCorner = asObject(rawWidgets.cm_corner);
  widgets.cm_corner = {
    ...EMPTY_HOME_DATA.widgets.cm_corner,
    ...cmCorner,
    initiatives: asArray(cmCorner.initiatives),
  };

  return {
    ...EMPTY_HOME_DATA,
    ...source,
    sectionVisibility: asObject(source.sectionVisibility),
    posts: asArray(source.posts),
    news,
    widgets,
  };
}

function formatDate(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    // This runs in Server Components too, where the host commonly uses UTC.
    // News dates should follow the site's Indian calendar day in every environment.
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function playbackUrl(value) {
  const url = String(value || "").trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\//i.test(url)) return `https://${url}`;
  return mediaUrl(url.startsWith("/") ? url : `/${url}`);
}

// Populated on every fetch — lets allTeasers() (called synchronously by
// features/category/category.api.js, after it has already awaited another
// getter from this module in the same Promise.all) read already-fetched
// data without itself being async.
//
const readHomeResource = createJsonResource(`${API_BASE_URL}/news/home`, {
  // Admin-managed widgets must be visible on the next refresh. In-flight
  // requests are still shared by createJsonResource, so all home sections
  // use one API call without retaining stale resolved data.
  ttl: 0,
  fetchOptions: () => withSiteHeaders({ cache: "no-store" }),
});

async function getHomeData() {
  try {
    return normalizeHomeData(await readHomeResource());
  } catch (error) {
    console.error("Punjab Politics home API is unavailable:", error?.message || error);
    return normalizeHomeData(EMPTY_HOME_DATA);
  }
}

function withDisplayFields(item) {
  if (!item) return item;
  return {
    ...item,
    image: mediaUrl(item.image),
    videoUrl: playbackUrl(item.videoUrl),
    time: formatDate(item.time),
  };
}

// The "horizontal" NewsCard variant (Editorial Opinion) and the in-depth
// analysis block read `.tag` for the category chip, matching the field name
// the original dummy data used there.
function asTagged(item) {
  const base = withDisplayFields(item);
  return { ...base, tag: base.category };
}

export async function getBreakingNews() {
  const { widgets } = await getHomeData();
  return widgets.breaking_news;
}
export async function getSectionVisibility() {
  const { sectionVisibility } = await getHomeData();
  return sectionVisibility || {};
}
export async function getSiteHeaderSettings() {
  const { widgets } = await getHomeData();
  return widgets.site_header || {};
}
export async function getManagedPages() {
  const { widgets } = await getHomeData();
  return widgets.managed_pages || {};
}
export async function getSiteNavigation() {
  const { widgets } = await getHomeData();
  return widgets.site_navigation || { more: [], legal: [] };
}
export async function getSiteFooter() {
  const { widgets } = await getHomeData();
  return widgets.site_footer || { sections: [], coverageLinks: [] };
}
export async function getHomepageLabels() {
  const { widgets } = await getHomeData();
  return widgets.homepage_labels || {};
}
export async function getHomeVideo() {
  const { widgets } = await getHomeData();
  const video = widgets.home_video;
  if (!video || typeof video !== "object" || video.enabled !== true || !video.videoUrl) return null;
  return {
    title: video.title || "Watch",
    src: mediaUrl(video.videoUrl),
    poster: video.posterUrl ? mediaUrl(video.posterUrl) : undefined,
    placement: ["after_hero", "main_content", "above_footer"].includes(video.placement) ? video.placement : "above_footer",
  };
}
export async function getHomepageSections() {
  const { widgets } = await getHomeData();
  return Array.isArray(widgets.homepage_sections) ? widgets.homepage_sections : [];
}
export async function getHomepageServices() {
  try {
    const response = await fetch(`${API_BASE_URL}/services`, await withSiteHeaders({ cache: "no-store" }));
    if (!response.ok) return [];
    return asArray((await response.json()).services);
  } catch {
    return [];
  }
}
export async function getVidhanSabhas() {
  try {
    const response = await fetch(`${API_BASE_URL}/vidhan-sabhas`, await withSiteHeaders({ cache: "no-store" }));
    if (!response.ok) return [];
    return asArray((await response.json()).vidhanSabhas);
  } catch {
    return [];
  }
}
export async function getListingPages() {
  const { widgets } = await getHomeData();
  return widgets.listing_pages || {};
}
export async function getHeroSlides() {
  const { news } = await getHomeData();
  return news.heroSlides.map(withDisplayFields);
}
export async function getTopStories() {
  const { news } = await getHomeData();
  return news.topStories.map(withDisplayFields);
}
export async function getEditorialOpinion() {
  const { news } = await getHomeData();
  return news.editorialOpinion.map(asTagged);
}
export async function getRegionalFocus() {
  const { news } = await getHomeData();
  return { states: news.regionalFocus.states, stories: news.regionalFocus.stories.map(withDisplayFields) };
}
export async function getInDepthAnalysis() {
  const { news } = await getHomeData();
  return news.inDepthAnalysis ? asTagged(news.inDepthAnalysis) : null;
}
export async function getMultimediaHub() {
  const { news } = await getHomeData();
  return news.multimediaHub.map(withDisplayFields);
}
export async function getPressConferenceArchive() {
  const { news } = await getHomeData();
  return news.pressConferenceArchive.map(withDisplayFields);
}
export async function getVideoHighlights() {
  const { news } = await getHomeData();
  return news.videoHighlights.map(withDisplayFields);
}
export async function getAllVideos() {
  const { news } = await getHomeData();
  return news.allVideos.map(withDisplayFields).map((video, index) => ({ ...video, id: index + 1 }));
}
export async function getXFeed() {
  const { widgets } = await getHomeData();
  return widgets.x_feed;
}
export async function getFacebookUpdates() {
  const { widgets } = await getHomeData();
  return widgets.facebook_updates;
}
export async function getTrending() {
  const { news } = await getHomeData();
  return news.trending.map(withDisplayFields);
}
export async function getBlogs() {
  const { news } = await getHomeData();
  return news.blogs.map(withDisplayFields);
}
export async function getLatestPosts(limit = 10) {
  const { posts } = await getHomeData();
  return posts.slice(0, limit).map(withDisplayFields);
}
export async function getCareers() {
  const { news } = await getHomeData();
  return news.careers.map(withDisplayFields);
}
export async function getSpeeches() {
  const { news } = await getHomeData();
  return news.speeches.map(withDisplayFields);
}
export async function getRallies() {
  const { news } = await getHomeData();
  return news.rallies.map(withDisplayFields);
}
export async function getDigitalPulse() {
  const { widgets } = await getHomeData();
  return widgets.digital_pulse;
}
export async function getTheBriefing() {
  const { widgets } = await getHomeData();
  return widgets.the_briefing;
}
export async function getElectionResults() {
  const { widgets } = await getHomeData();
  return widgets.election_results;
}
export async function getPopularTags() {
  const { widgets } = await getHomeData();
  return widgets.popular_tags;
}
export async function getExtraKeywords() {
  const { widgets } = await getHomeData();
  return widgets.extra_keywords;
}
export async function getPoliticalCalendar() {
  const { widgets } = await getHomeData();
  return widgets.political_calendar;
}
export async function getPoliticalRallys() {
  const { widgets } = await getHomeData();
  return widgets.political_rallys;
}
export async function getFromTheArchives() {
  const { widgets } = await getHomeData();
  return widgets.from_the_archives;
}
export async function getFactCheck() {
  const { widgets } = await getHomeData();
  return widgets.fact_check;
}
export async function getPollOfTheDay() {
  const { widgets } = await getHomeData();
  return widgets.poll_of_the_day;
}
export async function getRtiCorner() {
  const { widgets } = await getHomeData();
  return widgets.rti_corner;
}
export async function getFollowUs() {
  const { widgets } = await getHomeData();
  return widgets.follow_us;
}
export async function getVoicesOfNation() {
  const { widgets } = await getHomeData();
  return widgets.voices_of_nation || [];
}
export async function getOpinionLeaders() {
  const { widgets } = await getHomeData();
  return widgets.opinion_leaders || [];
}
export async function getPageProfiles() {
  const { widgets } = await getHomeData();
  return widgets.page_profiles || null;
}

export async function getWeatherSnapshot() {
  const latitude = 12.9716;
  const longitude = 77.5946;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code` +
    `&timezone=auto`;

    try{
        const response = await fetch(url);
        const data = await response.json();
        return data;
    }catch(err){
        console.error("Api not working")
    }


}

export async function getLegislativeTracker() {
  const { widgets } = await getHomeData();
  return widgets.legislative_tracker;
}
export async function getPoliticalKeywords() {
  const { widgets } = await getHomeData();
  return widgets.political_keywords;
}
export async function getPartyPulse() {
  const { widgets } = await getHomeData();
  return widgets.party_pulse;
}
export async function getConstituencySpotlight() {
  const { widgets } = await getHomeData();
  return widgets.constituency_spotlight;
}
export async function getPmCorner() {
  const { widgets } = await getHomeData();
  return widgets.pm_corner;
}

// Sync by necessity — features/category/category.api.js calls this without
// awaiting, always after it has already awaited getAllCategoryLabels() (or
// another getter here) in the same Promise.all, so lastKnownBundle is
// already populated by the time this runs.
export async function allTeasers() {
  const { posts } = await getHomeData();
  return posts.map(withDisplayFields);
}
export async function getCmCorner() {
  const { widgets } = await getHomeData();
  return widgets.cm_corner;
}

// Every category/tag/keyword label used anywhere on the site (real article/
// blog categories and states, plus the site's curated tag lists) — the
// single source the /category/[slug] registry aggregates from, so no
// clickable label 404s.
export async function getCategoryDefinitions() {
  try {
    const categoriesRes = await fetch(`${API_BASE_URL}/categories`, await withSiteHeaders({ cache: "no-store" }));
    if (!categoriesRes.ok) return [];
    const { categories } = await categoriesRes.json();
    return asArray(categories);
  } catch {
    return [];
  }
}

// The Premium page: stories authors marked as premium, the subscribers-only category sections and the kinds.
export async function getPremiumPosts() {
  try {
    const res = await fetch(`${API_BASE_URL}/news/premium`, await withSiteHeaders({ cache: "no-store" }));
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return {
      posts: asArray(data.posts).map(withDisplayFields),
      categories: asArray(data.categories),
      types: asArray(data.types),
    };
  } catch {
    return { posts: [], categories: [], types: [] };
  }
}

// First names on the Support page's thank-you wall ([] when nobody opted in or the server is unreachable).
export async function getSupporters() {
  try {
    const res = await fetch(`${API_BASE_URL}/support/supporters`, await withSiteHeaders({ next: { revalidate: 300 } }));
    if (!res.ok) return [];
    const data = await res.json();
    return asArray(data.supporters);
  } catch {
    return [];
  }
}

// What the Subscription page shows (cards, prices) and whether payments are open. {} when the server is unreachable.
export async function getSubscriptionConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/subscription/config`, await withSiteHeaders({ cache: "no-store" }));
    if (!res.ok) return {};
    const data = await res.json();
    return data.config || {};
  } catch {
    return {};
  }
}

export async function getAllCategoryLabels() {
  const [{ posts, news, widgets }, categories] = await Promise.all([
    getHomeData(),
    getCategoryDefinitions(),
  ]);
  const postTags = posts.flatMap((post) => post.tags || []);
  return [
    ...categories.map((category) => category.name),
    ...posts.map((post) => post.category),
    ...news.regionalFocus.states,
    ...widgets.popular_tags,
    ...widgets.extra_keywords,
    ...widgets.political_keywords.parties,
    ...widgets.political_keywords.states,
    ...widgets.political_keywords.categories,
    ...postTags,
  ].filter(Boolean);
}

export async function getPostsForTopics(terms) {
  const params = new URLSearchParams();
  terms.filter(Boolean).forEach((term) => params.append("term", term));
  const res = await fetch(`${API_BASE_URL}/news/topics?${params.toString()}`, await withSiteHeaders({ next: { revalidate: 60 } }));
  if (!res.ok) throw new Error(`Failed to load topic posts (${res.status})`);
  const { posts } = await res.json();
  return asArray(posts).map(withDisplayFields);
}

export async function getPostBySlug(slug) {
  // Always a fresh request (not the cached /news/home bundle) — this is the
  // one place a view actually gets counted server-side.
  const res = await fetch(`${API_BASE_URL}/news/posts/${encodeURIComponent(slug)}`, await withSiteHeaders({ cache: "no-store" }));
  if (!res.ok) return null;
  const { post } = await res.json();
  if (!post || typeof post !== "object") return null;
  return {
    ...post,
    image: mediaUrl(post.image),
    datePublished: post.date,
    dateModified: post.updated_at || post.date,
    date: formatDate(post.date),
  };
}

export async function getRelatedPosts(excludeSlug, limit = 4) {
  const { posts } = await getHomeData();
  return posts
    .filter((story) => story.slug && story.slug !== excludeSlug)
    .slice(0, limit)
    .map(withDisplayFields);
}
