// Applications submitted by logged-in members against a career_jobs
// posting. `applicant_id` ties every application to a real account (unlike
// role_applications, which is a public, pre-account signup flow).
const pool = require("../config/db");

const TABLE = "career_applications";
const COLUMNS =
  "id, career_id, applicant_id, name, email, phone, pan, aadhaar, resume, graduation_certificate, cover_letter, status, reviewed_by, review_notes, reviewed_at, created_at";

const CareerApplication = {
  async create({ careerId, applicantId, name, email, phone, pan, aadhaar, resume, graduationCertificate, coverLetter }) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (career_id, applicant_id, name, email, phone, pan, aadhaar, resume, graduation_certificate, cover_letter)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [careerId, applicantId, name, email, phone ?? null, pan, aadhaar, resume, graduationCertificate, coverLetter ?? null]
    );
    return CareerApplication.findById(result.insertId);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`, [id]);
    return rows[0];
  },

  async findByApplicant(careerId, applicantId) {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE career_id = ? AND applicant_id = ?`,
      [careerId, applicantId]
    );
    return rows[0];
  },

  // Admin-only — every applicant for one posting.
  async findAllForJob(careerId) {
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS applicant_account_name, r.name AS reviewer_name
       FROM ${TABLE} a
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN users r ON r.id = a.reviewed_by
       WHERE a.career_id = ?
       ORDER BY a.created_at DESC`,
      [careerId]
    );
    return rows;
  },

  async review(id, { reviewedBy, status, reviewNotes }) {
    await pool.query(
      `UPDATE ${TABLE} SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, reviewedBy, reviewNotes ?? null, id]
    );
    return CareerApplication.findById(id);
  },
};

module.exports = CareerApplication;
