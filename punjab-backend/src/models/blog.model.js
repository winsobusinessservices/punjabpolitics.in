// Blogs follow the same workflow as articles: create -> DRAFT -> submit ->
// AI check -> editor review -> APPROVED/REJECTED. Editing resets to DRAFT.
const pool = require("../config/db");
const { uniqueSlug } = require("../utils/slugify");
const { findBlockedPhrase } = require("../utils/contentModeration");
// Blogs share the same title/excerpt/content shape as articles, so the same
// OpenAI-backed grammar/quality reviewer is reused rather than duplicating
// the prompt and JSON schema in a near-identical "blogAi.service.js".
const { reviewArticleWithAI } = require("../services/articleAi.service");

const TABLE = "blogs";

function parseRow(row) {
  if (!row) return row;
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
    ai_grammar_issues: typeof row.ai_grammar_issues === "string" ? JSON.parse(row.ai_grammar_issues) : row.ai_grammar_issues,
    ai_spelling_issues: typeof row.ai_spelling_issues === "string" ? JSON.parse(row.ai_spelling_issues) : row.ai_spelling_issues,
  };
}

const NOT_REVIEWED_BY_AI = {
  language: null,
  languageConfidence: null,
  summary: null,
  grammarIssues: [],
  spellingIssues: [],
  correctedContent: null,
  qualityScore: 0,
  recommendation: "NEEDS_CORRECTION",
};

async function runAiCheck({ title, excerpt, content }) {
  if (!content || content.trim().length < 40) {
    return { status: "FLAGGED", notes: "Content is too short for a meaningful review (minimum 40 characters).", ...NOT_REVIEWED_BY_AI };
  }
  const hit = findBlockedPhrase(`${title} ${excerpt || ""} ${content}`);
  if (hit) {
    return { status: "FLAGGED", notes: `Contains a blocked phrase: "${hit}".`, ...NOT_REVIEWED_BY_AI };
  }

  const aiResult = await reviewArticleWithAI({ title, excerpt, content });
  return {
    status: aiResult.recommendation === "PASS" ? "PASSED" : "FLAGGED",
    notes: aiResult.notes || null,
    language: aiResult.language || null,
    languageConfidence: aiResult.languageConfidence ?? null,
    summary: aiResult.summary || null,
    grammarIssues: aiResult.grammarIssues || [],
    spellingIssues: aiResult.spellingIssues || [],
    correctedContent: aiResult.correctedContent || null,
    qualityScore: aiResult.qualityScore ?? null,
    recommendation: aiResult.recommendation || "NEEDS_CORRECTION",
  };
}

const Blog = {
  runAiCheck,

  async findCategories(siteId = 1) {
    const [rows] = await pool.query(
      `SELECT DISTINCT TRIM(category) AS category FROM ${TABLE} WHERE deleted_at IS NULL AND site_id = ? AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category`, [siteId]
    );
    return rows.map((row) => row.category);
  },

  async create({ authorId, siteId, title, excerpt, content, featuredImage, category, tags, relatedArticleId, scheduledPublishAt }) {
    const slug = await uniqueSlug(title, async (candidate) => Boolean(await Blog.findBySlug(candidate)));

    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (author_id, site_id, title, slug, excerpt, content, featured_image, category, tags, related_article_id, scheduled_publish_at, status, ai_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'NOT_CHECKED')`,
      [authorId, siteId || 1, title, slug, excerpt ?? null, content, featuredImage, category, tags ? JSON.stringify(tags) : null, relatedArticleId ?? null, scheduledPublishAt ?? null]
    );
    return Blog.findById(result.insertId);
  },

  // LEFT JOINed (not a bare SELECT *) so callers — the review-permission
  // check in particular — can see the author's role without a second query.
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT b.*, u.role AS author_role FROM ${TABLE} b LEFT JOIN users u ON u.id = b.author_id WHERE b.id = ? AND b.deleted_at IS NULL`,
      [id]
    );
    return parseRow(rows[0]);
  },

  async findBySlug(slug) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE slug = ? AND deleted_at IS NULL`, [slug]);
    return parseRow(rows[0]);
  },

  // Public reads — no auth, APPROVED only. See article.model.js's
  // findPublished for the category-substring-match rationale.
  async findPublished({ category, siteId = 1, orderBy = "recent", limit = 20 } = {}) {
    const conditions = ["b.deleted_at IS NULL", "b.status = 'APPROVED'", "COALESCE(b.published_at, b.created_at) <= NOW()"];
    const params = [siteId];
    conditions.push("b.site_id = ?");
    if (category) {
      conditions.push("b.category LIKE ?");
      params.push(`%${category}%`);
    }
    const order = orderBy === "views"
      ? "b.views DESC, COALESCE(b.published_at, b.created_at) DESC, b.id DESC"
      : "COALESCE(b.published_at, b.created_at) DESC, b.created_at DESC, b.id DESC";
    const [rows] = await pool.query(
      `SELECT b.*, COALESCE(u.name, 'Editorial Team') AS author_name
       FROM ${TABLE} b
       LEFT JOIN users u ON u.id = b.author_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${order}
       LIMIT ?`,
      [...params, limit]
    );
    return rows.map(parseRow);
  },

  async findPublishedForTopics(topics, limit = 60, siteId = 1) {
    if (!topics.length) return [];
    const topicCondition = topics.map(() => `(
      LOWER(b.category) = LOWER(?) OR JSON_CONTAINS(COALESCE(b.tags, JSON_ARRAY()), JSON_QUOTE(?)) OR
      LOWER(CONCAT_WS(' ', b.title, b.excerpt, b.content)) LIKE LOWER(?)
    )`).join(" OR ");
    const params = topics.flatMap((topic) => [topic, topic, `%${topic}%`]);
    const [rows] = await pool.query(
      `SELECT b.*, COALESCE(u.name, 'Editorial Team') AS author_name FROM ${TABLE} b LEFT JOIN users u ON u.id = b.author_id
       WHERE b.deleted_at IS NULL AND b.status = 'APPROVED' AND b.site_id = ? AND COALESCE(b.published_at, b.created_at) <= NOW() AND (${topicCondition})
       ORDER BY b.published_at DESC, b.views DESC LIMIT ?`,
      [siteId, ...params, limit]
    );
    return rows.map(parseRow);
  },

  async findPublishedBySlug(slug, siteId = 1) {
    const [rows] = await pool.query(
      `SELECT b.*, COALESCE(u.name, 'Editorial Team') AS author_name FROM ${TABLE} b LEFT JOIN users u ON u.id = b.author_id WHERE b.slug = ? AND b.site_id = ? AND b.deleted_at IS NULL AND b.status = 'APPROVED' AND COALESCE(b.published_at, b.created_at) <= NOW()`,
      [slug, siteId]
    );
    return parseRow(rows[0]);
  },

  async incrementViews(id) {
    await pool.query(`UPDATE ${TABLE} SET views = views + 1 WHERE id = ?`, [id]);
  },

  // Always scoped to the caller's own content — see article.model.js's
  // findForUser for why this no longer branches on role.
  async findForUser(user, { status } = {}) {
    const conditions = ["b.author_id = ?", "b.deleted_at IS NULL", "b.site_id = ?"];
    const params = [user.userId, user.siteId || 1];
    if (status) {
      conditions.push("b.status = ?");
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT b.*, COALESCE(u.name, 'Editorial Team') AS author_name FROM ${TABLE} b LEFT JOIN users u ON u.id = b.author_id WHERE ${conditions.join(" AND ")} ORDER BY b.created_at DESC`,
      params
    );
    return rows.map(parseRow);
  },

  // Moderator-only — every author, every status. See article.model.js's
  // findAll for the full rationale.
  async findAll({ status, siteId } = {}) {
    const conditions = ["b.deleted_at IS NULL"];
    const params = [];
    if (siteId) { conditions.push("b.site_id = ?"); params.push(siteId); }
    if (status) {
      conditions.push("b.status = ?");
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT b.*, COALESCE(u.name, 'Editorial Team') AS author_name, u.role AS author_role, r.name AS reviewer_name
       FROM ${TABLE} b
       LEFT JOIN users u ON u.id = b.author_id
       LEFT JOIN users r ON r.id = b.reviewer_id
       ${where} ORDER BY b.created_at DESC`,
      params
    );
    return rows.map(parseRow);
  },

  async update(id, { title, excerpt, content, featuredImage, category, tags, relatedArticleId, scheduledPublishAt }) {
    await pool.query(
      `UPDATE ${TABLE}
       SET title = ?, excerpt = ?, content = ?, featured_image = ?, category = ?, tags = ?, related_article_id = ?, scheduled_publish_at = ?,
           status = 'DRAFT', ai_status = 'NOT_CHECKED', ai_notes = NULL, ai_language = NULL, ai_language_confidence = NULL,
           ai_summary = NULL, ai_grammar_issues = NULL, ai_spelling_issues = NULL, ai_corrected_content = NULL, ai_quality_score = NULL, ai_recommendation = NULL,
           reviewer_id = NULL, review_notes = NULL, submitted_at = NULL, reviewed_at = NULL
       WHERE id = ?`,
      [title, excerpt ?? null, content, featuredImage, category, tags ? JSON.stringify(tags) : null, relatedArticleId ?? null, scheduledPublishAt ?? null, id]
    );
    return Blog.findById(id);
  },

  async submit(id) {
    const blog = await Blog.findById(id);
    if (!blog) throw new Error("BLOG_NOT_FOUND");
    if (!["DRAFT", "REJECTED"].includes(blog.status)) throw new Error("BLOG_CANNOT_BE_SUBMITTED");

    await pool.query(`UPDATE ${TABLE} SET ai_status = 'PROCESSING', submitted_at = NOW() WHERE id = ?`, [id]);

    try {
      const aiResult = await Blog.runAiCheck(blog);
      await pool.query(
        `UPDATE ${TABLE}
         SET status = 'PENDING', ai_status = ?, ai_notes = ?, ai_language = ?, ai_language_confidence = ?, ai_summary = ?,
             ai_grammar_issues = ?, ai_spelling_issues = ?, ai_corrected_content = ?, ai_quality_score = ?, ai_recommendation = ?, submitted_at = NOW()
         WHERE id = ?`,
        [
          aiResult.status,
          aiResult.notes || null,
          aiResult.language || null,
          aiResult.languageConfidence ?? null,
          aiResult.summary || null,
          JSON.stringify(aiResult.grammarIssues || []),
          JSON.stringify(aiResult.spellingIssues || []),
          aiResult.correctedContent || null,
          aiResult.qualityScore ?? null,
          aiResult.recommendation || null,
          id,
        ]
      );
      return Blog.findById(id);
    } catch (error) {
      console.error("AI review failed for blog:", id, error);
      // Same non-blocking rule as articles — AI is advisory, so a failure
      // still lands the blog in PENDING for manual editor review.
      await pool.query(
        `UPDATE ${TABLE}
         SET status = 'PENDING', ai_status = 'FAILED',
             ai_notes = 'AI review could not be completed. An editor will need to review this manually.'
         WHERE id = ?`,
        [id]
      );
      return Blog.findById(id);
    }
  },

  async review(id, { reviewerId, action, notes, ...fields }) {
    if (action === "UPDATE") {
      const current = await Blog.findById(id);
      await pool.query(
        `UPDATE ${TABLE} SET title = ?, excerpt = ?, content = ?, featured_image = ?, category = ?, tags = ?, related_article_id = ?,
         reviewer_id = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?`,
        [
          fields.title ?? current.title,
          fields.excerpt ?? current.excerpt,
          fields.content ?? current.content,
          fields.featuredImage ?? current.featured_image,
          fields.category ?? current.category,
          fields.tags ? JSON.stringify(fields.tags) : current.tags ? JSON.stringify(current.tags) : null,
          fields.relatedArticleId ?? current.related_article_id,
          reviewerId,
          notes ?? null,
          id,
        ]
      );
    } else if (action === "SCHEDULE") {
      await pool.query(
        `UPDATE ${TABLE} SET status = 'PENDING', reviewer_id = ?, review_notes = ?, scheduled_publish_at = ?, reviewed_at = NULL WHERE id = ?`,
        [reviewerId, notes ?? null, fields.scheduledPublishAt, id]
      );
    } else {
      const status = action === "APPROVE" ? "APPROVED" : "REJECTED";
      const publishedAt = action === "APPROVE" ? new Date() : null;
      await pool.query(
        `UPDATE ${TABLE} SET status = ?, reviewer_id = ?, review_notes = ?, reviewed_at = NOW(),
         scheduled_publish_at = NULL,
         published_at = CASE WHEN ? = 'APPROVED' THEN COALESCE(published_at, ?) ELSE published_at END
         WHERE id = ?`,
        [status, reviewerId, notes ?? null, status, publishedAt, id]
      );
    }
    return Blog.findById(id);
  },

  async remove(id) {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  },

  async setCommentsEnabled(id, enabled) {
    await pool.query(`UPDATE ${TABLE} SET comments_enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
    return Blog.findById(id);
  },
};

module.exports = Blog;
