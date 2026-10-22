// Public, read-only homepage/news content — no auth, anyone can fetch it.
//   GET /news/home         everything the home page needs in one response
//   GET /news/posts/:slug  a single post (direct lookup, not currently
//                          used by the frontend but available for API consumers)
const express = require("express");
const { getPremiumPosts, getCategories, getTopicPosts, getHome, getPostBySlug, getInvestorTopContent } = require("../controllers/news/news.controller");
const { authenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * @openapi
 * /api/news/home:
 *   get:
 *     summary: Get everything the home page needs in one response
 *     description: Aggregates published articles/blogs/videos into hero slides, top stories, editorial picks, regional focus, trending, blogs, careers/speeches/rallies category slices, and video sections, plus admin-managed home widgets.
 *     tags: [News]
 *     responses:
 *       200:
 *         description: Home page content bundle (news sections, flat posts list, widgets)
 */
router.get("/news/home", getHome);
router.get("/news/premium", getPremiumPosts);

// Privileged: needs the "Top Content" privilege (Admin always; Investors by default; others if granted).
router.get("/investor/top-content", authenticate, authorizePermission(PERMISSIONS.VIEW_TOP_CONTENT), getInvestorTopContent);

/**
 * @openapi
 * /api/news/categories:
 *   get:
 *     summary: List available content categories
 *     description: Returns configured categories plus distinct categories already used by articles, blogs, and videos.
 *     tags: [News]
 *     responses:
 *       200:
 *         description: Alphabetized category list
 */
router.get("/news/categories", getCategories);

/**
 * @openapi
 * /api/news/topics:
 *   get:
 *     summary: List published posts matching topic terms
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         description: Repeat this parameter to search up to ten topic terms
 *         style: form
 *         explode: true
 *         schema:
 *           type: array
 *           maxItems: 10
 *           items: { type: string }
 *     responses:
 *       200: { description: Matching published posts }
 *       400: { description: At least one topic term is required }
 *       500: { description: Internal server error }
 */
router.get("/news/topics", getTopicPosts);

/**
 * @openapi
 * /api/news/posts/{slug}:
 *   get:
 *     summary: Get a single published article or blog post by slug
 *     description: Searches published articles then published blogs, and increments the post's view count.
 *     tags: [News]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The matching post
 *       404:
 *         description: Post not found
 */
router.get("/news/posts/:slug", getPostBySlug);

module.exports = router;
