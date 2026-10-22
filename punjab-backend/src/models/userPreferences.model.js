const pool = require("../config/db");

const JSON_COLUMNS = ["topics", "regions", "parties", "content_types", "channels"];

function parseRow(row) {
  if (!row) return null;
  const copy = { ...row, notify_consent: Boolean(row.notify_consent) };
  for (const column of JSON_COLUMNS) {
    let value = copy[column];
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { value = []; }
    }
    copy[column] = Array.isArray(value) ? value : [];
  }
  return copy;
}

/*
 * A reader is identified by { userId, visitorId }:
 *   - signed in  -> userId (and the browser's visitorId)
 *   - anonymous  -> visitorId only (the anonymous id cookie of the browser)
 * One row per reader. If a visitor answers anonymously and signs in later, the
 * answers are claimed by the account instead of being asked again.
 */
const UserPreferences = {
  async findByIdentity({ userId, visitorId }) {
    if (userId) {
      const [own] = await pool.query("SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
      if (own[0]) return parseRow(own[0]);
      if (visitorId) {
        // Answers this browser gave before signing in now belong to the account.
        const [claim] = await pool.query("UPDATE user_preferences SET user_id = ? WHERE visitor_id = ? AND user_id IS NULL", [userId, visitorId]);
        if (claim.affectedRows) {
          const [claimed] = await pool.query("SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
          return parseRow(claimed[0]);
        }
      }
      return null;
    }
    if (!visitorId) return null;
    const [rows] = await pool.query("SELECT * FROM user_preferences WHERE visitor_id = ? AND user_id IS NULL", [visitorId]);
    return parseRow(rows[0]);
  },

  async save({ userId, visitorId }, siteId, data) {
    const existing = await UserPreferences.findByIdentity({ userId, visitorId });
    const values = [
      siteId,
      JSON.stringify(data.topics), JSON.stringify(data.regions), JSON.stringify(data.parties),
      JSON.stringify(data.contentTypes), JSON.stringify(data.channels),
      data.frequency, data.feedback || null, data.email || null, data.phone || null, data.ipHash || null,
      data.notifyConsent ? 1 : 0,
    ];
    const consentTime = data.notifyConsent ? "COALESCE(notify_consent_at, NOW())" : "NULL";

    if (existing) {
      await pool.query(
        `UPDATE user_preferences SET site_id = ?, topics = ?, regions = ?, parties = ?, content_types = ?, channels = ?,
           frequency = ?, feedback = ?, email = ?, phone = ?, ip_hash = ?, notify_consent = ?,
           notify_consent_at = ${consentTime}, completed_at = NOW()
         WHERE id = ?`,
        [...values, existing.id]
      );
    } else {
      // A browser's visitor id belongs to one row only (it may already belong to another account's answers).
      let rowVisitorId = visitorId || null;
      if (rowVisitorId) {
        const [taken] = await pool.query("SELECT 1 FROM user_preferences WHERE visitor_id = ?", [rowVisitorId]);
        if (taken.length) rowVisitorId = null;
      }
      await pool.query(
        `INSERT INTO user_preferences
           (user_id, visitor_id, site_id, topics, regions, parties, content_types, channels, frequency, feedback, email, phone, ip_hash, notify_consent, notify_consent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${data.notifyConsent ? "NOW()" : "NULL"})`,
        [userId || null, rowVisitorId, ...values]
      );
    }
    return UserPreferences.findByIdentity({ userId, visitorId });
  },

  // Counts of how many readers picked each option, for the admin summary.
  async summary(siteId) {
    const [rows] = await pool.query(
      "SELECT user_id, topics, regions, parties, content_types, channels, frequency, notify_consent FROM user_preferences WHERE site_id = ?",
      [siteId]
    );
    const parsed = rows.map(parseRow);
    const tally = (column) => {
      const counts = {};
      for (const row of parsed) for (const key of row[column]) counts[key] = (counts[key] || 0) + 1;
      return counts;
    };
    const frequencies = {};
    for (const row of rows) frequencies[row.frequency] = (frequencies[row.frequency] || 0) + 1;
    return {
      responses: rows.length,
      signedIn: rows.filter((row) => row.user_id).length,
      anonymous: rows.filter((row) => !row.user_id).length,
      allowNotifications: rows.filter((row) => row.notify_consent).length,
      topics: tally("topics"),
      regions: tally("regions"),
      parties: tally("parties"),
      contentTypes: tally("content_types"),
      channels: tally("channels"),
      frequencies,
    };
  },

  async listFeedback(siteId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(
      `SELECT p.user_id, COALESCE(u.name, 'Anonymous visitor') AS name, p.feedback, p.updated_at
       FROM user_preferences p LEFT JOIN users u ON u.id = p.user_id
       WHERE p.site_id = ? AND p.feedback IS NOT NULL AND p.feedback <> ''
       ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
      [siteId, Number(limit), Number(offset)]
    );
    return rows;
  },
};

module.exports = UserPreferences;
