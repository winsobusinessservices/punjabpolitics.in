const pool = require("../config/db");

const TABLE = "districts";
const COLUMNS = "id, site_id, slug, name, state, headquarters, division, image_url, established, area, population, lok_sabha_constituencies, vidhan_sabha_constituencies, description, content, sort_order";

const District = {
  async findAll({ siteId = 1 } = {}) {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
      [siteId]
    );
    return rows;
  },

  async findBySlug(slug, siteId = 1) {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE slug = ? AND site_id = ? AND deleted_at IS NULL`,
      [slug, siteId]
    );
    return rows[0];
  },

  async findById(id, siteId = 1) {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ? AND site_id = ? AND deleted_at IS NULL`,
      [id, siteId]
    );
    return rows[0];
  },

  async upsert({ siteId = 1, slug, name, state, headquarters, division, imageUrl, established, area, population, lokSabhaConstituencies, vidhanSabhaConstituencies, description, content, sortOrder }) {
    await pool.query(
      `INSERT INTO ${TABLE}
        (site_id, slug, name, state, headquarters, division, image_url, established, area, population, lok_sabha_constituencies, vidhan_sabha_constituencies, description, content, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), state = VALUES(state),
         headquarters = VALUES(headquarters), division = VALUES(division), image_url = VALUES(image_url),
         established = VALUES(established), area = VALUES(area), population = VALUES(population),
         lok_sabha_constituencies = VALUES(lok_sabha_constituencies),
         vidhan_sabha_constituencies = VALUES(vidhan_sabha_constituencies),
         description = VALUES(description), content = VALUES(content), sort_order = VALUES(sort_order)`,
      [siteId, slug, name, state, headquarters, division, imageUrl, established, area, population, lokSabhaConstituencies, vidhanSabhaConstituencies, description, content, sortOrder ?? 0]
    );
  },
};

module.exports = District;
