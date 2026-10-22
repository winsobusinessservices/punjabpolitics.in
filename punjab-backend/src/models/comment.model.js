const pool = require("../config/db");

function mapComment(row) {
  if (!row) return row;
  return {
    id: row.id,
    siteId: row.site_id,
    authorId: row.author_id,
    author: row.author,
    postType: row.post_type,
    postId: row.post_id,
    postSlug: row.post_slug,
    postTitle: row.post_title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hiddenAt: row.hidden_at,
  };
}

const SELECT_COMMENT = `
  SELECT c.*, u.name AS author
  FROM comments c
  JOIN users u ON u.id = c.author_id
`;

const Comment = {
  async create({ siteId, authorId, postType, postId, postSlug, postTitle, content }) {
    const [result] = await pool.query(
      `INSERT INTO comments
        (site_id, author_id, post_type, post_id, post_slug, post_title, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'VISIBLE')`,
      [siteId, authorId, postType, String(postId), postSlug, postTitle, content]
    );
    return Comment.findById(result.insertId, siteId);
  },

  async findById(id, siteId = null) {
    const [rows] = await pool.query(`${SELECT_COMMENT} WHERE c.id = ? AND c.deleted_at IS NULL${siteId ? " AND c.site_id = ?" : ""}`, siteId ? [id, siteId] : [id]);
    return mapComment(rows[0]);
  },

  async findForPost(postSlug, viewer = null, siteId = 1) {
    const conditions = ["c.post_slug = ?", "c.site_id = ?", "c.deleted_at IS NULL"];
    const params = [postSlug, siteId];
    if (viewer?.role !== "ADMIN") {
      if (viewer?.userId) {
        conditions.push("(c.status = 'VISIBLE' OR c.author_id = ?)");
        params.push(viewer.userId);
      } else {
        conditions.push("c.status = 'VISIBLE'");
      }
    }
    const [rows] = await pool.query(
      `${SELECT_COMMENT} WHERE ${conditions.join(" AND ")} ORDER BY c.created_at DESC, c.id DESC`,
      params
    );
    return rows.map(mapComment);
  },

  async findAll(siteId = 1) {
    const [rows] = await pool.query(`${SELECT_COMMENT} WHERE c.site_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC, c.id DESC`, [siteId]);
    return rows.map(mapComment);
  },

  async setHidden(id, hidden, adminId, siteId) {
    await pool.query(
      `UPDATE comments
       SET status = ?, hidden_by = ?, hidden_at = ?
       WHERE id = ? AND site_id = ?`,
      [hidden ? "HIDDEN" : "VISIBLE", hidden ? adminId : null, hidden ? new Date() : null, id, siteId]
    );
    return Comment.findById(id, siteId);
  },

  async remove(id) {
    const [result] = await pool.query("DELETE FROM comments WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },

  async removeForPost(postType, postId) {
    await pool.query("DELETE FROM comments WHERE post_type = ? AND post_id = ?", [postType, String(postId)]);
  },
};

module.exports = Comment;
