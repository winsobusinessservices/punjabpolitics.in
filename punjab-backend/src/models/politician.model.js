// Real political figures shown on the homepage and their detail pages —
// key national figures, former PMs, and sitting Chief Ministers. Read-only
// public data (no author workflow — this is reference/editorial content
// the site itself curates and keeps current), seeded via
// scripts/seedPoliticians.js.
const pool = require("../config/db");

const TABLE = "politicians";
const COLUMNS =
  "id, site_id, slug, name, photo_url, born_year, died_year, birth_place, party, state, category, current_position, still_in_office, opposition_party, since_year, education, career_timeline, summary, bio, sort_order";

const Politician = {
  async findAll({ category, siteId = 1 } = {}) {
    const conditions = ["deleted_at IS NULL", "site_id = ?"];
    const params = [siteId];
    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM ${TABLE} ${where} ORDER BY sort_order ASC, id ASC`,
      params
    );
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
    photoUrl,
    bornYear,
    diedYear,
    birthPlace,
    party,
    state,
    category,
    currentPosition,
    stillInOffice,
    oppositionParty,
    sinceYear,
    education,
    careerTimeline,
    summary,
    bio,
    sortOrder,
    replacePhoto = false,
  }) {
    await pool.query(
      `INSERT INTO ${TABLE}
        (site_id, slug, name, photo_url, born_year, died_year, birth_place, party, state, category, current_position, still_in_office, opposition_party, since_year, education, career_timeline, summary, bio, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         photo_url = ${replacePhoto ? "VALUES(photo_url)" : "COALESCE(photo_url, VALUES(photo_url))"},
         born_year = VALUES(born_year),
         died_year = VALUES(died_year),
         birth_place = VALUES(birth_place),
         party = VALUES(party),
         state = VALUES(state),
         category = VALUES(category),
         current_position = VALUES(current_position),
         still_in_office = VALUES(still_in_office),
         opposition_party = VALUES(opposition_party),
         since_year = VALUES(since_year),
         education = VALUES(education),
         career_timeline = VALUES(career_timeline),
         summary = VALUES(summary),
         bio = VALUES(bio),
         sort_order = VALUES(sort_order)`,
      [
        siteId,
        slug,
        name,
        photoUrl ?? null,
        bornYear ?? null,
        diedYear ?? null,
        birthPlace ?? null,
        party ?? null,
        state ?? null,
        category,
        currentPosition ?? null,
        stillInOffice ?? null,
        oppositionParty ?? null,
        sinceYear ?? null,
        education ? JSON.stringify(education) : null,
        careerTimeline ? JSON.stringify(careerTimeline) : null,
        summary ?? null,
        bio ? JSON.stringify(bio) : null,
        sortOrder ?? 0,
      ]
    );
  },
};

module.exports = Politician;
