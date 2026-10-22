// Searchable site links for staff: the rich text editor's "Add link" box and the task form's
// "Related to" picker.
//   GET /internal-links?q=  -> { items: [{ type, id, slug, title, href, category }] }
// Types: ARTICLE, BLOG, PAGE (policies, services, districts, jobs, fixed pages), CATEGORY,
// TOPIC (popular tags / keywords), STATE, PARTY, POLITICIAN.
// A query that starts with "/" matches by address (for example "/news/punjab").
const express = require("express");
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth.middleware");
const { slugify } = require("../utils/slugify");

const router = express.Router();
const PER_SOURCE_LIMIT = 10;
const TOTAL_LIMIT = 200;
const STAFF_ROLES = ["ADMIN", "SUBADMIN", "EDITOR", "AUTHOR"];

const FIXED_PAGES = [
  ["Home", "/"], ["About us", "/about"], ["Contact us", "/contact"], ["Careers", "/careers"], ["Policies", "/policies"],
  ["Political parties", "/parties"], ["Chief ministers", "/cm"], ["Key political figures", "/key-political-figures"],
  ["Former prime ministers", "/former-prime-ministers"], ["States and union territories", "/state"], ["Districts", "/district"],
  ["Lok Sabha", "/loksabha"], ["Rajya Sabha", "/rajyasabha"], ["Elections", "/elections"], ["Speeches", "/speeches"],
  ["Rallies", "/rallies"], ["Press conferences", "/press-conferences"], ["Political calendar", "/political-calendar"],
  ["Top news", "/top-news"], ["Trending", "/trending"], ["Blogs", "/blogs"], ["Videos", "/videos"], ["Services", "/services"],
];

const staffOnly = (req, res, next) => {
  if (!STAFF_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Only team members can search site pages" });
  }
  return next();
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (character) => `\\${character}`);

router.get("/internal-links", authenticate, staffOnly, async (req, res) => {
  try {
    const siteId = Number(req.site?.id || req.user?.siteId || 1);
    const query = String(req.query.q || "").trim().slice(0, 100);
    const byPath = query.startsWith("/");
    const needle = (byPath ? query.split("/").filter(Boolean).pop() || "" : query).toLowerCase();
    const like = `%${escapeLike(needle)}%`;
    const searchSql = needle.length >= 2;

    const matchesText = (...values) => !needle || values.some((value) => String(value || "").toLowerCase().includes(needle));
    const items = [];
    const add = (type, id, slug, title, href, category) => items.push({ type, id, slug: slug || slugify(title), title, href, category });

    // Content is searched in SQL (there can be thousands of rows), and only when there is a query.
    const queries = [];
    if (searchSql) {
      const published = "deleted_at IS NULL AND status = 'APPROVED' AND COALESCE(published_at, created_at) <= NOW() AND site_id = ?";
      queries.push(
        pool.query(`SELECT id, slug, title, category FROM articles WHERE ${published} AND (title LIKE ? OR slug LIKE ?) ORDER BY COALESCE(published_at, created_at) DESC LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => row.slug && add("ARTICLE", row.id, row.slug, row.title, `/news/${row.slug}`, row.category || "Article"))),
        pool.query(`SELECT id, slug, title, category FROM blogs WHERE ${published} AND (title LIKE ? OR slug LIKE ?) ORDER BY COALESCE(published_at, created_at) DESC LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => row.slug && add("BLOG", row.id, row.slug, row.title, `/news/${row.slug}`, row.category || "Blog"))),
        pool.query(`SELECT id, slug, title FROM policies WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at <= NOW() AND site_id = ? AND (title LIKE ? OR slug LIKE ?) LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => add("PAGE", row.id, row.slug, row.title, `/policies/${row.slug}`, "Policy"))),
        pool.query(`SELECT id, slug, title FROM services WHERE is_visible = 1 AND site_id = ? AND (title LIKE ? OR slug LIKE ?) LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => add("PAGE", row.id, row.slug, row.title, `/services/${row.slug}`, "Service"))),
        pool.query(`SELECT id, slug, name FROM districts WHERE deleted_at IS NULL AND site_id = ? AND (name LIKE ? OR slug LIKE ?) LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => add("PAGE", row.id, row.slug, `${row.name} district`, `/district/${row.slug}`, "District"))),
        pool.query(`SELECT id, slug, title FROM career_jobs WHERE deleted_at IS NULL AND status = 'OPEN' AND site_id = ? AND (title LIKE ? OR slug LIKE ?) LIMIT ${PER_SOURCE_LIMIT}`, [siteId, like, like])
          .then(([rows]) => rows.forEach((row) => add("PAGE", row.id, row.slug, row.title, `/careers/${row.slug}`, "Job")))
      );
    }

    // Smaller lists are filtered here; they also answer an empty query (task picker).
    queries.push(
      pool.query("SELECT id, name, slug FROM categories WHERE deleted_at IS NULL AND is_visible = 1 AND site_id = ? ORDER BY name ASC", [siteId])
        .then(([rows]) => rows.filter((row) => matchesText(row.name, row.slug)).slice(0, PER_SOURCE_LIMIT * 4).forEach((row) => add("CATEGORY", row.id, row.slug, row.name, `/category/${row.slug || slugify(row.name)}`, "Category"))),
      pool.query("SELECT id, name, slug FROM parties WHERE deleted_at IS NULL AND site_id = ? ORDER BY sort_order ASC, name ASC", [siteId])
        .then(([rows]) => rows.filter((row) => matchesText(row.name, row.slug)).slice(0, PER_SOURCE_LIMIT * 4).forEach((row) => add("PARTY", row.id, row.slug, row.name, `/category/${row.slug || slugify(row.name)}`, "Party"))),
      pool.query("SELECT id, name, slug FROM politicians WHERE deleted_at IS NULL AND site_id = ? ORDER BY sort_order ASC, name ASC", [siteId])
        .then(([rows]) => rows.filter((row) => matchesText(row.name, row.slug)).slice(0, PER_SOURCE_LIMIT * 4).forEach((row) => add("POLITICIAN", row.id, row.slug, row.name, `/category/${slugify(row.name)}`, "Leader"))),
      pool.query("SELECT id, name, slug FROM states WHERE deleted_at IS NULL AND site_id = ? ORDER BY sort_order ASC, name ASC", [siteId])
        .then(([rows]) => rows.filter((row) => matchesText(row.name, row.slug)).slice(0, PER_SOURCE_LIMIT * 4).forEach((row) => add("STATE", row.id, row.slug, row.name, `/category/${row.slug || slugify(row.name)}`, "State"))),
      pool.query("SELECT widget_key, data FROM home_widgets WHERE site_id = ? AND widget_key IN ('popular_tags', 'extra_keywords')", [siteId])
        .then(([rows]) => {
          const keywords = [...new Set(rows.flatMap((row) => (Array.isArray(row.data) ? row.data : [])).map((value) => String(value).trim()).filter(Boolean))];
          keywords.filter((value) => matchesText(value)).slice(0, PER_SOURCE_LIMIT * 4).forEach((value, index) => add("TOPIC", index + 1, slugify(value), value, `/category/${slugify(value)}`, "Keyword"));
        })
    );
    await Promise.all(queries);

    FIXED_PAGES.filter(([title, href]) => matchesText(title, href)).forEach(([title, href], index) => add("PAGE", index + 1, slugify(href) || "home", title, href, "Page"));

    const lowered = query.toLowerCase();
    const rank = (item) => {
      const title = item.title.toLowerCase();
      if (byPath) return item.href.toLowerCase().startsWith(lowered) ? 0 : 1;
      return title === lowered ? 0 : title.startsWith(lowered) ? 1 : 2;
    };
    const results = items
      .filter((item) => !byPath || item.href.toLowerCase().includes(lowered))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, TOTAL_LIMIT);
    return res.status(200).json({ success: true, items: results });
  } catch (error) {
    console.error("Internal links error:", error);
    return res.status(500).json({ success: false, message: "Site pages could not be loaded" });
  }
});

module.exports = router;
