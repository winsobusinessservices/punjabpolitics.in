// Public, unauthenticated homepage/news content — backs the frontend's
// news.api.js. Every "post" (top stories, editorial, regional, trending,
// blogs, videos) comes from the SAME articles/blogs/videos tables authors
// already write into and editors already approve — there is no separate
// dummy-content table. Non-authored widgets (hero-adjacent stats, election
// results, poll of the day, etc.) still come from home_widgets.
const Article = require("../../models/article.model");
const Blog = require("../../models/blog.model");
const Video = require("../../models/video.model");
const HomeWidget = require("../../models/homeWidget.model");
const Category = require("../../models/category.model");
const { premiumNameSet, withPremium } = require("../../utils/premiumContent");
const UiSection = require("../../models/uiSection.model");
const { deriveExternalThumbnail } = require("../../utils/videoThumbnail");
const { splitContentMedia } = require("../../utils/contentMedia");
const { isRichTextHtml, richTextToPlainText } = require("../../utils/richText");
const { getPunjabPosts, getPostBySyndicatedSlug, isSyndicatedSlug } = require("../../services/indianRajnitiNews.service");

const POOL_LIMIT = 60;
const TRENDING_WINDOW_DAYS = 14;

const getCategories = async (req, res) => {
  try {
    const [articleCategories, blogCategories, videoCategories, widgets, hiddenCategoryNames] = await Promise.all([
      Article.findCategories(req.site.id),
      Blog.findCategories(req.site.id),
      Video.findCategories(req.site.id),
      HomeWidget.getAll(req.site.id),
      Category.findHiddenNames(req.site.id),
    ]);

    const hiddenCategories = new Set(hiddenCategoryNames.map((name) => name.trim().toLowerCase()));

    const configuredCategories = widgets.political_keywords?.categories || [];
    const categories = [...new Set([
      ...configuredCategories,
      ...articleCategories,
      ...blogCategories,
      ...videoCategories,
    ].map((category) => category.trim()).filter((category) => category && !hiddenCategories.has(category.toLowerCase())))]
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    return res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getTopicPosts = async (req, res) => {
  try {
    const rawTerms = Array.isArray(req.query.term) ? req.query.term : [req.query.term];
    const terms = [...new Set(rawTerms.map((term) => String(term || "").trim()).filter(Boolean))].slice(0, 10);
    if (!terms.length) return res.status(400).json({ success: false, message: "At least one topic term is required" });

    const [articles, blogs, hiddenCategoryNames] = await Promise.all([
      Article.findPublishedForTopics(terms, 60, req.site.id),
      Blog.findPublishedForTopics(terms, 60, req.site.id),
      Category.findHiddenNames(req.site.id),
    ]);
    const hiddenCategories = new Set(hiddenCategoryNames.map((name) => name.trim().toLowerCase()));
    const categoryIsVisible = (row) => !hiddenCategories.has(String(row.category || "").trim().toLowerCase());
    const posts = [
      ...articles.filter(categoryIsVisible).map(toArticleTeaser),
      ...blogs.filter(categoryIsVisible).map(toBlogTeaser),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time));
    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Get topic posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

function wordsOf(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean);
}

function readTimeOf(content) {
  const words = wordsOf(isRichTextHtml(content) ? richTextToPlainText(content) : content).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

// Authors write plain text in a single textarea (see PostForm.jsx), not an
// array of paragraphs — split on blank lines so the detail page can render
// it the same way a structured paragraph array would be rendered.
function paragraphsOf(content) {
  if (isRichTextHtml(content)) return content;
  const parts = (content || "")
    .split(/\n\s*\n|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [content || ""];
}

function dateLabel(row) {
  const at = row.published_at || row.created_at;
  return at ? new Date(at).toISOString() : null;
}

function publishedTime(row) {
  return new Date(row.published_at || row.created_at || 0).getTime();
}

function toArticleTeaser(row) {
  return {
    id: row.id,
    type: row.type || "ARTICLE",
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    region: row.state || null,
    image: row.featured_image || null,
    author: row.author_name,
    time: dateLabel(row),
    views: row.views,
    tags: row.tags || null,
    source: row.source || null,
    syndicated: row.syndicated === true,
    premium: row.premium_type || null, // set for Premium-only stories (shows the crown on cards)
  };
}

function toBlogTeaser(row) {
  return {
    id: row.id,
    type: "BLOG",
    premium: row.premium_type || null,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    image: row.featured_image || null,
    author: row.author_name,
    time: dateLabel(row),
    views: row.views,
    tags: row.tags || null,
  };
}

function toVideoTeaser(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    // Videos saved before thumbnail auto-derivation existed (or where an
    // author skipped it) still get a real thumbnail here, derived the same
    // way, instead of a bare icon placeholder on every card.
    image: row.thumbnail || deriveExternalThumbnail(row.video_url) || null,
    videoUrl: row.video_url,
    author: row.author_name,
    time: dateLabel(row),
    views: row.views,
  };
}

// Free-text category match (authors type their own category — there's no
// fixed taxonomy), used for the Speeches/Rallies/Careers routes and to split
// videos into Press Conference Archive vs. everything else.
function byCategory(rows, keyword, exclude = false) {
  return rows.filter((row) => {
    const matches = (row.category || "").toLowerCase().includes(keyword);
    return exclude ? !matches : matches;
  });
}

function distinctStates(articles) {
  const seen = new Set();
  const states = [];
  for (const row of articles) {
    if (row.state && !seen.has(row.state)) {
      seen.add(row.state);
      states.push(row.state);
    }
  }
  return states;
}

const getHome = async (req, res) => {
  try {
    const [nativeArticles, syndicatedArticles, rawBlogsPool, rawVideosPool, widgets, hiddenCategoryNames, sectionVisibility] = await Promise.all([
      Article.findPublished({ siteId: req.site.id, orderBy: "recent", limit: POOL_LIMIT }),
      getPunjabPosts(),
      Blog.findPublished({ siteId: req.site.id, orderBy: "recent", limit: POOL_LIMIT }),
      Video.findPublished({ siteId: req.site.id, orderBy: "recent", limit: POOL_LIMIT }),
      HomeWidget.getAll(req.site.id),
      Category.findHiddenNames(req.site.id),
      UiSection.visibilityMap(req.site.id),
    ]);

    const hiddenCategories = new Set(hiddenCategoryNames.map((name) => name.trim().toLowerCase()));
    const categoryIsVisible = (row) => !hiddenCategories.has(String(row.category || "").trim().toLowerCase());
    // Stories in a "subscribers only" category are premium even when the author did not mark them.
    const premiumNames = premiumNameSet(await Category.findPremiumNames(req.site.id));
    const blogsPool = withPremium(rawBlogsPool.filter(categoryIsVisible), premiumNames);
    const videosPool = rawVideosPool.filter(categoryIsVisible);

    const nativeTitles = new Set(nativeArticles.map((row) => String(row.title || "").trim().toLowerCase()));
    const articlesPoolRaw = [
      ...nativeArticles,
      ...syndicatedArticles.filter((row) => !nativeTitles.has(String(row.title || "").trim().toLowerCase())),
    ]
      .filter(categoryIsVisible)
      .sort((a, b) => publishedTime(b) - publishedTime(a))
      .slice(0, POOL_LIMIT);
    const articlesPool = withPremium(articlesPoolRaw, premiumNames);

    const byViews = [...articlesPool].sort(
      (a, b) => b.views - a.views || publishedTime(b) - publishedTime(a)
    );

    const usedIds = new Set();
    const take = (rows, count) => {
      const picked = rows.filter((row) => !usedIds.has(row.id)).slice(0, count);
      picked.forEach((row) => usedIds.add(row.id));
      return picked;
    };

    // Lead with the three most-read approved articles. `byViews` uses the
    // newest publication as its tie-breaker, so equal view counts still
    // produce a stable, editorially sensible order.
    const heroRows = take(byViews, 3);
    const topStoryRows = take(articlesPool, 6);
    const editorialRows = take(articlesPool, 4);
    const inDepthRows = take(byViews, 1);

    const badges = ["primary", "secondary", "tint"];
    const heroSlides = heroRows.map((row, index) => ({
      id: row.id,
      slug: row.slug,
      category: row.category,
      badge: badges[index % badges.length],
      title: row.title,
      excerpt: row.excerpt,
      image: row.featured_image || null,
      views: row.views,
      source: row.source || null,
      syndicated: row.syndicated === true,
    }));

    const cutoff = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentByViews = byViews.filter((row) => new Date(row.published_at || row.created_at) >= cutoff);
    const trendingRows = (recentByViews.length ? recentByViews : byViews).slice(0, 5);

    const regionalRows = [];
    const seenStates = new Set();
    for (const row of articlesPool) {
      if (row.state && !seenStates.has(row.state)) {
        seenStates.add(row.state);
        regionalRows.push(row);
      }
    }

    const news = {
      heroSlides,
      topStories: topStoryRows.map(toArticleTeaser),
      editorialOpinion: editorialRows.map(toArticleTeaser),
      regionalFocus: {
        states: distinctStates(articlesPool),
        stories: regionalRows.slice(0, 6).map(toArticleTeaser),
      },
      inDepthAnalysis: inDepthRows[0] ? toArticleTeaser(inDepthRows[0]) : null,
      trending: trendingRows.map(toArticleTeaser),
      blogs: blogsPool.map(toBlogTeaser),
      careers: byCategory(articlesPool, "career").map(toArticleTeaser),
      speeches: byCategory(articlesPool, "speech").map(toArticleTeaser),
      rallies: byCategory(articlesPool, "rally").map(toArticleTeaser),
      // Press Conference Archive is a real category match (like Speeches/
      // Rallies/Careers above), not a positional slice — with only a
      // handful of videos total, slicing past the first 6 left this section
      // permanently empty even when press-briefing videos genuinely existed.
      // Same non-press pool as Multimedia Hub above, not a disjoint slice of
      // it — slice(2, 6) left this permanently empty whenever that pool had
      // 2 or fewer videos (its first 2 already went to Multimedia Hub), even
      // though "highlights" and "hub" showing overlapping picks from a small
      // pool is normal and expected until there's enough video inventory to
      // split cleanly.
      multimediaHub: byCategory(videosPool, "press", true).slice(0, 2).map(toVideoTeaser),
      videoHighlights: byCategory(videosPool, "press", true).slice(0, 4).map(toVideoTeaser),
      pressConferenceArchive: byCategory(videosPool, "press").map(toVideoTeaser),
      allVideos: videosPool.map(toVideoTeaser),
    };

    // Everything with a slug (articles + blogs) — backs getPostBySlug's
    // fallback pool, getRelatedPosts, allTeasers, and getAllCategoryLabels
    // on the frontend, without a second round trip per lookup.
    const posts = [...articlesPool.map(toArticleTeaser), ...blogsPool.map(toBlogTeaser)]
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

    const visibleLabels = (items) => Array.isArray(items)
      ? items.filter((item) => !hiddenCategories.has(String(item || "").trim().toLowerCase()))
      : items;
    const publicWidgets = {
      ...widgets,
      popular_tags: visibleLabels(widgets.popular_tags),
      extra_keywords: visibleLabels(widgets.extra_keywords),
      political_keywords: widgets.political_keywords ? {
        ...widgets.political_keywords,
        categories: visibleLabels(widgets.political_keywords.categories),
      } : widgets.political_keywords,
    };

    return res.status(200).json({ success: true, news, posts, widgets: publicWidgets, sectionVisibility });
  } catch (error) {
    console.error("Get home content error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Public single-post lookup — searches articles then blogs (APPROVED only)
// and counts a real view, unlike the cached /news/home bundle.
const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (isSyndicatedSlug(slug)) {
      const syndicatedPost = await getPostBySyndicatedSlug(slug);
      if (!syndicatedPost) return res.status(404).json({ success: false, message: "Post not found" });
      return res.status(200).json({ success: true, post: syndicatedPost });
    }
    let row = await Article.findPublishedBySlug(slug, req.site.id);
    let kind = "ARTICLE";
    if (!row) {
      row = await Blog.findPublishedBySlug(slug, req.site.id);
      kind = "BLOG";
    }
    if (!row) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (kind === "ARTICLE") await Article.incrementViews(row.id);
    else if (kind === "BLOG") await Blog.incrementViews(row.id);

    const contentMedia = splitContentMedia(row.content);
    const post = {
      id: row.id,
      type: kind,
      slug: row.slug,
      category: row.category || row.state || "News",
      title: row.title,
      excerpt: row.excerpt,
      image: row.featured_image || null,
      date: dateLabel(row),
      author: row.author_name,
      readTime: readTimeOf(row.content),
      tags: row.tags || [],
      views: (Number(row.views) || 0) + 1,
      content: paragraphsOf(contentMedia.text),
      additionalImages: contentMedia.images || [],
      comments_enabled: row.comments_enabled !== 0,
    };

    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.error("Get post by slug error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Investor-only: the 10 most-viewed approved articles and 3 most-viewed approved blogs.
const getInvestorTopContent = async (req, res) => {
  try {
    const [articles, blogs] = await Promise.all([
      Article.findPublished({ siteId: req.site.id, orderBy: "views", limit: 10 }),
      Blog.findPublished({ siteId: req.site.id, orderBy: "views", limit: 3 }),
    ]);
    return res.status(200).json({ success: true, news: articles.map(toArticleTeaser), blogs: blogs.map(toBlogTeaser) });
  } catch (error) {
    console.error("Investor top content error:", error);
    return res.status(500).json({ success: false, message: "Unable to load top content" });
  }
};

const plainText = (html, max) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// The /premium page: premium stories (marked by an author, or inside a subscribers-only category) and a card for
// every subscribers-only category (even one with no stories yet).
const getPremiumPosts = async (req, res) => {
  try {
    const { PREMIUM_TYPES } = require("../../config/premiumConfig");
    const siteId = req.site.id;
    const [premiumCategories, articleRows, blogRows] = await Promise.all([
      Category.findPremium(siteId),
      Article.findPublished({ siteId, orderBy: "recent", limit: POOL_LIMIT }),
      Blog.findPublished({ siteId, orderBy: "recent", limit: POOL_LIMIT }),
    ]);
    const premiumNames = premiumNameSet(premiumCategories.map((category) => category.name));
    // Newest first, sorted on the stored dates (the story cards only carry a display label).
    const stories = [
      ...withPremium(articleRows, premiumNames).filter((row) => row.premium_type).map((row) => ({ row, story: { ...toArticleTeaser(row), premium: row.premium_type } })),
      ...withPremium(blogRows, premiumNames).filter((row) => row.premium_type).map((row) => ({ row, story: { ...toBlogTeaser(row), premium: row.premium_type } })),
    ].sort((a, b) => publishedTime(b.row) - publishedTime(a.row)).map((entry) => entry.story);

    const categories = premiumCategories.map((category) => {
      const inCategory = stories.filter((story) => String(story.category || "").trim().toLowerCase() === category.name.trim().toLowerCase());
      return {
        name: category.name,
        slug: category.slug,
        description: plainText(category.content, 180),
        count: inCategory.length,
        latest: inCategory[0] ? { title: inCategory[0].title, image: inCategory[0].image } : null,
      };
    });
    return res.status(200).json({ success: true, posts: stories, categories, types: PREMIUM_TYPES });
  } catch (error) {
    console.error("Premium posts error:", error);
    return res.status(500).json({ success: false, message: "Premium stories could not be loaded" });
  }
};

module.exports = { getPremiumPosts, getCategories, getTopicPosts, getHome, getPostBySlug, getInvestorTopContent };
