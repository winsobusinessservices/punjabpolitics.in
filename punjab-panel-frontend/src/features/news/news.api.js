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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

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
let lastKnownBundle = null;

const readHomeResource = createJsonResource(`${API_BASE_URL}/news/home`, {
  // Admin-managed widgets must be visible on the next refresh. In-flight
  // requests are still shared by createJsonResource, so all home sections
  // use one API call without retaining stale resolved data.
  ttl: 0,
  fetchOptions: { cache: "no-store" },
});

async function getHomeData() {
  const json = await readHomeResource();
  lastKnownBundle = json;
  return json;
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
export function allTeasers() {
  if (!lastKnownBundle) return [];
  return lastKnownBundle.posts.map(withDisplayFields);
}

// Every category/tag/keyword label used anywhere on the site (real article/
// blog categories and states, plus the site's curated tag lists) — the
// single source the /category/[slug] registry aggregates from, so no
// clickable label 404s.
export async function getCategoryDefinitions() {
  const categoriesRes = await fetch(`${API_BASE_URL}/categories`, { cache: "no-store" });
  if (!categoriesRes.ok) throw new Error(`Failed to load categories (${categoriesRes.status})`);
  const { categories } = await categoriesRes.json();
  return categories;
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
  const res = await fetch(`${API_BASE_URL}/news/topics?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to load topic posts (${res.status})`);
  const { posts } = await res.json();
  return posts.map(withDisplayFields);
}

export async function getPostBySlug(slug) {
  // Always a fresh request (not the cached /news/home bundle) — this is the
  // one place a view actually gets counted server-side.
  const res = await fetch(`${API_BASE_URL}/news/posts/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const { post } = await res.json();
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
