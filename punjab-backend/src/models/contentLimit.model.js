const pool = require("../config/db");

const DEFAULT_LIMITS = Object.freeze({
  AUTHOR: Object.freeze({ ARTICLE: 5, BLOG: 5, VIDEO: 2 }),
  EDITOR: Object.freeze({ ARTICLE: 10, BLOG: 10, VIDEO: 5 }),
});

const ROLES = ["AUTHOR", "EDITOR"];
const CONTENT_TYPES = ["ARTICLE", "BLOG", "VIDEO"];
const TABLE_BY_TYPE = Object.freeze({
  ARTICLE: "articles",
  BLOG: "blogs",
  VIDEO: "videos",
});

function defaultsCopy() {
  return Object.fromEntries(
    ROLES.map((role) => [role, { ...DEFAULT_LIMITS[role] }])
  );
}

const ContentLimit = {
  async getAll(siteId = 1) {
    const limits = defaultsCopy();
    const [rows] = await pool.query(
      "SELECT role, content_type, daily_limit FROM content_daily_limits WHERE site_id = ?",
      [siteId]
    );
    for (const row of rows) {
      if (limits[row.role] && CONTENT_TYPES.includes(row.content_type)) {
        limits[row.role][row.content_type] = Number(row.daily_limit);
      }
    }
    return limits;
  },

  async get(role, contentType, siteId = 1) {
    const [rows] = await pool.query(
      `SELECT daily_limit FROM content_daily_limits
       WHERE site_id = ? AND role = ? AND content_type = ?`,
      [siteId, role, contentType]
    );
    return rows.length ? Number(rows[0].daily_limit) : DEFAULT_LIMITS[role]?.[contentType];
  },

  async getUsage(userId, contentType, siteId = 1) {
    const table = TABLE_BY_TYPE[contentType];
    if (!table) throw new Error(`Unsupported content type: ${contentType}`);
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ${table}
       WHERE author_id = ? AND site_id = ?
         AND created_at >= CURRENT_DATE
         AND created_at < CURRENT_DATE + INTERVAL 1 DAY`,
      [userId, siteId]
    );
    return Number(rows[0]?.total || 0);
  },

  async setAll(limits, updatedBy, siteId = 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const role of ROLES) {
        for (const contentType of CONTENT_TYPES) {
          await connection.query(
            `INSERT INTO content_daily_limits (site_id, role, content_type, daily_limit, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE daily_limit = VALUES(daily_limit), updated_by = VALUES(updated_by)`,
            [siteId, role, contentType, limits[role][contentType], updatedBy]
          );
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return ContentLimit.getAll(siteId);
  },
};

module.exports = { ContentLimit, DEFAULT_LIMITS, ROLES, CONTENT_TYPES };
