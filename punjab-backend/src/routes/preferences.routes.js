const express = require("express");
const { getMyPreferences, saveMyPreferences, getPreferencesSummary } = require("../controllers/preferences/preferences.controller");
const { authenticate, optionalAuthenticate, authorize } = require("../middleware/auth.middleware");
const { resolveAnalyticsIdentity } = require("../middleware/analytics.middleware");

const router = express.Router();

/**
 * @openapi
 * /api/preferences/me:
 *   get:
 *     summary: The "My interests" survey - its options and this reader's answers
 *     description: Open to everyone. A signed-in reader is identified by their account; a visitor without an account by the anonymous visitor cookie of their browser. Returns the choices to show and the saved answers (or null before they have answered).
 *     tags: [Preferences]
 *     responses:
 *       200:
 *         description: Options, saved preferences (or null), a completed flag and signedIn
 */
router.get("/preferences/me", optionalAuthenticate, resolveAnalyticsIdentity, getMyPreferences);

/**
 * @openapi
 * /api/preferences/me:
 *   put:
 *     summary: Save this reader's interests (signed in or not)
 *     description: Anonymous visitors are identified by the anonymous visitor cookie (never by IP, which is only hashed for a 20-saves-per-hour spam limit). Without an account, an email address is required for the email channel and a phone number for WhatsApp.
 *     tags: [Preferences]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topics: { type: array, items: { type: string } }
 *               regions: { type: array, items: { type: string } }
 *               parties: { type: array, items: { type: string }, description: Party slugs }
 *               contentTypes: { type: array, items: { type: string } }
 *               channels: { type: array, items: { type: string, enum: [email, browser, whatsapp] } }
 *               frequency: { type: string, enum: [breaking, daily, weekly] }
 *               feedback: { type: string, maxLength: 1000 }
 *               notifyConsent: { type: boolean, description: Must be true when any channel is chosen }
 *               email: { type: string, description: Visitors without an account only; required for the email channel }
 *               phone: { type: string, description: Visitors without an account only; required for WhatsApp }
 *               website: { type: string, description: Honeypot - must stay empty }
 *     responses:
 *       200:
 *         description: Saved
 *       400:
 *         description: Nothing chosen, or channels chosen without notification consent
 */
router.put("/preferences/me", optionalAuthenticate, resolveAnalyticsIdentity, saveMyPreferences);

/**
 * @openapi
 * /api/admin/preferences/summary:
 *   get:
 *     summary: How many readers chose each interest, plus free-text feedback (admin and subadmin)
 *     tags: [Preferences]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, maximum: 200, default: 50 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0 } }
 *     responses:
 *       200:
 *         description: Counts per option, option labels and the latest feedback
 *       403:
 *         description: Admin or Subadmin only
 */
router.get("/admin/preferences/summary", authenticate, authorize("ADMIN", "SUBADMIN"), getPreferencesSummary);

module.exports = router;
