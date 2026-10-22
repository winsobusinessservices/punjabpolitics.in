const express = require("express");
const { myHistory } = require("../controllers/history/history.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @openapi
 * /api/me/history:
 *   get:
 *     summary: Everything the signed-in user has submitted ("My Activity")
 *     description: >
 *       Donations (with receipt numbers), Contact form messages, role applications (for example Investor),
 *       career applications, and whether the interests survey was answered. Only this account's own records
 *       are returned, and never payment gateway ids, PAN / Aadhaar details, documents or internal reviewer notes.
 *       Contact messages sent before this feature existed were never stored, so they do not appear.
 *     tags: [Account]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ history: { donations, subscription: { active, validUntil, daysLeft, endedOn }, subscriptions, contactMessages, applications, careerApplications, interests } }"
 *       401:
 *         description: Not signed in
 */
router.get("/me/history", authenticate, myHistory);

module.exports = router;
