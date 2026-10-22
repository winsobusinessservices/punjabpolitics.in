// Real political parties — read-only public reference data the site
// curates, seeded via scripts/seedPoliticians.js.
const pool = require("../config/db");

const TABLE = "parties";
const COLUMNS =
  "id, site_id, slug, name, abbreviation, photo_url, founded_year, founded_place, founders, ideology, history, achievements, current_status, years_in_power, sort_order";

const Party = {
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

  async upsert({
    siteId = 1,
    slug,
    name,
    abbreviation,
    photoUrl,
    foundedYear,
    foundedPlace,
    founders,
    ideology,
    history,
    achievements,
    currentStatus,
    yearsInPower,
    sortOrder,
    replacePhoto = false,
  }) {
    await pool.query(
      `INSERT INTO ${TABLE}
        (site_id, slug, name, abbreviation, photo_url, founded_year, founded_place, founders, ideology, history, achievements, current_status, years_in_power, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         abbreviation = VALUES(abbreviation),
         photo_url = ${replacePhoto ? "VALUES(photo_url)" : "COALESCE(photo_url, VALUES(photo_url))"},
         founded_year = VALUES(founded_year),
         founded_place = VALUES(founded_place),
         founders = VALUES(founders),
         ideology = VALUES(ideology),
         history = VALUES(history),
         achievements = VALUES(achievements),
         current_status = VALUES(current_status),
         years_in_power = VALUES(years_in_power),
         sort_order = VALUES(sort_order)`,
      [
        siteId,
        slug,
        name,
        abbreviation,
        photoUrl ?? null,
        foundedYear ?? null,
        foundedPlace ?? null,
        founders ? JSON.stringify(founders) : null,
        ideology ?? null,
        history ?? null,
        achievements ?? null,
        currentStatus ?? null,
        yearsInPower ?? null,
        sortOrder ?? 0,
      ]
    );
  },
};

module.exports = Party;
