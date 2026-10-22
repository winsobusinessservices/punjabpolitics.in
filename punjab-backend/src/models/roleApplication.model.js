// Public "apply to join as Author/Editor/Investor" flow — distinct from
// admin assigning a role to an already-existing account (auth.controller.js's
// adminAssignRole, which never sets a password): here a visitor submits their
// own details + resume + required documents, it lands as a PENDING row here,
// and an admin reviews it. Approving an application is what actually creates
// the row in `users` (see applications.controller.js's reviewApplication),
// using the password the applicant chose at submission time so they can log
// in immediately.
const pool = require("../config/db");

const TABLE = "role_applications";
const PUBLIC_COLUMNS =
  "id, applicant_user_id, name, email, phone, location, pan_number, aadhar_number, role, resume, pan_document, aadhar_document, graduation_certificate, message, status, reviewed_by, review_notes, reviewed_at, created_at";

const RoleApplication = {
  async create({
    applicantUserId,
    name,
    email,
    phone,
    location,
    panNumber,
    aadharNumber,
    role,
    passwordHash,
    resume,
    panDocument,
    aadharDocument,
    graduationCertificate,
    message,
  }) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (applicant_user_id, name, email, phone, location, pan_number, aadhar_number, role, password_hash, resume, pan_document, aadhar_document, graduation_certificate, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicantUserId ?? null,
        name,
        email,
        phone ?? null,
        location ?? null,
        panNumber ?? null,
        aadharNumber ?? null,
        role,
        passwordHash,
        resume,
        panDocument ?? null,
        aadharDocument ?? null,
        graduationCertificate ?? null,
        message ?? null,
      ]
    );
    return RoleApplication.findById(result.insertId);
  },

  // Includes password_hash — only used internally by reviewApplication() to
  // create the real user account on approval. Never returned from a route.
  async findByIdWithPassword(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`, [id]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`, [id]);
    return rows[0] || null;
  },

  async findPendingByEmail(email) {
    const [rows] = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM ${TABLE} WHERE email = ? AND status = 'PENDING' AND deleted_at IS NULL`, [email]);
    return rows[0] || null;
  },

  async findPendingByUserId(userId) {
    const [rows] = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM ${TABLE} WHERE applicant_user_id = ? AND status = 'PENDING' AND deleted_at IS NULL`, [userId]);
    return rows[0] || null;
  },

  // The applicant's most recent application for one role (any status).
  async findLatestByUserId(userId, role) {
    const [rows] = await pool.query(
      `SELECT id, role, status, created_at, reviewed_at FROM ${TABLE}
       WHERE applicant_user_id = ? AND role = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [userId, role]
    );
    return rows[0] || null;
  },

  async findApprovedByUserId(userId, role) {
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM ${TABLE} WHERE applicant_user_id = ? AND role = ? AND status = 'APPROVED' AND deleted_at IS NULL LIMIT 1`,
      [userId, role]
    );
    return rows[0] || null;
  },

  async findAll({ status, role } = {}) {
    const conditions = ["a.deleted_at IS NULL"];
    const params = [];
    if (status) {
      conditions.push("a.status = ?");
      params.push(status);
    }
    if (role) {
      conditions.push("a.role = ?");
      params.push(role);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    // PUBLIC_COLUMNS is unqualified (fine for the single-table queries above)
    // but ambiguous once joined with `users`, which has its own id/name/
    // email — qualify each column with the `a` alias here instead of reusing it.
    const qualified = PUBLIC_COLUMNS.split(", ").map((col) => `a.${col}`).join(", ");
    const [rows] = await pool.query(
      `SELECT ${qualified}, r.name AS reviewer_name,
              applicant.email AS applicant_account_email
       FROM ${TABLE} a
       LEFT JOIN users r ON r.id = a.reviewed_by
       LEFT JOIN users applicant ON applicant.id = a.applicant_user_id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );
    return rows;
  },

  async review(id, { reviewedBy, status, reviewNotes }) {
    await pool.query(
      `UPDATE ${TABLE} SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, reviewedBy, reviewNotes ?? null, id]
    );
    return RoleApplication.findById(id);
  },
};

module.exports = RoleApplication;
