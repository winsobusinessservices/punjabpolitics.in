const pool = require("../config/db");
const { uniqueSlug } = require("../utils/slugify");
const { findBlockedPhrase } = require("../utils/contentModeration");
const { reviewArticleWithAI } = require("../services/articleAi.service");

const TABLE = "articles";

function parseRow(row) {
  if (!row) return row;

  return {
    ...row,
    tags:
      typeof row.tags === "string"
        ? JSON.parse(row.tags)
        : row.tags,
    ai_grammar_issues:
      typeof row.ai_grammar_issues === "string"
        ? JSON.parse(row.ai_grammar_issues)
        : row.ai_grammar_issues,
    ai_spelling_issues:
      typeof row.ai_spelling_issues === "string"
        ? JSON.parse(row.ai_spelling_issues)
        : row.ai_spelling_issues,
  };
}

/*
 * AI CHECK
 */
async function runAiCheck({
  title,
  excerpt,
  content,
}) {
  if (!content || content.trim().length < 40) {
    return {
      status: "FLAGGED",
      notes:
        "Content is too short for a meaningful review (minimum 40 characters).",
      language: null,
      languageConfidence: null,
      summary: null,
      grammarIssues: [],
      spellingIssues: [],
      correctedContent: null,
      qualityScore: 0,
      recommendation: "NEEDS_CORRECTION",
    };
  }

  const hit = findBlockedPhrase(
    `${title} ${excerpt || ""} ${content}`
  );

  if (hit) {
    return {
      status: "FLAGGED",
      notes: `Contains a blocked phrase: "${hit}".`,
      language: null,
      languageConfidence: null,
      summary: null,
      grammarIssues: [],
      spellingIssues: [],
      correctedContent: null,
      qualityScore: 0,
      recommendation: "NEEDS_CORRECTION",
    };
  }

  const aiResult = await reviewArticleWithAI({
    title,
    excerpt,
    content,
  });

  console.log(
    "AI SERVICE RESULT:",
    JSON.stringify(aiResult, null, 2)
  );

  return {
    status:
      aiResult.recommendation === "PASS"
        ? "PASSED"
        : "FLAGGED",

    notes: aiResult.notes || null,

    language: aiResult.language || null,

    languageConfidence: aiResult.languageConfidence ?? null,

    summary: aiResult.summary || null,

    grammarIssues: aiResult.grammarIssues || [],

    spellingIssues: aiResult.spellingIssues || [],

    correctedContent:
      aiResult.correctedContent || null,

    qualityScore:
      aiResult.qualityScore ?? null,

    recommendation:
      aiResult.recommendation || "NEEDS_CORRECTION",
  };
}

const Article = {
  runAiCheck,

  async findCategories(siteId = 1) {
    const [rows] = await pool.query(
      `SELECT DISTINCT TRIM(category) AS category FROM ${TABLE} WHERE deleted_at IS NULL AND site_id = ? AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category`, [siteId]
    );
    return rows.map((row) => row.category);
  },

  /*
   * CREATE
   * New article always starts as DRAFT.
   */
  async create({
    authorId,
    siteId,
    title,
    excerpt,
    content,
    featuredImage,
    category,
    state,
    tags,
    relatedPolitician,
    relatedElection,
    scheduledPublishAt,
  }) {
    const slug = await uniqueSlug(
      title,
      async (candidate) =>
        Boolean(await Article.findBySlug(candidate))
    );

    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (
          author_id,
          site_id,
          title,
          slug,
          excerpt,
          content,
          featured_image,
          category,
          state,
          tags,
          related_politician,
          related_election,
          scheduled_publish_at,
          status,
          ai_status
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'NOT_CHECKED')`,
      [
        authorId,
        siteId || 1,
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        category,
        state ?? null,
        tags ? JSON.stringify(tags) : null,
        relatedPolitician ?? null,
        relatedElection ?? null,
        scheduledPublishAt ?? null,
      ]
    );

    return Article.findById(result.insertId);
  },

  /*
   * FIND BY ID
   */
  // LEFT JOINed (not a bare SELECT *) so callers — the review-permission
  // check in particular — can see the author's role without a second query.
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT a.*, u.role AS author_role
       FROM ${TABLE} a
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.id = ? AND a.deleted_at IS NULL`,
      [id]
    );

    return parseRow(rows[0]);
  },

  /*
   * FIND BY SLUG
   */
  async findBySlug(slug) {
    const [rows] = await pool.query(
      `SELECT * FROM ${TABLE} WHERE slug = ? AND deleted_at IS NULL`,
      [slug]
    );

    return parseRow(rows[0]);
  },

  /*
   * PUBLIC READS — no auth. Every homepage/news section is backed by real
   * author-created, editor-approved articles instead of invented dummy
   * content, so these only ever return status = 'APPROVED' rows.
   */

  // orderBy: 'views' (highest views first, ties broken by newest) or
  // 'recent' (newest first). `category`/`state` do a case-insensitive
  // substring match since authors free-type both fields in PostForm.jsx —
  // there's no fixed taxonomy to match exactly against.
  async findPublished({ category, state, sinceDays, siteId = 1, orderBy = "recent", limit = 20 } = {}) {
    const conditions = ["a.deleted_at IS NULL", "a.status = 'APPROVED'", "COALESCE(a.published_at, a.created_at) <= NOW()"];
    const params = [siteId];
    conditions.push("a.site_id = ?");

    if (category) {
      conditions.push("a.category LIKE ?");
      params.push(`%${category}%`);
    }
    if (state) {
      conditions.push("a.state = ?");
      params.push(state);
    }
    if (sinceDays) {
      conditions.push("a.published_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
      params.push(sinceDays);
    }

    const order = orderBy === "views"
      ? "a.views DESC, COALESCE(a.published_at, a.created_at) DESC, a.id DESC"
      : "COALESCE(a.published_at, a.created_at) DESC, a.created_at DESC, a.id DESC";

    const [rows] = await pool.query(
      `SELECT a.*, COALESCE(u.name, 'Editorial Team') AS author_name
       FROM ${TABLE} a
       LEFT JOIN users u ON u.id = a.author_id
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
      LOWER(a.category) = LOWER(?) OR LOWER(a.state) = LOWER(?) OR
      LOWER(a.related_politician) = LOWER(?) OR LOWER(a.related_election) = LOWER(?) OR
      JSON_CONTAINS(COALESCE(a.tags, JSON_ARRAY()), JSON_QUOTE(?)) OR
      LOWER(CONCAT_WS(' ', a.title, a.excerpt, a.content)) LIKE LOWER(?)
    )`).join(" OR ");
    const params = topics.flatMap((topic) => [topic, topic, topic, topic, topic, `%${topic}%`]);
    const [rows] = await pool.query(
      `SELECT a.*, COALESCE(u.name, 'Editorial Team') AS author_name FROM ${TABLE} a LEFT JOIN users u ON u.id = a.author_id
       WHERE a.deleted_at IS NULL AND a.status = 'APPROVED' AND a.site_id = ? AND COALESCE(a.published_at, a.created_at) <= NOW() AND (${topicCondition})
       ORDER BY a.published_at DESC, a.views DESC LIMIT ?`,
      [siteId, ...params, limit]
    );
    return rows.map(parseRow);
  },

  async findPublishedBySlug(slug, siteId = 1) {
    const [rows] = await pool.query(
      `SELECT a.*, COALESCE(u.name, 'Editorial Team') AS author_name
       FROM ${TABLE} a
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.slug = ? AND a.site_id = ? AND a.deleted_at IS NULL AND a.status = 'APPROVED' AND COALESCE(a.published_at, a.created_at) <= NOW()`,
      [slug, siteId]
    );
    return parseRow(rows[0]);
  },

  async incrementViews(id) {
    await pool.query(`UPDATE ${TABLE} SET views = views + 1 WHERE id = ?`, [id]);
  },

  /*
   * FIND ARTICLES
   *
   * Always scoped to the caller's own content — "My Content" means MY
   * content, regardless of role. Editors/admins reviewing other authors'
   * work use findAll() (the review queue / content history) instead.
   */
  async findForUser(user, { status } = {}) {
    const conditions = ["a.author_id = ?", "a.deleted_at IS NULL", "a.site_id = ?"];
    const params = [user.userId, user.siteId || 1];

    if (status) {
      conditions.push("a.status = ?");
      params.push(status);
    }

    const [rows] = await pool.query(
      `
      SELECT
        a.*,
        COALESCE(u.name, 'Editorial Team') AS author_name
      FROM ${TABLE} a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.created_at DESC
      `,
      params
    );

    return rows.map(parseRow);
  },

  /*
   * FIND ALL (moderator-only — every author, every status)
   *
   * Backs the review queue (status=PENDING) and the content history page
   * (no status filter, or any specific one). Never scoped to a single
   * author — that's findForUser()'s job.
   */
  async findAll({ status, siteId } = {}) {
    const conditions = ["a.deleted_at IS NULL"];
    const params = [];
    if (siteId) { conditions.push("a.site_id = ?"); params.push(siteId); }

    if (status) {
      conditions.push("a.status = ?");
      params.push(status);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await pool.query(
      `
      SELECT
        a.*,
        COALESCE(u.name, 'Editorial Team') AS author_name,
        u.role AS author_role,
        r.name AS reviewer_name
      FROM ${TABLE} a
      LEFT JOIN users u ON u.id = a.author_id
      LEFT JOIN users r ON r.id = a.reviewer_id
      ${where}
      ORDER BY a.created_at DESC
      `,
      params
    );

    return rows.map(parseRow);
  },

  /*
   * UPDATE
   *
   * Any edit sends the article back to DRAFT.
   */
  async update(
    id,
    {
      title,
      excerpt,
      content,
      featuredImage,
      category,
      state,
      tags,
      relatedPolitician,
      relatedElection,
      scheduledPublishAt,
    }
  ) {
    await pool.query(
      `UPDATE ${TABLE}
       SET
         title = ?,
         excerpt = ?,
         content = ?,
         featured_image = ?,
         category = ?,
         state = ?,
         tags = ?,
         related_politician = ?,
         related_election = ?,
         scheduled_publish_at = ?,

         status = 'DRAFT',
         ai_status = 'NOT_CHECKED',
         ai_notes = NULL,
         ai_language = NULL,
         ai_language_confidence = NULL,
         ai_summary = NULL,
          ai_grammar_issues = NULL,
          ai_spelling_issues = NULL,
          ai_corrected_content = NULL,
          ai_quality_score = NULL,
          ai_recommendation = NULL,

         reviewer_id = NULL,
         review_notes = NULL,
         submitted_at = NULL,
         reviewed_at = NULL

       WHERE id = ?`,
      [
        title,
        excerpt,
        content,
        featuredImage,
        category,
        state ?? null,
        tags ? JSON.stringify(tags) : null,
        relatedPolitician ?? null,
        relatedElection ?? null,
        scheduledPublishAt ?? null,
        id,
      ]
    );

    return Article.findById(id);
  },

  /*
   * SUBMIT
   *
   * DRAFT
   * ↓
   * AI CHECK
   * ↓
   * PENDING
   */
  async submit(id) {
  const article = await Article.findById(id);

  if (!article) {
    throw new Error("ARTICLE_NOT_FOUND");
  }

  if (!["DRAFT", "REJECTED"].includes(article.status)) {
    throw new Error("ARTICLE_CANNOT_BE_SUBMITTED");
  }

  // AI processing started
  await pool.query(
    `UPDATE ${TABLE}
     SET
       ai_status = 'PROCESSING',
       submitted_at = NOW()
     WHERE id = ?`,
    [id]
  );

  try {
    console.log("=================================");
    console.log("Starting AI review for article:", id);
    console.log("=================================");

    const aiResult = await Article.runAiCheck(article);

    console.log("========== AI RESULT ==========");
    console.log(JSON.stringify(aiResult, null, 2));
    console.log("===============================");

    await pool.query(
      `UPDATE ${TABLE}
       SET
         status = 'PENDING',
         ai_status = ?,
         ai_notes = ?,
         ai_language = ?,
         ai_language_confidence = ?,
         ai_summary = ?,
         ai_grammar_issues = ?,
         ai_spelling_issues = ?,
         ai_corrected_content = ?,
         ai_quality_score = ?,
         ai_recommendation = ?,
         submitted_at = NOW()
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

    console.log(
      "AI result saved successfully for article:",
      id
    );

    return Article.findById(id);

  } catch (error) {
    console.error(
      "AI review failed for article:",
      id,
      error
    );

    // AI is advisory only and must never block the human workflow — the
    // article still reaches PENDING so an editor can review it manually,
    // just flagged as FAILED instead of PASSED/FLAGGED. Previously this
    // re-threw, which left the article stuck at ai_status='PROCESSING' and
    // never reaching PENDING, and returned a 500 to the author.
    await pool.query(
      `UPDATE ${TABLE}
       SET
         status = 'PENDING',
         ai_status = 'FAILED',
         ai_notes = 'AI review could not be completed. An editor will need to review this manually.'
       WHERE id = ?`,
      [id]
    );

    return Article.findById(id);
  }
},

  /*
   * EDITOR REVIEW
   */
  async review(
    id,
    {
      reviewerId,
      action,
      notes,
      ...fields
    }
  ) {
    /*
     * EDITOR REQUESTS CHANGES
     *
     * Article goes back to DRAFT.
     */
    if (action === "UPDATE") {
      const current = await Article.findById(id);

      if (!current) {
        throw new Error("ARTICLE_NOT_FOUND");
      }

      await pool.query(
        `UPDATE ${TABLE}
         SET
           title = ?,
           excerpt = ?,
           content = ?,
           featured_image = ?,
           category = ?,
           state = ?,
           tags = ?,
           related_politician = ?,
           related_election = ?,

           status = 'DRAFT',
           ai_status = 'NOT_CHECKED',
           ai_notes = NULL,
           ai_language = NULL,
           ai_language_confidence = NULL,
           ai_summary = NULL,
           ai_grammar_issues = NULL,
           ai_spelling_issues = NULL,
           ai_corrected_content = NULL,
           ai_quality_score = NULL,
           ai_recommendation = NULL,

           reviewer_id = ?,
           review_notes = ?,
           reviewed_at = NOW(),

           submitted_at = NULL

         WHERE id = ?`,
        [
          fields.title ?? current.title,
          fields.excerpt ?? current.excerpt,
          fields.content ?? current.content,

          fields.featuredImage ??
            current.featured_image,

          fields.category ?? current.category,
          fields.state ?? current.state,

          fields.tags
            ? JSON.stringify(fields.tags)
            : current.tags
              ? JSON.stringify(current.tags)
              : null,

          fields.relatedPolitician ??
            current.related_politician,

          fields.relatedElection ??
            current.related_election,

          reviewerId,
          notes ?? null,
          id,
        ]
      );

    } else if (action === "SCHEDULE") {
      await pool.query(
        `UPDATE ${TABLE}
         SET status = 'PENDING', reviewer_id = ?, review_notes = ?, scheduled_publish_at = ?, reviewed_at = NULL
         WHERE id = ?`,
        [reviewerId, notes ?? null, fields.scheduledPublishAt, id]
      );
    } else {
      /*
       * APPROVE / REJECT
       */
      const status =
        action === "APPROVE"
          ? "APPROVED"
          : "REJECTED";

      const publishedAt = action === "APPROVE" ? new Date() : null;

      await pool.query(
        `UPDATE ${TABLE}
         SET
           status = ?,
           reviewer_id = ?,
           review_notes = ?,
           reviewed_at = NOW(),
           scheduled_publish_at = NULL,
           published_at = CASE WHEN ? = 'APPROVED' THEN COALESCE(published_at, ?) ELSE published_at END
         WHERE id = ?`,
        [
          status,
          reviewerId,
          notes ?? null,
          status,
          publishedAt,
          id,
        ]
      );
    }

    return Article.findById(id);
  },

  /*
   * DELETE
   */
  async remove(id) {
    await pool.query(
      `DELETE FROM ${TABLE} WHERE id = ?`,
      [id]
    );
  },

  async setCommentsEnabled(id, enabled) {
    await pool.query(`UPDATE ${TABLE} SET comments_enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
    return Article.findById(id);
  },
};

module.exports = Article;
