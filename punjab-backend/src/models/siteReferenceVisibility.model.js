const pool = require("../config/db");

const TYPES = new Set(["PARTY", "POLITICIAN", "STATE", "DISTRICT"]);

const SiteReferenceVisibility = {
  normalizeType(type) {
    const normalized = String(type || "").trim().toUpperCase();
    return TYPES.has(normalized) ? normalized : null;
  },

  async hiddenIds(siteId, type) {
    const normalized = SiteReferenceVisibility.normalizeType(type);
    if (!normalized) return new Set();
    const [rows] = await pool.query(
      "SELECT reference_id FROM site_reference_visibility WHERE site_id = ? AND reference_type = ? AND is_visible = 0",
      [siteId, normalized]
    );
    return new Set(rows.map((row) => Number(row.reference_id)));
  },

  async filter(siteId, type, rows) {
    const hidden = await SiteReferenceVisibility.hiddenIds(siteId, type);
    return rows.filter((row) => !hidden.has(Number(row.id)));
  },

  async isVisible(siteId, type, referenceId) {
    const hidden = await SiteReferenceVisibility.hiddenIds(siteId, type);
    return !hidden.has(Number(referenceId));
  },

  async set(siteId, type, referenceId, isVisible, updatedBy) {
    const normalized = SiteReferenceVisibility.normalizeType(type);
    if (!normalized) return false;
    await pool.query(
      `INSERT INTO site_reference_visibility (site_id, reference_type, reference_id, is_visible, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible), updated_by = VALUES(updated_by)`,
      [siteId, normalized, referenceId, isVisible ? 1 : 0, updatedBy || null]
    );
    return true;
  },
};

module.exports = SiteReferenceVisibility;
