const pool = require("../config/db");
const { normalizePermissions } = require("../config/permissions");

const ROLES = ["USER", "ADMIN", "SUBADMIN", "EDITOR", "AUTHOR", "INVESTOR"];

const PUBLIC_COLUMNS =
  "id, name, email, phone, profile_picture, role, permissions, status, panel_status, site_id, (SELECT s.name FROM sites s WHERE s.id = users.site_id) AS site_name, (SELECT s.slug FROM sites s WHERE s.id = users.site_id) AS site_slug, (SELECT s.domain FROM sites s WHERE s.id = users.site_id) AS site_domain, created_at, terms_accepted, terms_accepted_at, accepted_policy_ids, pan_document, aadhar_document, graduation_certificate, created_by";

function parseUser(row) {
  if (!row) return null;
  let acceptedPolicyIds = row.accepted_policy_ids;
  if (typeof acceptedPolicyIds === "string") {
    try { acceptedPolicyIds = JSON.parse(acceptedPolicyIds); } catch { acceptedPolicyIds = []; }
  }
  return {
    ...row,
    permissions: normalizePermissions(row.permissions, row.role),
    accepted_policy_ids: Array.isArray(acceptedPolicyIds) ? acceptedPolicyIds : [],
  };
}

const PANEL_ROLES = ["ADMIN", "SUBADMIN", "EDITOR", "AUTHOR", "INVESTOR"];

// A user whose panel access is switched off keeps a normal website account: for every
// request they are treated as a plain USER with no privileges.
function sessionIdentity(user) {
  if (user && user.panel_status === "INACTIVE" && PANEL_ROLES.includes(user.role)) {
    return { role: "USER", permissions: [], panelAccess: false };
  }
  return { role: user.role, permissions: user.permissions, panelAccess: PANEL_ROLES.includes(user.role) };
}

const User = {
  ROLES,
  PANEL_ROLES,
  sessionIdentity,

  async updateProfile(id, { name, phone }) {
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push("name = ?"); params.push(name); }
    if (phone !== undefined) { sets.push("phone = ?"); params.push(phone); }
    if (sets.length) await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`, [...params, id]);
    return User.findById(id);
  },

  async setProfilePicture(id, picturePath) {
    await pool.query("UPDATE users SET profile_picture = ? WHERE id = ? AND deleted_at IS NULL", [picturePath, id]);
    return User.findById(id);
  },

  async setStatuses(id, { status, panelStatus } = {}) {
    const sets = [];
    const params = [];
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }
    if (panelStatus !== undefined) { sets.push("panel_status = ?"); params.push(panelStatus); }
    if (!sets.length) return User.findById(id);
    await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`, [...params, id]);
    return User.findById(id);
  },

  async findByEmail(email) {
    const [rows] = await pool.query("SELECT users.*, s.name AS site_name, s.slug AS site_slug, s.domain AS site_domain FROM users LEFT JOIN sites s ON s.id = users.site_id WHERE users.email = ?", [email]);
    return parseUser(rows[0]);
  },

  async findByGoogleSub(googleSub) {
    const [rows] = await pool.query("SELECT users.*, s.name AS site_name, s.slug AS site_slug, s.domain AS site_domain FROM users LEFT JOIN sites s ON s.id = users.site_id WHERE users.google_sub = ?", [googleSub]);
    return parseUser(rows[0]);
  },

  async linkGoogleAccount(id, googleSub) {
    await pool.query("UPDATE users SET google_sub = ? WHERE id = ?", [googleSub, id]);
    return User.findById(id);
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return parseUser(rows[0]);
  },

  async findByIdWithPassword(id) {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
    return parseUser(rows[0]);
  },

  async updatePassword(id, passwordHash) {
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      id,
    ]);
  },

  async requirePrivacyConsentForSite(siteId) {
    await pool.query(
      "UPDATE users SET terms_accepted = 0 WHERE site_id = ? AND deleted_at IS NULL AND terms_accepted = 1",
      [siteId]
    );
  },

  async recordPrivacyConsent(id, acceptedPolicyIds, accepted) {
    await pool.query(
      "UPDATE users SET terms_accepted = ?, terms_accepted_at = ?, accepted_policy_ids = ? WHERE id = ? AND deleted_at IS NULL",
      [accepted ? 1 : 0, accepted ? new Date() : null, accepted ? JSON.stringify(acceptedPolicyIds) : null, id]
    );
    return User.findById(id);
  },

  async findAll({ siteId } = {}) {
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE deleted_at IS NULL${siteId ? " AND site_id = ?" : ""} ORDER BY created_at DESC`,
      siteId ? [siteId] : []
    );
    return rows.map(parseUser);
  },

  async getEditorAssignments() {
    const [rows] = await pool.query(
      `SELECT assignment.author_id, assignment.editor_id, editor.name AS editor_name
       FROM editor_author_assignments assignment
       INNER JOIN users editor ON editor.id = assignment.editor_id AND editor.deleted_at IS NULL`
    );
    return rows;
  },

  async getAssignedAuthorIds(editorId) {
    const [rows] = await pool.query(
      "SELECT author_id FROM editor_author_assignments WHERE editor_id = ?",
      [editorId]
    );
    return rows.map((row) => Number(row.author_id));
  },

  async getManagerId(authorId) {
    const [rows] = await pool.query("SELECT editor_id FROM editor_author_assignments WHERE author_id = ? LIMIT 1", [authorId]);
    return rows.length ? Number(rows[0].editor_id) : null;
  },

  // Every creator who has a manager (used to tell "unassigned" creators apart).
  async getAllAssignedAuthorIds() {
    const [rows] = await pool.query("SELECT author_id FROM editor_author_assignments");
    return rows.map((row) => Number(row.author_id));
  },

  async isAuthorAssignedToEditor(authorId, editorId) {
    const [rows] = await pool.query(
      "SELECT 1 FROM editor_author_assignments WHERE author_id = ? AND editor_id = ? LIMIT 1",
      [authorId, editorId]
    );
    return rows.length > 0;
  },

  async setAssignedEditor({ authorId, editorId, assignedBy }) {
    if (editorId === null) {
      await pool.query("DELETE FROM editor_author_assignments WHERE author_id = ?", [authorId]);
      return null;
    }
    await pool.query(
      `INSERT INTO editor_author_assignments (author_id, editor_id, assigned_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE editor_id = VALUES(editor_id), assigned_by = VALUES(assigned_by)`,
      [authorId, editorId, assignedBy]
    );
    return { authorId: Number(authorId), editorId: Number(editorId) };
  },

  async clearEditorAssignmentsForUser(userId) {
    await pool.query(
      "DELETE FROM editor_author_assignments WHERE author_id = ? OR editor_id = ?",
      [userId, userId]
    );
  },

  async updateRole(id, role) {
    await pool.query("UPDATE users SET role = ?, permissions = NULL WHERE id = ?", [role, id]);
    return User.findById(id);
  },

  // Combined name/email/role/document editor backing the Team Members table
  // and the admin role-assignment flow — only touches whichever fields are
  // actually passed in.
  async update(id, { name, email, role, permissions, status, siteId, panDocument, aadharDocument, graduationCertificate } = {}) {
    const sets = [];
    const params = [];
    if (name !== undefined) {
      sets.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      sets.push("email = ?");
      params.push(email);
    }
    if (role !== undefined) {
      sets.push("role = ?");
      params.push(role);
    }
    if (permissions !== undefined) {
      sets.push("permissions = ?");
      params.push(JSON.stringify(normalizePermissions(permissions, role)));
    }
    if (status !== undefined) {
      sets.push("status = ?");
      params.push(status);
    }
    if (siteId !== undefined) {
      sets.push("site_id = ?");
      params.push(siteId);
    }
    if (panDocument !== undefined) {
      sets.push("pan_document = ?");
      params.push(panDocument);
    }
    if (aadharDocument !== undefined) {
      sets.push("aadhar_document = ?");
      params.push(aadharDocument);
    }
    if (graduationCertificate !== undefined) {
      sets.push("graduation_certificate = ?");
      params.push(graduationCertificate);
    }
    if (sets.length) {
      params.push(id);
      await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    return User.findById(id);
  },

  async delete(id) {
    await pool.query("DELETE FROM users WHERE id = ?", [id]);
  },

  async create({
    name,
    email,
    passwordHash,
    googleSub = null,
    role = "USER",
    termsAccepted = false,
    acceptedPolicyIds = [],
    panDocument = null,
    aadharDocument = null,
    graduationCertificate = null,
    createdBy = null,
    permissions = null,
    siteId = 1,
  }) {
    const [result] = await pool.query(
      `INSERT INTO users
        (name, email, password_hash, google_sub, role, permissions, status, terms_accepted, terms_accepted_at, accepted_policy_ids, pan_document, aadhar_document, graduation_certificate, created_by, site_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        passwordHash,
        googleSub,
        role,
        permissions === null ? null : JSON.stringify(normalizePermissions(permissions, role)),
        "ACTIVE",
        termsAccepted,
        termsAccepted ? new Date() : null,
        JSON.stringify(acceptedPolicyIds),
        panDocument,
        aadharDocument,
        graduationCertificate,
        createdBy,
        siteId,
      ]
    );
    return User.findById(result.insertId);
  },
};

module.exports = User;
