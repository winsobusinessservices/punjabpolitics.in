const pool = require("../config/db");

const TABLE = "states";
const COLUMNS = "id, site_id, slug, name, capital, image_url, current_cm_name, cm_image_url, opposition_leader_name, opposition_party, opposition_leader_image_url, kind, formed, history, achievements, sort_order";

const State = {
  async findAll({ siteId = 1 } = {}) {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`, [siteId]);
    return rows;
  },

  async findBySlug(slug, siteId = 1) {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE slug = ? AND site_id = ? AND deleted_at IS NULL`, [slug, siteId]);
    return rows[0];
  },

  async findById(id, siteId = 1) {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ? AND site_id = ? AND deleted_at IS NULL`, [id, siteId]);
    return rows[0];
  },

  async delete(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },

  async upsert({ siteId = 1, slug, name, capital, imageUrl, currentCmName, cmImageUrl, oppositionLeaderName, oppositionParty, oppositionLeaderImageUrl, kind, formed, history, achievements, sortOrder }) {
    await pool.query(
      `INSERT INTO ${TABLE} (site_id, slug, name, capital, image_url, current_cm_name, cm_image_url, opposition_leader_name, opposition_party, opposition_leader_image_url, kind, formed, history, achievements, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), capital = VALUES(capital), kind = VALUES(kind),
         image_url = VALUES(image_url), current_cm_name = VALUES(current_cm_name), cm_image_url = VALUES(cm_image_url),
         opposition_leader_name = VALUES(opposition_leader_name), opposition_party = VALUES(opposition_party),
         opposition_leader_image_url = VALUES(opposition_leader_image_url), formed = VALUES(formed),
         history = VALUES(history), achievements = VALUES(achievements), sort_order = VALUES(sort_order)`,
      [siteId, slug, name, capital, imageUrl ?? null, currentCmName ?? null, cmImageUrl ?? null, oppositionLeaderName ?? null, oppositionParty ?? null, oppositionLeaderImageUrl ?? null, kind, formed ?? null, history ?? null, achievements ?? null, sortOrder ?? 0]
    );
  },
};

module.exports = State;
