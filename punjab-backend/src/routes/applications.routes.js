// Public "apply to join as Author/Editor/Investor" flow — distinct from
// /auth/admin/users (admin directly creates an account). Here a visitor
// submits their own details, resume, and required documents; an admin
// reviews and approves (creating the real account) or rejects.
//   POST /applications              submit an application         (public)
//   GET  /applications/mine?role=    my latest application status   (signed in)
//   GET  /applications               list applications              (ADMIN)
//   POST /applications/:id/review    approve/reject                 (ADMIN)
const express = require("express");
const { submitApplication, listApplications, reviewApplication, getMyApplicationStatus } = require("../controllers/applications/applications.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { uploadApplicationDocuments } = require("../middleware/upload.middleware");

const router = express.Router();

/**
 * @openapi
 * /api/applications:
 *   post:
 *     summary: Submit an application to join as Author, Editor, or Investor
 *     description: >
 *       Public — no auth required. Creates a PENDING role_applications row only;
 *       it does NOT create a login-able account (that happens on admin approval).
 *       multipart/form-data. Resume is always required; Author additionally needs
 *       PAN + Aadhar, Editor additionally needs PAN + Aadhar + a graduation
 *       certificate, Investor needs no extra documents.
 *     tags: [Applications]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, password, role, resume]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               location: { type: string, maxLength: 255 }
 *               password: { type: string, format: password }
 *               role: { type: string, enum: [AUTHOR, EDITOR, INVESTOR] }
 *               message: { type: string }
 *               resume: { type: string, format: binary }
 *               panDocument: { type: string, format: binary }
 *               aadharDocument: { type: string, format: binary }
 *               graduationCertificate: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Application submitted
 *       400:
 *         description: Missing/invalid fields, weak password, invalid email, or missing required document(s)
 *       409:
 *         description: An account or pending application already exists for this email
 */
router.post("/applications", authenticate, uploadApplicationDocuments, submitApplication);

/**
 * @openapi
 * /api/applications/mine:
 *   get:
 *     summary: The signed-in member's latest application status for one role
 *     tags: [Applications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         required: true
 *         schema: { type: string, enum: [AUTHOR, EDITOR, INVESTOR] }
 *     responses:
 *       200:
 *         description: Latest application (or null) and whether a new one may be submitted. Rejected applicants may apply again; approved or pending ones may not.
 *       401:
 *         description: Missing or invalid token
 */
router.get("/applications/mine", authenticate, getMyApplicationStatus);

/**
 * @openapi
 * /api/applications:
 *   get:
 *     summary: List role applications (admin only)
 *     tags: [Applications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *         description: Optionally filter to one status; omit to get every application
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [AUTHOR, EDITOR, INVESTOR] }
 *         description: Optionally filter to one applied-for role; omit to get every role
 *     responses:
 *       200:
 *         description: List of applications
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 */
router.get("/applications", authenticate, authorize("ADMIN"), listApplications);

/**
 * @openapi
 * /api/applications/{id}/review:
 *   post:
 *     summary: Approve or reject a role application (admin only)
 *     description: Approving creates the real `users` row (reusing the password the applicant chose at submission) and marks the application APPROVED; rejecting just records the decision.
 *     tags: [Applications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [APPROVE, REJECT] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Application reviewed
 *       400:
 *         description: action must be APPROVE or REJECT, or the application was already reviewed
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Application not found
 *       409:
 *         description: An account with this email already exists
 */
router.post("/applications/:id/review", authenticate, authorize("ADMIN"), reviewApplication);

module.exports = router;
