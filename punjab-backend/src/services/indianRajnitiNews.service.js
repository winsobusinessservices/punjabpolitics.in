const API_URL = String(process.env.INDIAN_RAJNITI_API_URL || "https://app.indianrajneeti.com/api").replace(/\/+$/, "");
const SITE_URL = String(process.env.INDIAN_RAJNITI_SITE_URL || "https://indianrajneeti.com").replace(/\/+$/, "");
const SITE_DOMAIN = String(process.env.INDIAN_RAJNITI_SITE_DOMAIN || "indianrajneeti.com").trim();
const ENABLED = !["0", "false", "no"].includes(String(process.env.INDIAN_RAJNITI_SYNDICATION_ENABLED || "true").toLowerCase());
const CACHE_TTL_MS = Math.max(15, Number(process.env.INDIAN_RAJNITI_CACHE_SECONDS) || 60) * 1000;
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.INDIAN_RAJNITI_TIMEOUT_MS) || 5000);
const SLUG_PREFIX = "indian-rajniti--";

let homeCache = { expiresAt: 0, rows: [] };

function hasPunjabTerm(value) {
  return /(^|[^a-z])p[au]njab([^a-z]|$)/i.test(String(value || ""));
}

function isPunjabRelated(post) {
  if (!post || !["ARTICLE", "BLOG"].includes(String(post.type || "").toUpperCase())) return false;
  if (String(post.region || "").trim().toLowerCase() === "punjab") return true;
  const tags = Array.isArray(post.tags) ? post.tags.join(" ") : post.tags;
  return hasPunjabTerm([post.category, post.title, post.excerpt, tags].filter(Boolean).join(" "));
}

function absoluteAssetUrl(value) {
  const path = String(value || "").trim();
  if (!path || /^(?:data|blob):/i.test(path) || /^https?:\/\//i.test(path)) return path || null;
  if (path.startsWith("//")) return `https:${path}`;
  try {
    return new URL(path.startsWith("/") ? path : `/${path}`, new URL(API_URL).origin).toString();
  } catch {
    return path;
  }
}

function sourceUrlFor(slug) {
  return `${SITE_URL}/news/${encodeURIComponent(slug)}`;
}

function toSyndicatedRow(post) {
  const originalSlug = String(post.slug || "").trim();
  if (!originalSlug || !isPunjabRelated(post)) return null;
  return {
    id: `indian-rajniti:${String(post.type).toLowerCase()}:${post.id || originalSlug}`,
    type: String(post.type).toUpperCase(),
    slug: `${SLUG_PREFIX}${originalSlug}`,
    original_slug: originalSlug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category || "Punjab",
    state: post.region || "Punjab",
    featured_image: absoluteAssetUrl(post.image),
    author_name: post.author || "Indian Rajniti",
    published_at: post.time,
    created_at: post.time,
    views: Number(post.views) || 0,
    tags: Array.isArray(post.tags) ? post.tags : [],
    source: { name: "Indian Rajniti", url: sourceUrlFor(originalSlug), siteUrl: SITE_URL },
    syndicated: true,
  };
}

async function requestJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "application/json", "X-Site-Domain": SITE_DOMAIN },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getPunjabPosts() {
  if (!ENABLED) return [];
  if (homeCache.expiresAt > Date.now()) return homeCache.rows;
  try {
    const payload = await requestJson("/news/home");
    if (!payload) return homeCache.rows;
    const candidates = Array.isArray(payload.posts)
      ? payload.posts
      : [...(payload.news?.topStories || []), ...(payload.news?.blogs || [])];
    const seen = new Set();
    const rows = candidates
      .map(toSyndicatedRow)
      .filter((row) => row && !seen.has(row.slug) && seen.add(row.slug));
    homeCache = { expiresAt: Date.now() + CACHE_TTL_MS, rows };
    return rows;
  } catch (error) {
    console.warn("Indian Rajniti Punjab feed unavailable:", error?.message || error);
    return homeCache.rows;
  }
}

function isSyndicatedSlug(slug) {
  return String(slug || "").startsWith(SLUG_PREFIX);
}

async function getPostBySyndicatedSlug(slug) {
  if (!ENABLED || !isSyndicatedSlug(slug)) return null;
  const originalSlug = String(slug).slice(SLUG_PREFIX.length);
  if (!originalSlug) return null;
  try {
    const payload = await requestJson(`/news/posts/${encodeURIComponent(originalSlug)}`);
    const post = payload?.post;
    if (!post) return null;
    return {
      ...post,
      type: String(post.type || "ARTICLE").toUpperCase(),
      slug: `${SLUG_PREFIX}${originalSlug}`,
      image: absoluteAssetUrl(post.image),
      additionalImages: Array.isArray(post.additionalImages) ? post.additionalImages.map(absoluteAssetUrl) : [],
      tags: Array.isArray(post.tags) ? post.tags : [],
      comments_enabled: false,
      source: { name: "Indian Rajniti", url: sourceUrlFor(originalSlug), siteUrl: SITE_URL },
      canonicalUrl: sourceUrlFor(originalSlug),
      syndicated: true,
    };
  } catch (error) {
    console.warn("Indian Rajniti post unavailable:", error?.message || error);
    return null;
  }
}

module.exports = {
  getPunjabPosts,
  getPostBySyndicatedSlug,
  isPunjabRelated,
  isSyndicatedSlug,
  toSyndicatedRow,
};
