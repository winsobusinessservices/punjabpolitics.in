// Videos follow the same workflow as articles/blogs: create -> DRAFT ->
// submit -> AI check -> editor review -> APPROVED/REJECTED. No slug — videos
// aren't addressed by a readable URL the way articles/blogs are.
const pool = require("../config/db");
const { findBlockedPhrase } = require("../utils/contentModeration");

const TABLE = "videos";

function parseRow(row) {
  if (!row) return row;
  return { ...row, tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags };
}

function runAiCheck({ title, description, videoUrl }) {
  if (!videoUrl) {
    return { status: "FLAGGED", notes: "Missing video URL." };
  }
  if (!description || description.trim().length < 20) {
    return { status: "FLAGGED", notes: "Description is too short for a meaningful review (minimum 20 characters)." };
  }
  const hit = findBlockedPhrase(`${title} ${description}`);
  if (hit) {
    return { status: "FLAGGED", notes: `Contains a blocked phrase: "${hit}".` };
  }
  return { status: "PASSED", notes: null };
}

const Video = {
  async findCategories(siteId = 1) {
    const [rows] = await pool.query(
      `SELECT DISTINCT TRIM(category) AS category FROM ${TABLE} WHERE deleted_at IS NULL AND site_id = ? AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category`, [siteId]
    );
    return rows.map((row) => row.category);
  },

  runAiCheck,

  async create({ authorId, siteId, title, description, videoSource, videoUrl, thumbnail, category, state, tags, relatedArticleId, relatedPolitician }) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (author_id, site_id, title, description, video_source, video_url, thumbnail, category, state, tags, related_article_id, related_politician, status, ai_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'NOT_CHECKED')`,
      [
        authorId,
        siteId || 1,
        title,
        description,
        videoSource,
        videoUrl,
        thumbnail,
        category,
        state ?? null,
        tags ? JSON.stringify(tags) : null,
        relatedArticleId ?? null,
        relatedPolitician ?? null,
      ]
    );
    return Video.findById(result.insertId);
  },

  // LEFT JOINed (not a bare SELECT *) so callers — the review-permission
  // check in particular — can see the author's role without a second query.
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT v.*, u.role AS author_role FROM ${TABLE} v LEFT JOIN users u ON u.id = v.author_id WHERE v.id = ? AND v.deleted_at IS NULL`,
      [id]
    );
    return parseRow(rows[0]);
  },

  // Public reads — no auth, APPROVED only. See article.model.js's
  // findPublished for the category-substring-match rationale. No slug on
  // videos (see file header), so no findPublishedBySlug here.
  async findPublished({ category, siteId = 1, orderBy = "recent", limit = 20 } = {}) {
    const conditions = ["v.deleted_at IS NULL", "v.status = 'APPROVED'"];
    const params = [siteId];
    conditions.push("v.site_id = ?");
    if (category) {
      conditions.push("v.category LIKE ?");
      params.push(`%${category}%`);
    }
    const order = orderBy === "views"
      ? "v.views DESC, COALESCE(v.published_at, v.created_at) DESC, v.id DESC"
      : "COALESCE(v.published_at, v.created_at) DESC, v.created_at DESC, v.id DESC";
    const [rows] = await pool.query(
      `SELECT v.*, COALESCE(u.name, 'Editorial Team') AS author_name
       FROM ${TABLE} v
       LEFT JOIN users u ON u.id = v.author_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${order}
       LIMIT ?`,
      [...params, limit]
    );
    return rows.map(parseRow);
  },

  async incrementViews(id) {
    await pool.query(`UPDATE ${TABLE} SET views = views + 1 WHERE id = ?`, [id]);
  },

  // Always scoped to the caller's own content — see article.model.js's
  // findForUser for why this no longer branches on role.
  async findForUser(user, { status } = {}) {
    const conditions = ["v.author_id = ?", "v.deleted_at IS NULL", "v.site_id = ?"];
    const params = [user.userId, user.siteId || 1];
    if (status) {
      conditions.push("v.status = ?");
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT v.*, COALESCE(u.name, 'Editorial Team') AS author_name FROM ${TABLE} v LEFT JOIN users u ON u.id = v.author_id WHERE ${conditions.join(" AND ")} ORDER BY v.created_at DESC`,
      params
    );
    return rows.map(parseRow);
  },

  // Moderator-only — every author, every status. See article.model.js's
  // findAll for the full rationale.
  async findAll({ status, siteId } = {}) {
    const conditions = ["v.deleted_at IS NULL"];
    const params = [];
    if (siteId) { conditions.push("v.site_id = ?"); params.push(siteId); }
    if (status) {
      conditions.push("v.status = ?");
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT v.*, COALESCE(u.name, 'Editorial Team') AS author_name, u.role AS author_role, r.name AS reviewer_name
       FROM ${TABLE} v
       LEFT JOIN users u ON u.id = v.author_id
       LEFT JOIN users r ON r.id = v.reviewer_id
       ${where} ORDER BY v.created_at DESC`,
      params
    );
    return rows.map(parseRow);
  },

  async update(id, { title, description, videoSource, videoUrl, thumbnail, category, state, tags, relatedArticleId, relatedPolitician }) {
    await pool.query(
      `UPDATE ${TABLE}
       SET title = ?, description = ?, video_source = ?, video_url = ?, thumbnail = ?, category = ?, state = ?, tags = ?,
           related_article_id = ?, related_politician = ?,
           status = 'DRAFT', ai_status = 'NOT_CHECKED', ai_notes = NULL,
           reviewer_id = NULL, review_notes = NULL, submitted_at = NULL, reviewed_at = NULL
       WHERE id = ?`,
      [
        title,
        description,
        videoSource,
        videoUrl,
        thumbnail,
        category,
        state ?? null,
        tags ? JSON.stringify(tags) : null,
        relatedArticleId ?? null,
        relatedPolitician ?? null,
        id,
      ]
    );
    return Video.findById(id);
  },

  async submit(id) {
    const video = await Video.findById(id);
    const { status: aiStatus, notes: aiNotes } = runAiCheck(video);
    await pool.query(
      `UPDATE ${TABLE} SET status = 'PENDING', ai_status = ?, ai_notes = ?, submitted_at = NOW() WHERE id = ?`,
      [aiStatus, aiNotes, id]
    );
    return Video.findById(id);
  },

  async review(id, { reviewerId, action, notes, ...fields }) {
    if (action === "UPDATE") {
      const current = await Video.findById(id);
      await pool.query(
        `UPDATE ${TABLE} SET title = ?, description = ?, video_source = ?, video_url = ?, thumbnail = ?, category = ?, state = ?, tags = ?,
         related_article_id = ?, related_politician = ?, reviewer_id = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?`,
        [
          fields.title ?? current.title,
          fields.description ?? current.description,
          fields.videoSource ?? current.video_source,
          fields.videoUrl ?? current.video_url,
          fields.thumbnail ?? current.thumbnail,
          fields.category ?? current.category,
          fields.state ?? current.state,
          fields.tags ? JSON.stringify(fields.tags) : current.tags ? JSON.stringify(current.tags) : null,
          fields.relatedArticleId ?? current.related_article_id,
          fields.relatedPolitician ?? current.related_politician,
          reviewerId,
          notes ?? null,
          id,
        ]
      );
    } else {
      const status = action === "APPROVE" ? "APPROVED" : "REJECTED";
      const publishedAt = action === "APPROVE" ? new Date() : null;
      await pool.query(
        `UPDATE ${TABLE} SET status = ?, reviewer_id = ?, review_notes = ?, reviewed_at = NOW(), published_at = COALESCE(published_at, ?) WHERE id = ?`,
        [status, reviewerId, notes ?? null, publishedAt, id]
      );
    }
    return Video.findById(id);
  },

  async remove(id) {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  },

  async setCommentsEnabled(id, enabled) {
    await pool.query(`UPDATE ${TABLE} SET comments_enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
    return Video.findById(id);
  },
};

module.exports = Video;
