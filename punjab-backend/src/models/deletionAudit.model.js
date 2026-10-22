const pool = require("../config/db");

const ENTITY_CONFIG = Object.freeze({
  USER: { table: "users", label: "name", owner: "id" },
  ARTICLE: { table: "articles", label: "title", owner: "author_id", postType: "ARTICLE" },
  BLOG: { table: "blogs", label: "title", owner: "author_id", postType: "BLOG" },
  VIDEO: { table: "videos", label: "title", owner: "author_id", postType: "VIDEO" },
  COMMENT: { table: "comments", label: "content", owner: "author_id" },
  CATEGORY: { table: "categories", label: "name", owner: "created_by" },
  POLICY: { table: "policies", label: "title", owner: "created_by" },
  CAREER_JOB: { table: "career_jobs", label: "title", owner: "posted_by" },
  ROLE_APPLICATION: { table: "role_applications", label: "name", owner: "user_id" },
  POLITICIAN: { table: "politicians", label: "name", owner: null },
  PARTY: { table: "parties", label: "name", owner: null },
  STATE: { table: "states", label: "name", owner: null },
  DISTRICT: { table: "districts", label: "name", owner: null },
});

function configFor(entityType) {
  const config = ENTITY_CONFIG[entityType];
  if (!config) throw new Error("Unsupported deletion type");
  return config;
}

async function actorSnapshot(connection, userId) {
  const [rows] = await connection.query(
    "SELECT id, name, email, role, site_id FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || { id: userId, name: `User #${userId}`, email: null, role: "UNKNOWN" };
}

const DeletionAudit = {
  ENTITY_CONFIG,

  async softDelete({ entityType, entityId, deletedBy, reason = null }) {
    const config = configFor(entityType);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT * FROM \`${config.table}\` WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
        [entityId]
      );
      const entity = rows[0];
      if (!entity) {
        await connection.rollback();
        return null;
      }
      const actor = await actorSnapshot(connection, deletedBy);
      const ownerId = config.owner ? entity[config.owner] : null;
      let ownerName = null;
      if (ownerId) {
        const [owners] = await connection.query("SELECT name FROM users WHERE id = ? LIMIT 1", [ownerId]);
        ownerName = owners[0]?.name || null;
      }
      const normalizedReason = String(reason || "").trim().slice(0, 500) || null;
      const siteId = Number(entity.site_id || actor.site_id || 1);
      const softDeleteSql = entityType === "USER"
        ? `UPDATE \`${config.table}\` SET deleted_at = NOW(), deleted_by = ?, delete_reason = ?, status = 'INACTIVE' WHERE id = ?`
        : `UPDATE \`${config.table}\` SET deleted_at = NOW(), deleted_by = ?, delete_reason = ? WHERE id = ?`;
      await connection.query(softDeleteSql, [deletedBy, normalizedReason, entityId]);
      const [result] = await connection.query(
        `INSERT INTO deletion_audit
          (site_id, entity_type, entity_table, entity_id, entity_label, owner_id, owner_name,
           deleted_by, deleted_by_name, deleted_by_email, deleted_by_role, reason, snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          siteId,
          entityType,
          config.table,
          String(entityId),
          String(entity[config.label] || `${entityType} #${entityId}`).slice(0, 500),
          ownerId || null,
          ownerName,
          deletedBy,
          actor.name,
          actor.email,
          actor.role,
          normalizedReason,
          JSON.stringify(entity),
        ]
      );
      await connection.commit();
      return { auditId: result.insertId, entity };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async list({ state = "ACTIVE", siteId = 1 } = {}) {
    const conditions = ["a.site_id = ?"];
    if (state === "ACTIVE") conditions.push("a.restored_at IS NULL AND a.permanently_deleted_at IS NULL");
    if (state === "RESTORED") conditions.push("a.restored_at IS NOT NULL");
    if (state === "PERMANENT") conditions.push("a.permanently_deleted_at IS NOT NULL");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT a.*, restorer.name AS restored_by_name, permanent.name AS permanently_deleted_by_name
       FROM deletion_audit a
       LEFT JOIN users restorer ON restorer.id = a.restored_by
       LEFT JOIN users permanent ON permanent.id = a.permanently_deleted_by
       ${where}
       ORDER BY a.deleted_at DESC, a.id DESC`, [siteId]
    );
    return rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      deletedBy: row.deleted_by,
      deletedByName: row.deleted_by_name,
      deletedByEmail: row.deleted_by_email,
      deletedByRole: row.deleted_by_role,
      reason: row.reason,
      deletedAt: row.deleted_at,
      restoredByName: row.restored_by_name,
      restoredAt: row.restored_at,
      permanentlyDeletedByName: row.permanently_deleted_by_name,
      permanentlyDeletedAt: row.permanently_deleted_at,
    }));
  },

  async restore(auditId, restoredBy, siteId = 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT * FROM deletion_audit
         WHERE id = ? AND site_id = ? AND restored_at IS NULL AND permanently_deleted_at IS NULL FOR UPDATE`,
        [auditId, siteId]
      );
      const audit = rows[0];
      if (!audit) {
        await connection.rollback();
        return false;
      }
      const config = configFor(audit.entity_type);
      let snapshot = audit.snapshot;
      if (typeof snapshot === "string") {
        try { snapshot = JSON.parse(snapshot); } catch { snapshot = {}; }
      }
      const restoreSql = audit.entity_type === "USER"
        ? `UPDATE \`${config.table}\` SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, status = ? WHERE id = ? AND deleted_at IS NOT NULL`
        : `UPDATE \`${config.table}\` SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL WHERE id = ? AND deleted_at IS NOT NULL`;
      const restoreParams = audit.entity_type === "USER"
        ? [snapshot?.status || "ACTIVE", audit.entity_id]
        : [audit.entity_id];
      const [result] = await connection.query(restoreSql, restoreParams);
      if (!result.affectedRows) {
        await connection.rollback();
        return false;
      }
      await connection.query(
        "UPDATE deletion_audit SET restored_by = ?, restored_at = NOW() WHERE id = ?",
        [restoredBy, auditId]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async hardDelete(auditId, deletedBy, siteId = 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT * FROM deletion_audit
         WHERE id = ? AND site_id = ? AND restored_at IS NULL AND permanently_deleted_at IS NULL FOR UPDATE`,
        [auditId, siteId]
      );
      const audit = rows[0];
      if (!audit) {
        await connection.rollback();
        return false;
      }
      const config = configFor(audit.entity_type);
      if (config.postType) {
        await connection.query(
          "DELETE FROM comments WHERE post_type = ? AND post_id = ?",
          [config.postType, String(audit.entity_id)]
        );
      }
      await connection.query(`DELETE FROM \`${config.table}\` WHERE id = ?`, [audit.entity_id]);
      await connection.query(
        "UPDATE deletion_audit SET permanently_deleted_by = ?, permanently_deleted_at = NOW() WHERE id = ?",
        [deletedBy, auditId]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = DeletionAudit;
