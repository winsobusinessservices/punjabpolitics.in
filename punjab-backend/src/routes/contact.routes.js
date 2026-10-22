const express = require("express");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const { optionalAuthenticate } = require("../middleware/auth.middleware");
const { submitContact } = require("../controllers/contact/contact.controller");

const router = express.Router();

/**
 * @openapi
 * /api/contact:
 *   post:
 *     summary: Send a contact message
 *     description: Sends a public contact-form submission to the configured Indian Rajniti contact inbox. Authentication is not required. A maximum of five successful submissions per IP address is allowed per hour.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Aditi Sharma
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 254
 *                 example: aditi@example.com
 *               phone:
 *                 type: string
 *                 maxLength: 30
 *                 example: "+91 98765 43210"
 *               subject:
 *                 type: string
 *                 maxLength: 150
 *                 example: Correction request
 *               message:
 *                 type: string
 *                 maxLength: 5000
 *                 example: I would like to report a factual correction in an article.
 *     responses:
 *       200:
 *         description: Message delivered to the contact inbox
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Thanks for contacting us. We will respond shortly. }
 *       400:
 *         description: Missing required fields or invalid email address
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       429:
 *         description: More than five successful messages were submitted from the same IP within one hour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: The email could not be delivered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/contact", verifyTurnstile, optionalAuthenticate, submitContact);

module.exports = router;
