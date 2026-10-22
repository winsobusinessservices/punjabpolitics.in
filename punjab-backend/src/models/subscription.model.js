const pool = require("../config/db");

/*
 * Premium subscriptions. One row per purchase (one month each). A reader is Premium while they have a PAID row
 * whose ends_at is still in the future. Buying again before it ends adds the new month after the current one.
 */
const Subscription = {
  async create({ publicId, siteId, userId, name, email, phone, planId, planName, amountPaise, days, provider, orderId }) {
    const [result] = await pool.query(
      `INSERT INTO premium_subscriptions (public_id, site_id, user_id, name, email, phone, plan_id, plan_name, amount_paise, days, provider, provider_order_id, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [publicId, siteId, userId, name, email, phone || null, planId || null, planName || null, amountPaise, days, provider, orderId]
    );
    return result.insertId;
  },

  async findByPublicId(publicId) {
    const [rows] = await pool.query("SELECT * FROM premium_subscriptions WHERE public_id = ?", [publicId]);
    return rows[0] || null;
  },

  async findByOrderId(provider, orderId) {
    if (!orderId) return null;
    const [rows] = await pool.query("SELECT * FROM premium_subscriptions WHERE provider = ? AND provider_order_id = ?", [provider, orderId]);
    return rows[0] || null;
  },

  async findByPaymentId(provider, paymentId) {
    if (!paymentId) return null;
    const [rows] = await pool.query("SELECT * FROM premium_subscriptions WHERE provider = ? AND provider_payment_id = ?", [provider, paymentId]);
    return rows[0] || null;
  },

  /**
   * Marks a purchase as paid, exactly once, and starts its month: right now, or right after the month the
   * reader already has. Returns false when it was already paid (a repeat confirmation or webhook).
   */
  async markPaid(id, userId, paymentId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[row]] = await connection.query("SELECT id, status FROM premium_subscriptions WHERE id = ? FOR UPDATE", [id]);
      // Only an open purchase can become PAID. A repeat confirmation, or a late webhook after a refund, does nothing.
      if (!row || !["CREATED", "FAILED", "EXPIRED"].includes(row.status)) {
        await connection.rollback();
        return false;
      }
      const [[current]] = await connection.query(
        "SELECT MAX(ends_at) AS ends_at FROM premium_subscriptions WHERE user_id = ? AND status = 'PAID' AND ends_at > NOW()",
        [userId]
      );
      const startsAt = current?.ends_at || null;
      await connection.query(
        `UPDATE premium_subscriptions
            SET status = 'PAID', provider_payment_id = ?, paid_at = NOW(),
                starts_at = COALESCE(?, NOW()),
                ends_at = DATE_ADD(COALESCE(?, NOW()), INTERVAL days DAY),
                receipt_number = CONCAT('BP-PRE-', YEAR(NOW()), '-', LPAD(id, 6, '0'))
          WHERE id = ?`,
        [paymentId, startsAt, startsAt, id]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  },

  async markFailed(id) {
    await pool.query("UPDATE premium_subscriptions SET status = 'FAILED' WHERE id = ? AND status = 'CREATED'", [id]);
  },

  // A refund ends the month it paid for straight away.
  async markRefunded(id) {
    await pool.query("UPDATE premium_subscriptions SET status = 'REFUNDED', ends_at = LEAST(COALESCE(ends_at, NOW()), NOW()) WHERE id = ? AND status = 'PAID'", [id]);
  },

  // Attempts nobody finished stop counting as pending.
  async expireStale() {
    await pool.query("UPDATE premium_subscriptions SET status = 'EXPIRED' WHERE status = 'CREATED' AND created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)");
  },

  /** Premium right now? Returns { active, endsAt }. */
  async statusForUser(userId) {
    if (!userId) return { active: false, endsAt: null };
    const [rows] = await pool.query(
      "SELECT MAX(ends_at) AS ends_at FROM premium_subscriptions WHERE user_id = ? AND status = 'PAID' AND ends_at > NOW()",
      [userId]
    );
    const endsAt = rows[0]?.ends_at || null;
    return { active: Boolean(endsAt), endsAt };
  },

  async listForUser(userId) {
    const [rows] = await pool.query(
      "SELECT public_id, status, amount_paise, days, starts_at, ends_at, paid_at, receipt_number, created_at FROM premium_subscriptions WHERE user_id = ? AND status IN ('PAID','REFUNDED') ORDER BY paid_at DESC, id DESC LIMIT 20",
      [userId]
    );
    return rows;
  },

  async adminList(siteId, { status, q, limit = 50, offset = 0 } = {}) {
    const where = ["site_id = ?"];
    const params = [siteId];
    if (status) { where.push("status = ?"); params.push(status); }
    if (q) { where.push("(name LIKE ? OR email LIKE ? OR receipt_number LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const [rows] = await pool.query(
      `SELECT public_id, name, email, phone, plan_name, amount_paise, days, status, provider, provider_payment_id, receipt_number, paid_at, starts_at, ends_at, created_at
         FROM premium_subscriptions WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  },

  async getPlansRow(siteId) {
    const [rows] = await pool.query(
      "SELECT p.plans, p.updated_at, u.name AS updated_by_name FROM subscription_plans p LEFT JOIN users u ON u.id = p.updated_by WHERE p.site_id = ?",
      [siteId]
    );
    if (!rows[0]) return null;
    const plans = typeof rows[0].plans === "string" ? JSON.parse(rows[0].plans) : rows[0].plans;
    return { plans, updatedAt: rows[0].updated_at, updatedByName: rows[0].updated_by_name || null };
  },

  async savePlans(siteId, plans, userId) {
    await pool.query(
      `INSERT INTO subscription_plans (site_id, plans, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE plans = VALUES(plans), updated_by = VALUES(updated_by)`,
      [siteId, JSON.stringify(plans), userId || null]
    );
  },

  async adminSummary(siteId) {
    const [[row]] = await pool.query(
      `SELECT COUNT(DISTINCT CASE WHEN status = 'PAID' AND ends_at > NOW() THEN user_id END) AS active_members,
              COALESCE(SUM(status = 'PAID'), 0) AS paid_total,
              COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_paise END), 0) AS paid_paise,
              COALESCE(SUM(status = 'CREATED' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)), 0) AS pending
         FROM premium_subscriptions WHERE site_id = ?`,
      [siteId]
    );
    return {
      activeMembers: Number(row.active_members || 0),
      paidTotal: Number(row.paid_total || 0),
      paidPaise: Number(row.paid_paise || 0),
      pending: Number(row.pending || 0),
    };
  },
};

module.exports = Subscription;
