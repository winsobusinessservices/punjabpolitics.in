const pool = require("../config/db");

/*
 * Support (donations). One row per payment:
 *   ONE_TIME   one row.
 *   MONTHLY    the first row holds the gateway subscription; each later monthly charge adds a row with the same
 *              provider_subscription_id (parent_id = the first row). Stopping the subscription stamps
 *              subscription_ended_at on all of them.
 * A row turns PAID exactly once (a repeat confirmation or webhook does nothing).
 */
const Donation = {
  async create({ publicId, siteId, userId, name, email, phone, message, showOnWall, kind, amountPaise, provider, orderId, subscriptionId }) {
    const [result] = await pool.query(
      `INSERT INTO donations (public_id, site_id, user_id, name, email, phone, message, show_on_wall, kind, amount_paise, provider, provider_order_id, provider_subscription_id, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [publicId, siteId, userId || null, name, email, phone || null, message || null, showOnWall ? 1 : 0, kind, amountPaise, provider, orderId || null, subscriptionId || null]
    );
    return result.insertId;
  },

  async findByPublicId(publicId) {
    const [rows] = await pool.query("SELECT * FROM donations WHERE public_id = ?", [publicId]);
    return rows[0] || null;
  },

  async findByOrderId(provider, orderId) {
    if (!orderId) return null;
    const [rows] = await pool.query("SELECT * FROM donations WHERE provider = ? AND provider_order_id = ?", [provider, orderId]);
    return rows[0] || null;
  },

  async findByPaymentId(provider, paymentId) {
    if (!paymentId) return null;
    const [rows] = await pool.query("SELECT * FROM donations WHERE provider = ? AND provider_payment_id = ?", [provider, paymentId]);
    return rows[0] || null;
  },

  // The first row of a monthly contribution (it owns the gateway subscription).
  async findSubscriptionRoot(provider, subscriptionId) {
    if (!subscriptionId) return null;
    const [rows] = await pool.query("SELECT * FROM donations WHERE provider = ? AND provider_subscription_id = ? AND parent_id IS NULL ORDER BY id ASC LIMIT 1", [provider, subscriptionId]);
    return rows[0] || null;
  },

  /** Marks an open row as paid, once. Returns false when it was not open (already paid, refunded, ...). */
  async markPaid(id, paymentId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[row]] = await connection.query("SELECT id, status FROM donations WHERE id = ? FOR UPDATE", [id]);
      if (!row || !["CREATED", "FAILED", "EXPIRED"].includes(row.status)) {
        await connection.rollback();
        return false;
      }
      await connection.query(
        `UPDATE donations
            SET status = 'PAID', provider_payment_id = ?, paid_at = NOW(),
                receipt_number = CONCAT('BP-DON-', YEAR(NOW()), '-', LPAD(id, 6, '0'))
          WHERE id = ?`,
        [paymentId, id]
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

  /** A later monthly charge: a new PAID row copied from the first one. Returns its id, or null when this payment is already recorded. */
  async addMonthlyCharge(root, paymentId, amountPaise) {
    try {
      const [result] = await pool.query(
        `INSERT INTO donations (public_id, site_id, user_id, name, email, phone, message, show_on_wall, kind, amount_paise, status, provider,
                                provider_subscription_id, provider_payment_id, parent_id, consent_at, paid_at, subscription_ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MONTHLY', ?, 'PAID', ?, ?, ?, ?, ?, NOW(), ?)`,
        [require("crypto").randomUUID(), root.site_id, root.user_id, root.name, root.email, root.phone, root.message, root.show_on_wall, amountPaise || root.amount_paise, root.provider,
          root.provider_subscription_id, paymentId, root.id, root.consent_at, root.subscription_ended_at]
      );
      await pool.query("UPDATE donations SET receipt_number = CONCAT('BP-DON-', YEAR(NOW()), '-', LPAD(id, 6, '0')) WHERE id = ?", [result.insertId]);
      return result.insertId;
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return null; // the same payment arrived twice
      throw error;
    }
  },

  async findById(id) {
    const [rows] = await pool.query("SELECT * FROM donations WHERE id = ?", [id]);
    return rows[0] || null;
  },

  async markFailed(id) {
    await pool.query("UPDATE donations SET status = 'FAILED' WHERE id = ? AND status = 'CREATED'", [id]);
  },

  async markRefunded(id) {
    await pool.query("UPDATE donations SET status = 'REFUNDED', refunded_at = NOW() WHERE id = ? AND status = 'PAID'", [id]);
  },

  // The gateway stopped charging (the donor stopped it, or the card kept failing).
  async endSubscription(provider, subscriptionId) {
    await pool.query("UPDATE donations SET subscription_ended_at = COALESCE(subscription_ended_at, NOW()) WHERE provider = ? AND provider_subscription_id = ?", [provider, subscriptionId]);
    // A first payment that never happened cannot become paid any more.
    await pool.query("UPDATE donations SET status = 'CANCELLED' WHERE provider = ? AND provider_subscription_id = ? AND status = 'CREATED'", [provider, subscriptionId]);
  },

  // Attempts nobody finished stop counting as pending.
  async expireStale() {
    await pool.query("UPDATE donations SET status = 'EXPIRED' WHERE status = 'CREATED' AND created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)");
  },

  // A signed-in person's own contributions (paid ones), newest first.
  async listForUser(userId) {
    const [rows] = await pool.query(
      `SELECT public_id, kind, amount_paise, status, paid_at, receipt_number, subscription_ended_at, provider_subscription_id, parent_id
         FROM donations WHERE user_id = ? AND status IN ('PAID', 'REFUNDED') ORDER BY paid_at DESC, id DESC LIMIT 50`,
      [userId]
    );
    return rows;
  },

  // Supporters who chose to appear on the wall: first name only, never amounts or emails.
  async wall(siteId, limit = 60) {
    const [rows] = await pool.query(
      `SELECT SUBSTRING_INDEX(TRIM(name), ' ', 1) AS first_name, MAX(paid_at) AS last_paid_at
         FROM donations WHERE site_id = ? AND status = 'PAID' AND show_on_wall = 1
        GROUP BY email, SUBSTRING_INDEX(TRIM(name), ' ', 1) ORDER BY last_paid_at DESC LIMIT ?`,
      [siteId, limit]
    );
    return rows.map((row) => row.first_name).filter(Boolean);
  },

  _filters(siteId, { status, kind, q }) {
    const where = ["site_id = ?"];
    const params = [siteId];
    if (status) { where.push("status = ?"); params.push(status); }
    if (kind) { where.push("kind = ?"); params.push(kind); }
    if (q) {
      where.push("(name LIKE ? OR email LIKE ? OR receipt_number LIKE ? OR provider_payment_id LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    return { where: where.join(" AND "), params };
  },

  async adminList(siteId, filters = {}, { limit = 50, offset = 0 } = {}) {
    const { where, params } = Donation._filters(siteId, filters);
    const [rows] = await pool.query(
      `SELECT id, public_id, receipt_number, created_at, paid_at, refunded_at, name AS donor_name, email AS donor_email, phone AS donor_phone,
              amount_paise, kind, status, message, provider, provider_payment_id, provider_subscription_id, subscription_ended_at, show_on_wall
         FROM donations WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  },

  async adminSummary(siteId) {
    const [[row]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_paise END), 0) AS raised_paise,
              COALESCE(SUM(status = 'PAID'), 0) AS paid_count,
              COALESCE(SUM(CASE WHEN status = 'PAID' AND paid_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount_paise END), 0) AS this_month_paise,
              COUNT(DISTINCT CASE WHEN status = 'PAID' THEN email END) AS supporters,
              COUNT(DISTINCT CASE WHEN status = 'PAID' AND kind = 'MONTHLY' AND subscription_ended_at IS NULL THEN email END) AS active_monthly,
              COALESCE(SUM(status = 'REFUNDED'), 0) AS refunded_count,
              COALESCE(SUM(status = 'CREATED' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)), 0) AS pending_count
         FROM donations WHERE site_id = ?`,
      [siteId]
    );
    return {
      raisedPaise: Number(row.raised_paise || 0),
      paidCount: Number(row.paid_count || 0),
      thisMonthPaise: Number(row.this_month_paise || 0),
      supporters: Number(row.supporters || 0),
      activeMonthlySupporters: Number(row.active_monthly || 0),
      refundedCount: Number(row.refunded_count || 0),
      pendingCount: Number(row.pending_count || 0),
    };
  },
};

module.exports = Donation;
