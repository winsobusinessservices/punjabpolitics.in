const pool = require("../config/db");

const Site = {
  async findAll({ includeInactive = false } = {}) {
    const [rows] = await pool.query(
      `SELECT id, name, subtitle, description, slug, domain, logo_url, icon_url, primary_color, secondary_color, social_links, status, services_enabled, created_at, updated_at
       FROM sites ${includeInactive ? "" : "WHERE status = 'ACTIVE'"} ORDER BY id ASC`
    );
    return rows;
  },
  async findById(id) {
    const [rows] = await pool.query("SELECT * FROM sites WHERE id = ?", [id]);
    return rows[0] || null;
  },
  async findBySlug(slug) {
    const [rows] = await pool.query("SELECT * FROM sites WHERE slug = ? AND status = 'ACTIVE'", [slug]);
    return rows[0] || null;
  },
  async findByDomain(domain) {
    const normalized = String(domain || "").toLowerCase().replace(/^www\./, "").split(":")[0];
    const [rows] = await pool.query("SELECT * FROM sites WHERE LOWER(domain) = ? AND status = 'ACTIVE'", [normalized]);
    return rows[0] || null;
  },
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO sites (name, subtitle, description, slug, domain, logo_url, icon_url, primary_color, secondary_color, social_links, status, services_enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.subtitle || null, data.description || null, data.slug, data.domain, data.logoUrl || null, data.iconUrl || null, data.primaryColor || null, data.secondaryColor || null, JSON.stringify(data.socialLinks || []), data.status || "ACTIVE", data.servicesEnabled ? 1 : 0, data.createdBy || null]
    );
    const siteId = result.insertId;
    await pool.query(
      `INSERT IGNORE INTO site_ui_sections (site_id, section_key, label, is_visible, updated_by)
       SELECT ?, section_key, label, is_visible, ? FROM ui_sections`,
      [siteId, data.createdBy || null]
    );
    await pool.query(
      `INSERT IGNORE INTO home_widgets (site_id, widget_key, data)
       SELECT ?, widget_key, data FROM home_widgets WHERE site_id = 1`,
      [siteId]
    );
    await pool.query(
      `INSERT IGNORE INTO content_daily_limits (site_id, role, content_type, daily_limit, updated_by)
       SELECT ?, role, content_type, daily_limit, ? FROM content_daily_limits WHERE site_id = 1`,
      [siteId, data.createdBy || null]
    );
    for (const tableName of ["politicians", "parties", "states", "districts"]) {
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME NOT IN ('id', 'site_id') AND EXTRA NOT LIKE '%auto_increment%'
         ORDER BY ORDINAL_POSITION`,
        [tableName]
      );
      const columnsSql = columns.map((column) => `\`${column.COLUMN_NAME}\``).join(", ");
      const sourceSql = columns.map((column) => `source.\`${column.COLUMN_NAME}\``).join(", ");
      await pool.query(
        `INSERT IGNORE INTO \`${tableName}\` (site_id, ${columnsSql})
         SELECT ?, ${sourceSql} FROM \`${tableName}\` source WHERE source.site_id = 1`,
        [siteId]
      );
    }
    return Site.findById(siteId);
  },
  async update(id, data) {
    await pool.query(
      `UPDATE sites SET name = ?, subtitle = ?, description = ?, slug = ?, domain = ?, logo_url = ?, icon_url = ?, primary_color = ?, secondary_color = ?, social_links = ?, status = ?, services_enabled = ? WHERE id = ?`,
      [data.name, data.subtitle || null, data.description || null, data.slug, data.domain, data.logoUrl || null, data.iconUrl || null, data.primaryColor || null, data.secondaryColor || null, JSON.stringify(data.socialLinks || []), data.status || "ACTIVE", data.servicesEnabled ? 1 : 0, id]
    );
    return Site.findById(id);
  },
};

module.exports = Site;
