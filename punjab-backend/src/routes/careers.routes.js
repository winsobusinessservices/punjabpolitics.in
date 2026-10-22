// Job postings the site is hiring for, and applications against them.
//   GET  /careers                       public — OPEN postings only
//   GET  /careers/manage                ADMIN — every posting, any status
//   POST /careers                       ADMIN — create a posting
//   GET  /careers/:slug                 public — one posting by slug
//   PATCH /careers/:id                  ADMIN — update a posting's content
//   PATCH /careers/:id/status           ADMIN — open/close a posting
//   DELETE /careers/:id                 ADMIN — remove a posting
//   POST /careers/:id/apply             any logged-in member — submit an application
//   GET  /careers/:id/my-application    any logged-in member — the caller's own application, if any
//   GET  /careers/:id/applications      ADMIN — every applicant for a posting
//   POST /careers/:id/applications/:appId/review   ADMIN — review one application
const express = require("express");
const {
  createJob,
  listJobs,
  listAllJobsForAdmin,
  getJobBySlug,
  updateJob,
  setJobStatus,
  deleteJob,
  applyToJob,
  getMyApplication,
  listApplicationsForJob,
  reviewApplication,
} = require("../controllers/careers/careers.controller");
const { authenticate, authorize, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const { uploadCareerApplicationDocuments } = require("../middleware/upload.middleware");

const MEMBER_ROLES = ["USER", "AUTHOR", "EDITOR", "ADMIN", "INVESTOR"];

const router = express.Router();

/**
 * @openapi
 * /api/careers:
 *   get:
 *     summary: List open job postings
 *     tags: [Careers]
 *     responses:
 *       200:
 *         description: Every posting with status OPEN
 */
router.get("/careers", listJobs);

/**
 * @openapi
 * /api/careers/manage:
 *   get:
 *     summary: List every job posting, any status (admin only)
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, CLOSED] }
 *         description: Optionally filter to one status; omit to get every posting
 *     responses:
 *       200:
 *         description: List of postings
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 */
router.get("/careers/manage", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), listAllJobsForAdmin);

/**
 * @openapi
 * /api/careers:
 *   post:
 *     summary: Create a job posting (admin only)
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title: { type: string, example: Political Correspondent }
 *               department: { type: string }
 *               location: { type: string }
 *               employmentType: { type: string, enum: [FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP], default: FULL_TIME }
 *               description: { type: string }
 *               requirements: { type: string }
 *               responsibilities: { type: string }
 *               closesAt: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Job posting created
 *       400:
 *         description: Missing required fields or invalid employmentType
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 */
router.post("/careers", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), createJob);

/**
 * @openapi
 * /api/careers/{slug}:
 *   get:
 *     summary: Get a single job posting by slug
 *     tags: [Careers]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The matching job posting
 *       404:
 *         description: Job posting not found
 */
router.get("/careers/:slug", getJobBySlug);

/**
 * @openapi
 * /api/careers/{id}:
 *   patch:
 *     summary: Update a job posting's content (admin only)
 *     tags: [Careers]
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
 *             required: [title, description]
 *             properties:
 *               title: { type: string }
 *               department: { type: string }
 *               location: { type: string }
 *               employmentType: { type: string, enum: [FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP] }
 *               description: { type: string }
 *               requirements: { type: string }
 *               responsibilities: { type: string }
 *               closesAt: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Job posting updated
 *       400:
 *         description: Missing required fields or invalid employmentType
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Job posting not found
 */
router.patch("/careers/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), updateJob);

/**
 * @openapi
 * /api/careers/{id}/status:
 *   patch:
 *     summary: Open or close a job posting (admin only)
 *     tags: [Careers]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [OPEN, CLOSED] }
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: status must be OPEN or CLOSED
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Job posting not found
 */
router.patch("/careers/:id/status", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), setJobStatus);

/**
 * @openapi
 * /api/careers/{id}:
 *   delete:
 *     summary: Delete a job posting (admin only)
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Job posting deleted
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Job posting not found
 */
router.delete("/careers/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), deleteJob);

/**
 * @openapi
 * /api/careers/{id}/apply:
 *   post:
 *     summary: Apply to a job posting
 *     description: Any logged-in member (USER, AUTHOR, EDITOR, ADMIN, INVESTOR) may apply once per posting. multipart/form-data — resume is required.
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, resume]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               coverLetter: { type: string }
 *               resume: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Application submitted
 *       400:
 *         description: Missing required fields, missing resume, or posting is not OPEN
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Job posting not found
 *       409:
 *         description: Already applied to this posting
 */
router.post("/careers/:id/apply", authenticate, authorize(...MEMBER_ROLES), uploadCareerApplicationDocuments, applyToJob);

/**
 * @openapi
 * /api/careers/{id}/my-application:
 *   get:
 *     summary: Get the caller's own application for a job posting, if any
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The caller's application, or null if they haven't applied
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Job posting not found
 */
router.get("/careers/:id/my-application", authenticate, authorize(...MEMBER_ROLES), getMyApplication);

/**
 * @openapi
 * /api/careers/{id}/applications:
 *   get:
 *     summary: List every applicant for a job posting (admin only)
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Job posting plus its applications
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Job posting not found
 */
router.get("/careers/:id/applications", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), listApplicationsForJob);

/**
 * @openapi
 * /api/careers/{id}/applications/{appId}/review:
 *   post:
 *     summary: Review a job application (admin only)
 *     tags: [Careers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: appId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [REVIEWED, ACCEPTED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Application updated
 *       400:
 *         description: status must be REVIEWED, ACCEPTED, or REJECTED
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Application not found
 */
router.post("/careers/:id/applications/:appId/review", authenticate, authorizePermission(PERMISSIONS.MANAGE_CAREERS), reviewApplication);

module.exports = router;
