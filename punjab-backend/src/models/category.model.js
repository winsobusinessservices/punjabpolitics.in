const pool = require("../config/db");
const { slugify, uniqueSlug } = require("../utils/slugify");

const TABLE = "categories";
const RESERVED_ROOT_SLUGS = [
  "about", "ad-choices", "advertise-with-us", "advertize-with-us", "api", "author", "blogs", "careers",
  "category", "cm", "connect-as-a-sponsor", "contact", "cookie-policy", "district", "editorial-team", "elections",
  "ethics-code", "forgot-password", "former-prime-ministers", "investors", "key-political-figures", "politicians", "login",
  "loksabha", "more", "news", "parties", "policies", "political-calendar", "press-conferences",
  "privacy-policy", "rajyasabha", "rallies", "register", "reset-password", "search", "speeches", "state",
  "terms-of-service", "top-news", "trending", "vidhan-sabha", "vidhansabha", "videos",
];

const Category = {
  async findAll({ includeHidden = false, siteId = 1 } = {}) {
    const [rows] = await pool.query(
      `SELECT id, name, slug, is_visible, is_premium, content, created_by, created_at FROM ${TABLE}
       WHERE deleted_at IS NULL AND site_id = ? ${includeHidden ? "" : "AND is_visible = 1"} ORDER BY name ASC`, [siteId]
    );
    return rows;
  },

  // Names of the visible categories an admin made "subscribers only" (their stories are premium).
  async findPremiumNames(siteId = 1) {
    const [rows] = await pool.query(`SELECT name FROM ${TABLE} WHERE is_premium = 1 AND is_visible = 1 AND site_id = ? AND deleted_at IS NULL`, [siteId]);
    return rows.map((row) => row.name);
  },

  async findPremium(siteId = 1) {
    const [rows] = await pool.query(`SELECT id, name, slug, content FROM ${TABLE} WHERE is_premium = 1 AND is_visible = 1 AND site_id = ? AND deleted_at IS NULL ORDER BY name ASC`, [siteId]);
    return rows;
  },

  async findHiddenNames(siteId = 1) {
    const [rows] = await pool.query(`SELECT name FROM ${TABLE} WHERE is_visible = 0 AND site_id = ? AND deleted_at IS NULL`, [siteId]);
    return rows.map((row) => row.name);
  },

  async findById(id, siteId = null) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL${siteId ? " AND site_id = ?" : ""}`, siteId ? [id, siteId] : [id]);
    return rows[0];
  },

  async findByName(name, siteId = 1) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE LOWER(name) = LOWER(?) AND site_id = ? AND deleted_at IS NULL`, [name, siteId]);
    return rows[0];
  },

  async findReservedRoutes(siteId = 1) {
    const [[parties], [politicians], [states]] = await Promise.all([
      pool.query("SELECT slug, name, abbreviation FROM parties WHERE site_id = ? AND deleted_at IS NULL", [siteId]),
      pool.query("SELECT slug, name FROM politicians WHERE site_id = ? AND deleted_at IS NULL", [siteId]),
      pool.query("SELECT slug, name FROM states WHERE site_id = ? AND deleted_at IS NULL", [siteId]),
    ]);
    const routes = new Map(RESERVED_ROOT_SLUGS.map((slug) => [slug, {
      type: "existing website page", name: `/${slug}`, section: null,
    }]));
    const add = (values, owner) => values.filter(Boolean).forEach((value) => routes.set(slugify(value), owner));
    parties.forEach((item) => add([item.slug, item.name, item.abbreviation], {
      type: "political party", name: item.name, section: "Parties",
    }));
    politicians.forEach((item) => add([item.slug, item.name], {
      type: "political leader", name: item.name, section: "Politicians",
    }));
    states.forEach((item) => add([item.slug, item.name], {
      type: "state or union territory", name: item.name, section: "States & Assemblies",
    }));
    return routes;
  },

  async create({ name, content = null, isVisible = true, isPremium = false, createdBy, siteId = 1 }) {
    const slug = await uniqueSlug(name, async (candidate) => {
      const [rows] = await pool.query(`SELECT id FROM ${TABLE} WHERE slug = ? AND site_id = ?`, [candidate, siteId]);
      return Boolean(rows[0]);
    });
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (name, slug, content, is_visible, is_premium, created_by, site_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, slug, content, isVisible ? 1 : 0, isPremium ? 1 : 0, createdBy ?? null, siteId]
    );
    return Category.findById(result.insertId, siteId);
  },

  async remove(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },

  async setPremium(id, isPremium, siteId) {
    const [result] = await pool.query(`UPDATE ${TABLE} SET is_premium = ? WHERE id = ? AND site_id = ?`, [isPremium ? 1 : 0, id, siteId]);
    return result.affectedRows > 0 ? Category.findById(id, siteId) : null;
  },

  async setVisibility(id, isVisible, siteId) {
    const [result] = await pool.query(`UPDATE ${TABLE} SET is_visible = ? WHERE id = ? AND site_id = ?`, [isVisible ? 1 : 0, id, siteId]);
    return result.affectedRows > 0 ? Category.findById(id, siteId) : null;
  },

  async updateContent(id, content, siteId) {
    const [result] = await pool.query(`UPDATE ${TABLE} SET content = ? WHERE id = ? AND site_id = ?`, [content, id, siteId]);
    return result.affectedRows > 0 ? Category.findById(id, siteId) : null;
  },
};

module.exports = Category;
