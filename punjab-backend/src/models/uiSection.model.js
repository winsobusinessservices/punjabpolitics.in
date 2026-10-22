const pool = require("../config/db");

const UiSection = {
  async findAll(siteId = 1) {
    const [rows] = await pool.query(
      "SELECT section_key, label, is_visible, updated_at FROM site_ui_sections WHERE site_id = ? ORDER BY label ASC", [siteId]
    );
    return rows;
  },

  async visibilityMap(siteId = 1) {
    const rows = await UiSection.findAll(siteId);
    return Object.fromEntries(rows.map((row) => [row.section_key, Boolean(row.is_visible)]));
  },

  // Keeps the Site Management visibility list in step with renamed homepage headings.
  async setLabel(sectionKey, label, siteId = 1) {
    await pool.query("UPDATE site_ui_sections SET label = ? WHERE section_key = ? AND site_id = ?", [String(label).slice(0, 180), sectionKey, siteId]);
  },

  async setVisibility(sectionKey, isVisible, updatedBy, siteId = 1) {
    const [result] = await pool.query(
      "UPDATE site_ui_sections SET is_visible = ?, updated_by = ? WHERE section_key = ? AND site_id = ?",
      [isVisible ? 1 : 0, updatedBy, sectionKey, siteId]
    );
    if (!result.affectedRows) return null;
    const [rows] = await pool.query(
      "SELECT section_key, label, is_visible, updated_at FROM site_ui_sections WHERE section_key = ? AND site_id = ?",
      [sectionKey, siteId]
    );
    return rows[0];
  },
};

module.exports = UiSection;
