const pool = require("../config/db");
const { getWithdrawalWindow } = require("../utils/withdrawalWindow");

const EMPTY_SUMMARY = Object.freeze({
  availablePoints: 0,
  availableValueInr: 0,
  pendingWithdrawalPoints: 0,
  pendingWithdrawalValueInr: 0,
  lifetimeEarnedPoints: 0,
  lifetimeEarnedValueInr: 0,
  lifetimeWithdrawnPoints: 0,
  lifetimeWithdrawnValueInr: 0,
});

function parseMetadata(value) {
  if (!value || typeof value !== "string") return value || null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Row -> API shape shared by the contributor wallet and the admin withdrawal queue.
function mapWithdrawal(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    userRole: row.user_role,
    points: Number(row.points),
    rupeesPerPoint: Number(row.rupees_per_point ?? row.current_rupees_per_point),
    amountInr: row.amount_inr == null
      ? Number((Number(row.points) * Number(row.current_rupees_per_point)).toFixed(2))
      : Number(row.amount_inr),
    status: row.status,
    withdrawalMonth: row.withdrawal_month,
    upiId: row.upi_id,
    utrNumber: row.utr_number,
    adminNotes: row.admin_notes,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
  };
}

// Locks a withdrawal that is still awaiting an admin decision (and belongs to the website).
// PROCESSING is included so requests created before manual payouts can still be settled.
async function lockOpenWithdrawal(connection, withdrawalId, siteId) {
  const [rows] = await connection.query(
    `SELECT w.* FROM wallet_withdrawals w JOIN users u ON u.id = w.user_id
     WHERE w.id = ? AND u.site_id = ? FOR UPDATE`,
    [withdrawalId, siteId]
  );
  if (!rows.length) {
    const error = new Error("Withdrawal request not found");
    error.code = "WITHDRAWAL_NOT_FOUND";
    throw error;
  }
  if (!["PENDING", "PROCESSING"].includes(rows[0].status)) {
    const error = new Error("This withdrawal has already been settled");
    error.code = "WITHDRAWAL_ALREADY_SETTLED";
    throw error;
  }
  return rows[0];
}

const Wallet = {
  async awardBonus({ userId, points, reason, contentType, contentId, contentTitle, contentSlug, relationship, awardedBy }) {
    if (!Number.isInteger(points) || points <= 0) throw new Error("Bonus points must be a positive integer");

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("INSERT IGNORE INTO wallets (user_id) VALUES (?)", [userId]);
      const [walletRows] = await connection.query(
        "SELECT available_points FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );
      const [awardResult] = await connection.query(
        `INSERT INTO wallet_bonus_awards
          (user_id, points, reason, content_type, content_id, content_title, content_slug,
           recipient_relationship, awarded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, points, reason, contentType, contentId, contentTitle, contentSlug || null, relationship, awardedBy]
      );
      const awardId = Number(awardResult.insertId);
      const balanceAfter = Number(walletRows[0].available_points) + points;
      await connection.query(
        `UPDATE wallets
         SET available_points = ?, lifetime_earned_points = lifetime_earned_points + ?
         WHERE user_id = ?`,
        [balanceAfter, points, userId]
      );
      const description = `Bonus for ${contentTitle}`.slice(0, 255);
      const [transactionResult] = await connection.query(
        `INSERT INTO wallet_transactions
          (user_id, direction, category, points, balance_after, status, description,
           reference_type, reference_id, metadata)
         VALUES (?, 'CREDIT', 'CONTENT_BONUS', ?, ?, 'COMPLETED', ?, 'BONUS_AWARD', ?, ?)`,
        [
          userId,
          points,
          balanceAfter,
          description,
          awardId,
          JSON.stringify({
            reason,
            contentType,
            contentId,
            contentTitle,
            contentSlug: contentSlug || null,
            relationship,
            awardedBy,
          }),
        ]
      );
      await connection.query(
        "UPDATE wallet_bonus_awards SET wallet_transaction_id = ? WHERE id = ?",
        [transactionResult.insertId, awardId]
      );
      await connection.commit();
      return { awardId, transactionId: Number(transactionResult.insertId), balanceAfter };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async acknowledgeBonus({ bonusId, userId }) {
    const [result] = await pool.query(
      `UPDATE wallet_bonus_awards
       SET acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND user_id = ?`,
      [bonusId, userId]
    );
    return result.affectedRows > 0;
  },

  async credit({ userId, points, category, description, referenceType, referenceId, metadata = null, createdAt = null }) {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error("Wallet credit points must be a positive integer");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("INSERT IGNORE INTO wallets (user_id) VALUES (?)", [userId]);

      // Lock this user's balance before checking the content reference. This
      // serializes simultaneous credits and keeps balance_after trustworthy.
      const [walletRows] = await connection.query(
        `SELECT available_points, lifetime_earned_points
         FROM wallets WHERE user_id = ? FOR UPDATE`,
        [userId]
      );
      const [existingRows] = await connection.query(
        `SELECT id FROM wallet_transactions
         WHERE user_id = ? AND category = ?
           AND reference_type <=> ? AND reference_id <=> ?
         LIMIT 1`,
        [userId, category, referenceType ?? null, referenceId ?? null]
      );

      if (existingRows.length) {
        await connection.commit();
        return { credited: false, transactionId: Number(existingRows[0].id) };
      }

      const balanceAfter = Number(walletRows[0].available_points) + points;
      await connection.query(
        `UPDATE wallets
         SET available_points = ?, lifetime_earned_points = lifetime_earned_points + ?
         WHERE user_id = ?`,
        [balanceAfter, points, userId]
      );
      const [result] = await connection.query(
        `INSERT INTO wallet_transactions
          (user_id, direction, category, points, balance_after, status, description,
           reference_type, reference_id, metadata, created_at)
         VALUES (?, 'CREDIT', ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          userId,
          category,
          points,
          balanceAfter,
          String(description).slice(0, 255),
          referenceType ?? null,
          referenceId ?? null,
          metadata == null ? null : JSON.stringify(metadata),
          createdAt,
        ]
      );

      await connection.commit();
      return { credited: true, transactionId: Number(result.insertId), balanceAfter };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async requestWithdrawal({ userId, points, upiId }) {
    const settings = await this.getWithdrawalSettings();
    const window = getWithdrawalWindow();
    if (!Number.isInteger(points) || points <= 0) {
      const error = new Error("Withdrawal points must be a positive whole number");
      error.code = "INVALID_WITHDRAWAL_POINTS";
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [accessRows] = await connection.query(
        "SELECT is_enabled FROM wallet_withdrawal_access WHERE user_id = ? FOR UPDATE",
        [userId]
      );
      if (!accessRows[0]?.is_enabled) {
        const error = new Error("Withdrawal access is blocked. Ask an administrator to enable it");
        error.code = "WITHDRAWAL_ACCESS_BLOCKED";
        throw error;
      }

      await connection.query("INSERT IGNORE INTO wallets (user_id) VALUES (?)", [userId]);
      const [walletRows] = await connection.query(
        "SELECT available_points FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );
      const availablePoints = Number(walletRows[0].available_points);
      if (points > availablePoints) {
        const error = new Error("Withdrawal amount cannot exceed the available wallet balance");
        error.code = "INSUFFICIENT_WALLET_BALANCE";
        throw error;
      }

      const [rateRows] = await connection.query(
        `SELECT u.role, COALESCE(r.rupees_per_point, 1.0000) AS rupees_per_point
         FROM users u
         LEFT JOIN wallet_point_rates r ON BINARY r.role = BINARY u.role
         WHERE u.id = ? AND u.deleted_at IS NULL AND u.role IN ('AUTHOR', 'EDITOR')`,
        [userId]
      );
      if (!rateRows.length) {
        const error = new Error("Point conversion rate is unavailable for this account");
        error.code = "POINT_RATE_UNAVAILABLE";
        throw error;
      }
      const rupeesPerPoint = Number(rateRows[0].rupees_per_point);
      const minimumRemainingInr = rateRows[0].role === "EDITOR"
        ? settings.editorMinimumRemainingInr
        : settings.authorMinimumRemainingInr;
      const amountInr = Number((points * rupeesPerPoint).toFixed(2));
      const availableValueInr = Number((availablePoints * rupeesPerPoint).toFixed(2));
      if (availableValueInr < settings.minimumWithdrawalInr) {
        const error = new Error(`Wallet balance must be at least ₹${settings.minimumWithdrawalInr.toLocaleString("en-IN")} to withdraw`);
        error.code = "INSUFFICIENT_WALLET_BALANCE";
        throw error;
      }
      const remainingValueInr = Number((availableValueInr - amountInr).toFixed(2));
      if (remainingValueInr < minimumRemainingInr) {
        const error = new Error(`You must leave at least ₹${minimumRemainingInr.toLocaleString("en-IN")} in your wallet after withdrawal`);
        error.code = "INVALID_WITHDRAWAL_POINTS";
        throw error;
      }

      const [existingRows] = await connection.query(
        "SELECT id FROM wallet_withdrawals WHERE user_id = ? AND withdrawal_month = ? LIMIT 1",
        [userId, window.withdrawalMonth]
      );
      if (existingRows.length) {
        const error = new Error("Only one withdrawal request is allowed per month");
        error.code = "MONTHLY_WITHDRAWAL_EXISTS";
        error.nextWithdrawalDate = window.nextWithdrawalDate;
        throw error;
      }

      const [withdrawalResult] = await connection.query(
        `INSERT INTO wallet_withdrawals
          (user_id, points, rupees_per_point, amount_inr, withdrawal_month, upi_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, points, rupeesPerPoint, amountInr, window.withdrawalMonth, upiId]
      );
      const withdrawalId = Number(withdrawalResult.insertId);
      const balanceAfter = availablePoints - points;
      await connection.query(
        `UPDATE wallets
         SET available_points = ?, pending_withdrawal_points = pending_withdrawal_points + ?
         WHERE user_id = ?`,
        [balanceAfter, points, userId]
      );
      await connection.query(
        `INSERT INTO wallet_transactions
          (user_id, direction, category, points, balance_after, status, description, reference_type, reference_id)
         VALUES (?, 'DEBIT', 'WITHDRAWAL_REQUEST', ?, ?, 'PENDING', 'Points reserved for withdrawal', 'WITHDRAWAL', ?)`,
        [userId, points, balanceAfter, withdrawalId]
      );

      await connection.commit();
      return { id: withdrawalId, points, rupeesPerPoint, amountInr, upiId, status: "PENDING", requestedAt: new Date() };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getWithdrawalById(withdrawalId) {
    const [rows] = await pool.query(
      `SELECT w.id, w.user_id, w.points, w.rupees_per_point, w.amount_inr, w.status, w.withdrawal_month,
              w.upi_id, w.utr_number, w.admin_notes, w.requested_at, w.processed_at,
              u.name AS user_name, u.email AS user_email, u.role AS user_role,
              COALESCE(r.rupees_per_point, 1.0000) AS current_rupees_per_point
       FROM wallet_withdrawals w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN wallet_point_rates r ON BINARY r.role = BINARY u.role
       WHERE w.id = ?`,
      [withdrawalId]
    );
    return rows.length ? mapWithdrawal(rows[0]) : null;
  },

  // Every withdrawal request on a website, pending first, for the admin queue.
  async listWithdrawalsForAdmin(siteId = 1, status = null) {
    const params = [siteId];
    let statusClause = "";
    if (status) {
      statusClause = "AND w.status = ?";
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT w.id, w.user_id, w.points, w.rupees_per_point, w.amount_inr, w.status, w.withdrawal_month,
              w.upi_id, w.utr_number, w.admin_notes, w.requested_at, w.processed_at,
              u.name AS user_name, u.email AS user_email, u.role AS user_role,
              COALESCE(r.rupees_per_point, 1.0000) AS current_rupees_per_point
       FROM wallet_withdrawals w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN wallet_point_rates r ON BINARY r.role = BINARY u.role
       WHERE u.site_id = ? ${statusClause}
       ORDER BY (w.status IN ('PENDING', 'PROCESSING')) DESC, w.requested_at DESC, w.id DESC
       LIMIT 300`,
      params
    );
    return rows.map(mapWithdrawal);
  },

  // Admin confirms the money was sent manually. The UTR is the bank's reference for the UPI transfer.
  async markWithdrawalPaid({ withdrawalId, siteId, utrNumber, reviewedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const withdrawal = await lockOpenWithdrawal(connection, withdrawalId, siteId);
      await connection.query(
        `UPDATE wallets
         SET pending_withdrawal_points = GREATEST(0, pending_withdrawal_points - ?),
             lifetime_withdrawn_points = lifetime_withdrawn_points + ?
         WHERE user_id = ?`,
        [withdrawal.points, withdrawal.points, withdrawal.user_id]
      );
      await connection.query(
        `UPDATE wallet_transactions SET status = 'COMPLETED', description = ?
         WHERE user_id = ? AND category = 'WITHDRAWAL_REQUEST' AND reference_type = 'WITHDRAWAL' AND reference_id = ?`,
        [`Withdrawal paid to UPI (UTR ${utrNumber})`, withdrawal.user_id, withdrawal.id]
      );
      await connection.query(
        `UPDATE wallet_withdrawals
         SET status = 'PAID', utr_number = ?, reviewed_by = ?, admin_notes = NULL, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [utrNumber, reviewedBy, withdrawal.id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getWithdrawalById(withdrawalId);
  },

  // Admin declines the request: the reserved points go back to the contributor and the month is freed.
  async rejectWithdrawal({ withdrawalId, siteId, reason, reviewedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const withdrawal = await lockOpenWithdrawal(connection, withdrawalId, siteId);
      const [walletRows] = await connection.query(
        "SELECT available_points FROM wallets WHERE user_id = ? FOR UPDATE",
        [withdrawal.user_id]
      );
      const balanceAfter = Number(walletRows[0]?.available_points || 0) + Number(withdrawal.points);
      await connection.query(
        `UPDATE wallets SET available_points = ?,
             pending_withdrawal_points = GREATEST(0, pending_withdrawal_points - ?)
         WHERE user_id = ?`,
        [balanceAfter, withdrawal.points, withdrawal.user_id]
      );
      await connection.query(
        `UPDATE wallet_transactions SET status = 'REVERSED', description = 'Withdrawal rejected by administrator'
         WHERE user_id = ? AND category = 'WITHDRAWAL_REQUEST' AND reference_type = 'WITHDRAWAL' AND reference_id = ?`,
        [withdrawal.user_id, withdrawal.id]
      );
      await connection.query(
        `INSERT IGNORE INTO wallet_transactions
          (user_id, direction, category, points, balance_after, status, description, reference_type, reference_id)
         VALUES (?, 'CREDIT', 'WITHDRAWAL_REFUND', ?, ?, 'COMPLETED', 'Points restored after rejected withdrawal', 'WITHDRAWAL', ?)`,
        [withdrawal.user_id, withdrawal.points, balanceAfter, withdrawal.id]
      );
      await connection.query(
        `UPDATE wallet_withdrawals
         SET status = 'REJECTED', withdrawal_month = NULL, reviewed_by = ?, admin_notes = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reviewedBy, reason, withdrawal.id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getWithdrawalById(withdrawalId);
  },

  async setWithdrawalAccess({ userId, enabled, updatedBy }) {
    const [users] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL AND role IN ('AUTHOR', 'EDITOR')",
      [userId]
    );
    if (!users.length) return null;

    await pool.query(
      `INSERT INTO wallet_withdrawal_access (user_id, is_enabled, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)`,
      [userId, enabled ? 1 : 0, updatedBy]
    );
    return { userId: Number(userId), enabled: Boolean(enabled) };
  },

  async getWithdrawalSettings() {
    const [rows] = await pool.query(
      `SELECT minimum_withdrawal_inr, author_minimum_remaining_inr, editor_minimum_remaining_inr
       FROM wallet_withdrawal_settings WHERE id = 1`
    );
    return {
      minimumWithdrawalInr: Number(rows[0]?.minimum_withdrawal_inr ?? 1000),
      authorMinimumRemainingInr: Number(rows[0]?.author_minimum_remaining_inr ?? 200),
      editorMinimumRemainingInr: Number(rows[0]?.editor_minimum_remaining_inr ?? 500),
    };
  },

  async setWithdrawalSettings({ minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr, updatedBy }) {
    await pool.query(
      `INSERT INTO wallet_withdrawal_settings
        (id, minimum_withdrawal_inr, author_minimum_remaining_inr, editor_minimum_remaining_inr, updated_by)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         minimum_withdrawal_inr = VALUES(minimum_withdrawal_inr),
         author_minimum_remaining_inr = VALUES(author_minimum_remaining_inr),
         editor_minimum_remaining_inr = VALUES(editor_minimum_remaining_inr),
         updated_by = VALUES(updated_by)`,
      [minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr, updatedBy]
    );
    return { minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr };
  },

  async getPointRates() {
    const [rows] = await pool.query(
      `SELECT role, rupees_per_point, updated_by, updated_at
       FROM wallet_point_rates
       WHERE role IN ('AUTHOR', 'EDITOR')
       ORDER BY FIELD(role, 'AUTHOR', 'EDITOR')`
    );
    const byRole = Object.fromEntries(rows.map((row) => [row.role, {
      role: row.role,
      rupeesPerPoint: Number(row.rupees_per_point),
      updatedBy: row.updated_by == null ? null : Number(row.updated_by),
      updatedAt: row.updated_at,
    }]));
    return {
      AUTHOR: byRole.AUTHOR || { role: "AUTHOR", rupeesPerPoint: 1, updatedBy: null, updatedAt: null },
      EDITOR: byRole.EDITOR || { role: "EDITOR", rupeesPerPoint: 1, updatedBy: null, updatedAt: null },
    };
  },

  async setPointRates({ authorRate, editorRate, updatedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [role, rate] of [["AUTHOR", authorRate], ["EDITOR", editorRate]]) {
        await connection.query(
          `INSERT INTO wallet_point_rates (role, rupees_per_point, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             rupees_per_point = VALUES(rupees_per_point),
             updated_by = VALUES(updated_by)`,
          [role, rate, updatedBy]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getPointRates();
  },

  async getRewardPoints(role = null) {
    const [rows] = await pool.query(
      `SELECT role, content_type, points, updated_by, updated_at
       FROM wallet_reward_settings
       WHERE role IN ('AUTHOR', 'EDITOR')
         AND content_type IN ('ARTICLE', 'BLOG', 'VIDEO')`
    );
    const rewards = {
      AUTHOR: { ARTICLE: 10, BLOG: 10, VIDEO: 5 },
      EDITOR: { ARTICLE: 10, BLOG: 10, VIDEO: 5 },
    };
    for (const row of rows) rewards[row.role][row.content_type] = Number(row.points);
    return role && rewards[role] ? rewards[role] : rewards;
  },

  async setRewardPoints({ rewardPoints, updatedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const role of ["AUTHOR", "EDITOR"]) {
        for (const contentType of ["ARTICLE", "BLOG", "VIDEO"]) {
          await connection.query(
            `INSERT INTO wallet_reward_settings (role, content_type, points, updated_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE points = VALUES(points), updated_by = VALUES(updated_by)`,
            [role, contentType, rewardPoints[role][contentType], updatedBy]
          );
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getRewardPoints();
  },

  async getEditorReviewRewardPoints() {
    const [rows] = await pool.query(
      `SELECT content_type, points, updated_by, updated_at
       FROM editor_review_reward_settings
       WHERE content_type IN ('ARTICLE', 'BLOG', 'VIDEO')`
    );
    const rewards = { ARTICLE: 1, BLOG: 1, VIDEO: 1 };
    for (const row of rows) rewards[row.content_type] = Number(row.points);
    return rewards;
  },

  async setEditorReviewRewardPoints({ rewardPoints, updatedBy }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const contentType of ["ARTICLE", "BLOG", "VIDEO"]) {
        await connection.query(
          `INSERT INTO editor_review_reward_settings (content_type, points, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE points = VALUES(points), updated_by = VALUES(updated_by)`,
          [contentType, rewardPoints[contentType], updatedBy]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getEditorReviewRewardPoints();
  },

  async listForAdmin(siteId = 1) {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role,
              COALESCE(w.available_points, 0) AS available_points,
              COALESCE(w.pending_withdrawal_points, 0) AS pending_withdrawal_points,
              COALESCE(w.lifetime_earned_points, 0) AS lifetime_earned_points,
              COALESCE(r.rupees_per_point, 1.0000) AS rupees_per_point,
              COALESCE(a.is_enabled, 0) AS withdrawal_enabled,
              a.updated_at AS access_updated_at
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN wallet_point_rates r ON BINARY r.role = BINARY u.role
       LEFT JOIN wallet_withdrawal_access a ON a.user_id = u.id
       WHERE u.deleted_at IS NULL AND u.site_id = ? AND u.role IN ('AUTHOR', 'EDITOR')
       ORDER BY u.name, u.id`
      , [siteId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      email: row.email,
      role: row.role,
      availablePoints: Number(row.available_points),
      pendingWithdrawalPoints: Number(row.pending_withdrawal_points),
      lifetimeEarnedPoints: Number(row.lifetime_earned_points),
      rupeesPerPoint: Number(row.rupees_per_point),
      availableValueInr: Number((Number(row.available_points) * Number(row.rupees_per_point)).toFixed(2)),
      withdrawalEnabled: Boolean(row.withdrawal_enabled),
      accessUpdatedAt: row.access_updated_at,
    }));
  },

  async getForUser(userId) {
    const [[walletRows], [transactionRows], [accessRows], [withdrawalRows], [rateRows], [bonusRows], [bonusSummaryRows]] = await Promise.all([
      pool.query(
        `SELECT available_points, pending_withdrawal_points,
                lifetime_earned_points, lifetime_withdrawn_points, updated_at
         FROM wallets
         WHERE user_id = ?`,
        [userId]
      ),
      pool.query(
        `SELECT id, direction, category, points, balance_after, status,
                description, reference_type, reference_id, metadata, created_at
         FROM wallet_transactions
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [userId]
      ),
      pool.query(
        "SELECT is_enabled, updated_at FROM wallet_withdrawal_access WHERE user_id = ?",
        [userId]
      ),
      pool.query(
        `SELECT id, points, rupees_per_point, amount_inr, status,
                DATE_FORMAT(withdrawal_month, '%Y-%m-%d') AS withdrawal_month,
                upi_id, utr_number, requested_at, processed_at, admin_notes
         FROM wallet_withdrawals WHERE user_id = ?
         ORDER BY requested_at DESC, id DESC LIMIT 24`,
        [userId]
      ),
      pool.query(
        `SELECT u.role, COALESCE(r.rupees_per_point, 1.0000) AS rupees_per_point
         FROM users u
         LEFT JOIN wallet_point_rates r ON BINARY r.role = BINARY u.role
         WHERE u.id = ?`,
        [userId]
      ),
      pool.query(
        `SELECT id, points, reason, content_type, content_id, content_title, content_slug,
                recipient_relationship, awarded_by, wallet_transaction_id, acknowledged_at, created_at
         FROM wallet_bonus_awards
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [userId]
      ),
      pool.query(
        "SELECT COALESCE(SUM(points), 0) AS total_bonus_points FROM wallet_bonus_awards WHERE user_id = ?",
        [userId]
      ),
    ]);

    const wallet = walletRows[0];
    const summary = wallet
      ? {
          availablePoints: Number(wallet.available_points),
          pendingWithdrawalPoints: Number(wallet.pending_withdrawal_points),
          lifetimeEarnedPoints: Number(wallet.lifetime_earned_points),
          lifetimeWithdrawnPoints: Number(wallet.lifetime_withdrawn_points),
          updatedAt: wallet.updated_at,
        }
      : { ...EMPTY_SUMMARY, updatedAt: null };

    const transactions = transactionRows.map((row) => ({
      id: Number(row.id),
      direction: row.direction,
      category: row.category,
      points: Number(row.points),
      balanceAfter: Number(row.balance_after),
      status: row.status,
      description: row.description,
      referenceType: row.reference_type,
      referenceId: row.reference_id == null ? null : Number(row.reference_id),
      metadata: parseMetadata(row.metadata),
      createdAt: row.created_at,
    }));

    const withdrawalAccess = {
      enabled: Boolean(accessRows[0]?.is_enabled),
      updatedAt: accessRows[0]?.updated_at || null,
    };
    const currentRate = Number(rateRows[0]?.rupees_per_point || 1);
    const withdrawals = withdrawalRows.map((row) => ({
      id: Number(row.id),
      points: Number(row.points),
      // Older requests predate conversion snapshots. For those only, show
      // the current role rate rather than a misleading zero-value payout.
      rupeesPerPoint: row.rupees_per_point == null ? currentRate : Number(row.rupees_per_point),
      amountInr: row.amount_inr == null
        ? Number((Number(row.points) * currentRate).toFixed(2))
        : Number(row.amount_inr),
      status: row.status,
      withdrawalMonth: row.withdrawal_month,
      requestedAt: row.requested_at,
      processedAt: row.processed_at,
      adminNotes: row.admin_notes,
      upiId: row.upi_id,
      utrNumber: row.utr_number,
    }));

    const pointRate = {
      role: rateRows[0]?.role || null,
      rupeesPerPoint: currentRate,
    };
    summary.availableValueInr = Number((summary.availablePoints * pointRate.rupeesPerPoint).toFixed(2));
    summary.pendingWithdrawalValueInr = Number((summary.pendingWithdrawalPoints * pointRate.rupeesPerPoint).toFixed(2));
    summary.lifetimeEarnedValueInr = Number((summary.lifetimeEarnedPoints * pointRate.rupeesPerPoint).toFixed(2));
    summary.lifetimeWithdrawnValueInr = Number((summary.lifetimeWithdrawnPoints * pointRate.rupeesPerPoint).toFixed(2));

    summary.lifetimeBonusPoints = Number(bonusSummaryRows[0]?.total_bonus_points || 0);
    summary.lifetimeBonusValueInr = Number((summary.lifetimeBonusPoints * pointRate.rupeesPerPoint).toFixed(2));
    const bonuses = bonusRows.map((row) => ({
      id: Number(row.id),
      points: Number(row.points),
      reason: row.reason,
      contentType: row.content_type,
      contentId: Number(row.content_id),
      contentTitle: row.content_title,
      contentSlug: row.content_slug,
      relationship: row.recipient_relationship,
      awardedBy: Number(row.awarded_by),
      walletTransactionId: row.wallet_transaction_id == null ? null : Number(row.wallet_transaction_id),
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
    }));

    return { summary, transactions, bonuses, withdrawalAccess, withdrawals, pointRate };
  },
};

module.exports = Wallet;
