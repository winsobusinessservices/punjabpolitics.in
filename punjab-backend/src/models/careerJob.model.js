// Job postings the site itself is hiring for (e.g. "Political Correspondent")
// — created by an admin, browsed by any member, applied to by USER/EDITOR/
// AUTHOR accounts. Distinct from role_applications.model.js (self-signup to
// become an Author/Editor/Investor on the platform) and from the "career"
// news category in article.model.js (political-news articles, unrelated).
const pool = require("../config/db");
const { uniqueSlug } = require("../utils/slugify");

const TABLE = "career_jobs";
const COLUMNS =
  "id, site_id, slug, title, department, location, employment_type, description, requirements, responsibilities, status, posted_by, closes_at, created_at";

const CareerJob = {
  async create({ siteId, title, department, location, employmentType, description, requirements, responsibilities, postedBy, closesAt }) {
    const slug = await uniqueSlug(title, async (candidate) => Boolean(await CareerJob.findBySlug(candidate, siteId)));
    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (site_id, slug, title, department, location, employment_type, description, requirements, responsibilities, posted_by, closes_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [siteId, slug, title, department ?? null, location ?? null, employmentType, description, requirements ?? null, responsibilities ?? null, postedBy, closesAt ?? null]
    );
    return CareerJob.findById(result.insertId, siteId);
  },

  async findById(id, siteId) {
    const [rows] = await pool.query(
      `SELECT j.*, u.name AS posted_by_name FROM ${TABLE} j JOIN users u ON u.id = j.posted_by WHERE j.id = ? AND j.site_id = ? AND j.deleted_at IS NULL`,
      [id, siteId]
    );
    return rows[0];
  },

  async findBySlug(slug, siteId) {
    const [rows] = await pool.query(
      `SELECT j.*, u.name AS posted_by_name FROM ${TABLE} j JOIN users u ON u.id = j.posted_by WHERE j.slug = ? AND j.site_id = ? AND j.deleted_at IS NULL`,
      [slug, siteId]
    );
    return rows[0];
  },

  // Public listing — defaults to OPEN only (what members should browse);
  // admins managing postings pass no filter to see everything, including
  // closed ones.
  async findAll({ status, siteId } = {}) {
    const conditions = ["deleted_at IS NULL", "site_id = ?"];
    const params = [siteId];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM ${TABLE} ${where} ORDER BY created_at DESC`, params);
    return rows;
  },

  async setStatus(id, status, siteId) {
    await pool.query(`UPDATE ${TABLE} SET status = ? WHERE id = ? AND site_id = ?`, [status, id, siteId]);
    return CareerJob.findById(id, siteId);
  },

  async update(id, siteId, { title, department, location, employmentType, description, requirements, responsibilities, closesAt }) {
    await pool.query(
      `UPDATE ${TABLE}
       SET title = ?, department = ?, location = ?, employment_type = ?, description = ?, requirements = ?, responsibilities = ?, closes_at = ?
       WHERE id = ? AND site_id = ?`,
      [title, department ?? null, location ?? null, employmentType, description, requirements ?? null, responsibilities ?? null, closesAt ?? null, id, siteId]
    );
    return CareerJob.findById(id, siteId);
  },

  async remove(id) {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  },
};

module.exports = CareerJob;
