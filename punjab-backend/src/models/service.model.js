const pool = require("../config/db");

const Service = {
  async findPublic(siteId) {
    const [rows] = await pool.query("SELECT * FROM services WHERE site_id = ? AND is_visible = 1 ORDER BY sort_order ASC, title ASC", [siteId]);
    return rows;
  },
  async findPublicBySlug(siteId, slug) {
    const [rows] = await pool.query("SELECT * FROM services WHERE site_id = ? AND slug = ? AND is_visible = 1 LIMIT 1", [siteId, slug]);
    return rows[0] || null;
  },
  async findForAdmin(siteId) {
    const [rows] = await pool.query("SELECT * FROM services WHERE site_id = ? ORDER BY sort_order ASC, title ASC", [siteId]);
    return rows;
  },
  async findById(id) {
    const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
    return rows[0] || null;
  },
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO services (site_id, title, slug, summary, content, icon, image_url, cta_label, cta_url, seo_title, seo_description, sort_order, is_visible, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.siteId, data.title, data.slug, data.summary, data.content, data.icon, data.imageUrl, data.ctaLabel, data.ctaUrl, data.seoTitle, data.seoDescription, data.sortOrder, data.isVisible ? 1 : 0, data.createdBy]
    );
    return Service.findById(result.insertId);
  },
  async update(id, data) {
    await pool.query(
      `UPDATE services SET title = ?, slug = ?, summary = ?, content = ?, icon = ?, image_url = ?, cta_label = ?, cta_url = ?, seo_title = ?, seo_description = ?, sort_order = ?, is_visible = ? WHERE id = ?`,
      [data.title, data.slug, data.summary, data.content, data.icon, data.imageUrl, data.ctaLabel, data.ctaUrl, data.seoTitle, data.seoDescription, data.sortOrder, data.isVisible ? 1 : 0, id]
    );
    return Service.findById(id);
  },
  async remove(id) {
    const [result] = await pool.query("DELETE FROM services WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Service;
