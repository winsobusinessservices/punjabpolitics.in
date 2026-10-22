const express = require("express");
const { webhook, getConfig, getAdminPlans, updateAdminPlans, getMine, startSubscription, confirmSubscription, getSubscriptionStatus, adminList } = require("../controllers/subscription/subscription.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @openapi
 * /api/subscription/config:
 *   get:
 *     summary: Is Premium open for sale, its price and what the author can mark an article as
 *     tags: [Subscription]
 *     responses:
 *       200:
 *         description: "{ config: { enabled, provider, publicKey, plans: { free, paid: [...] }, types: [{ key, label }] } }"
 */
router.get("/subscription/config", getConfig);

// Called by the payment gateway (signature-checked), not by browsers.
router.post("/subscription/webhook", webhook);
router.post("/payments/webhook", webhook); // the same handler: Premium purchases and Support donations

/**
 * @openapi
 * /api/subscription/me:
 *   get:
 *     summary: Is the signed-in reader Premium, until when, and their past purchases
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ premium: { active, endsAt }, history: [...] }"
 *       401:
 *         description: Not signed in
 */
router.get("/subscription/me", authenticate, getMine);

/**
 * @openapi
 * /api/subscription:
 *   post:
 *     summary: Start buying one month of Premium (signed-in users only)
 *     description: Validates the form, records a CREATED purchase and asks the payment gateway for an order. The month only starts after the payment is confirmed (see /confirm and the gateway webhook). The price is set by the server.
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, consent]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               consent: { type: boolean }
 *               planId: { type: string, description: "Which Premium card (from /subscription/config plans.paid[].id). Optional when there is only one." }
 *     responses:
 *       201:
 *         description: "{ subscription: { publicId, amountPaise, days }, checkout: {...} }"
 *       400:
 *         description: A field is missing or wrong
 *       401:
 *         description: Not signed in
 *       503:
 *         description: Subscriptions are not open
 */
router.post("/subscription", authenticate, startSubscription);

/**
 * @openapi
 * /api/subscription/{publicId}/confirm:
 *   post:
 *     summary: The browser reports a finished payment; its signature is verified before the month starts
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId: { type: string }
 *               signature: { type: string }
 *     responses:
 *       200:
 *         description: "{ status, receiptNumber, endsAt, newlyPaid }"
 *       400:
 *         description: The payment could not be verified
 *       404:
 *         description: Not this reader's purchase
 */
router.post("/subscription/:publicId/confirm", authenticate, confirmSubscription);

/**
 * @openapi
 * /api/subscription/{publicId}:
 *   get:
 *     summary: Status of one of the signed-in reader's own purchases
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ subscription: { publicId, status, receiptNumber, endsAt, amountPaise } }"
 *       404:
 *         description: Not found
 */
router.get("/subscription/:publicId", authenticate, getSubscriptionStatus);

const adminOnly = (req, res, next) => {
  if (req.user?.role === "ADMIN") return next();
  return res.status(403).json({ success: false, message: "Only an admin can manage the subscriptions." });
};

/**
 * @openapi
 * /api/admin/subscriptions:
 *   get:
 *     summary: Premium purchases and totals (Admin only)
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [CREATED, PAID, FAILED, EXPIRED, REFUNDED] } }
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: "{ summary: { activeMembers, paidTotal, paidPaise, pending }, subscriptions: [...] }"
 *       403:
 *         description: Admin only
 */
router.get("/admin/subscriptions", authenticate, adminOnly, adminList);

/**
 * @openapi
 * /api/admin/subscription/plans:
 *   get:
 *     summary: The Free and Premium cards, the price and the length, as shown on the subscription page (Admin only)
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ plans: { free: { name, tagline, features, notIncluded, ctaLabel }, paid: [{ id, name, tagline, features, notIncluded, ctaLabel, priceRupees, days, recommended }] }, updatedAt, updatedByName }"
 *       403:
 *         description: Admin only
 *   put:
 *     summary: Change the cards, price and length of Premium (Admin only)
 *     description: Send the Free card and the full list of Premium cards (1 to 4; a card left out of the list is removed, a new card has no id). Prices are whole rupees (1 to 100000), lengths whole days (1 to 366). Purchases already made are not changed.
 *     tags: [Subscription]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plans:
 *                 type: object
 *                 properties:
 *                   free: { type: object }
 *                   paid: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: The saved plans
 *       400:
 *         description: A value is not allowed (the message says which)
 *       403:
 *         description: Admin only
 */
router.get("/admin/subscription/plans", authenticate, adminOnly, getAdminPlans);
router.put("/admin/subscription/plans", authenticate, adminOnly, updateAdminPlans);

module.exports = router;
