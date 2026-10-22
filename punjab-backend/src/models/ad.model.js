const pool = require("../config/db");

const PLACEMENTS = Object.freeze(["home_banner", "sidebar_left", "sidebar_right", "article_inline"]);

// Active, within its optional schedule window.
const LIVE = "is_active = 1 AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())";

const Ad = {
  async findLive(siteId, placement) {
    const [rows] = await pool.query(
      `SELECT id, advertiser, title, placement, image_url, link_url, alt_text, logo_url, display_url, headline, description, cta_label FROM ads
       WHERE site_id = ? AND placement = ? AND ${LIVE} ORDER BY sort_order ASC, id DESC`,
      [siteId, placement]
    );
    return rows;
  },
  async findForAdmin(siteId) {
    const [rows] = await pool.query("SELECT * FROM ads WHERE site_id = ? ORDER BY created_at DESC", [siteId]);
    return rows;
  },
  async findById(id) {
    const [rows] = await pool.query("SELECT * FROM ads WHERE id = ?", [id]);
    return rows[0] || null;
  },
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO ads (site_id, advertiser, title, placement, image_url, link_url, alt_text, logo_url, display_url, headline, description, cta_label, starts_at, ends_at, sort_order, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.siteId, data.advertiser, data.title, data.placement, data.imageUrl, data.linkUrl, data.altText, data.logoUrl, data.displayUrl, data.headline, data.description, data.ctaLabel, data.startsAt, data.endsAt, data.sortOrder, data.isActive ? 1 : 0, data.createdBy]
    );
    return Ad.findById(result.insertId);
  },
  async update(id, data) {
    await pool.query(
      `UPDATE ads SET advertiser = ?, title = ?, placement = ?, image_url = ?, link_url = ?, alt_text = ?, logo_url = ?, display_url = ?, headline = ?, description = ?, cta_label = ?, starts_at = ?, ends_at = ?, sort_order = ?, is_active = ? WHERE id = ?`,
      [data.advertiser, data.title, data.placement, data.imageUrl, data.linkUrl, data.altText, data.logoUrl, data.displayUrl, data.headline, data.description, data.ctaLabel, data.startsAt, data.endsAt, data.sortOrder, data.isActive ? 1 : 0, id]
    );
    return Ad.findById(id);
  },
  async remove(id) {
    const [result] = await pool.query("DELETE FROM ads WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
  async recordImpressions(ids) {
    if (ids.length) await pool.query("UPDATE ads SET impressions = impressions + 1 WHERE id IN (?)", [ids]);
  },
  async recordClick(id) {
    await pool.query("UPDATE ads SET clicks = clicks + 1 WHERE id = ?", [id]);
  },
};

module.exports = Ad;
module.exports.PLACEMENTS = PLACEMENTS;
