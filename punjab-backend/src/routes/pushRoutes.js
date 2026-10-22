const express = require("express");
const { saveSubscription, removeSubscription } = require("../controllers/notifications/pushnotification.controller");
const { getSettings, updateSettings } = require("../controllers/notifications/interestPush.controller");
const { authenticate, optionalAuthenticate } = require("../middleware/auth.middleware");
const { resolveAnalyticsIdentity } = require("../middleware/analytics.middleware");

const router = express.Router();

/**
 * @openapi
 * /api/push/subscribe:
 *   post:
 *     summary: Save this browser's push notification subscription
 *     description: >
 *       Called by the website after the visitor allows notifications. Works for visitors who are not signed in;
 *       when the visitor is signed in the subscription is linked to their account. Only addresses at the real
 *       browser push services (Chrome/Edge, Firefox, Safari, Windows) are accepted. Saving the same browser
 *       again updates its topics.
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscription]
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: The browser's PushSubscription as JSON
 *                 required: [endpoint, keys]
 *                 properties:
 *                   endpoint: { type: string }
 *                   keys:
 *                     type: object
 *                     properties:
 *                       p256dh: { type: string }
 *                       auth: { type: string }
 *               topics:
 *                 type: array
 *                 maxItems: 20
 *                 items: { type: string, maxLength: 80 }
 *                 example: [politics, breaking-news]
 *     responses:
 *       201:
 *         description: Subscription saved
 *       400:
 *         description: Invalid subscription, endpoint or topics
 *       429:
 *         description: Too many attempts from this IP
 */
router.post("/push/subscribe", optionalAuthenticate, resolveAnalyticsIdentity, saveSubscription);

/**
 * @openapi
 * /api/push/unsubscribe:
 *   post:
 *     summary: Stop sending push notifications to this browser
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint]
 *             properties:
 *               endpoint: { type: string }
 *     responses:
 *       200:
 *         description: "{ removed } - false when that browser was not subscribed"
 *       400:
 *         description: Invalid endpoint
 */
router.post("/push/unsubscribe", removeSubscription);

const adminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (req.user.role === "ADMIN") return next();
  return res.status(403).json({ success: false, message: "Only an admin can turn notifications on or off." });
};

/**
 * @openapi
 * /api/push/interest/settings:
 *   get:
 *     summary: Are interest-based browser notifications on? (Admin only)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ settings: { enabled, sendFromHour, updatedAt, updatedByName, dailyLimit, activeBrowsers, eligibleBrowsers, sentToday, peopleToday, configured } }"
 *       403:
 *         description: Admin only
 *   patch:
 *     summary: Turn interest-based browser notifications on or off (Admin only)
 *     description: >
 *       While off, nothing is sent, and new items (articles, blogs, videos, events, elections, results) added during that
 *       time are marked as handled, so turning it back on never sends a backlog. Applies to the website the admin is managing.
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               sendFromHour: { type: integer, minimum: 0, maximum: 23, description: "Notifications are sent from this hour of the day, India time (default 12, noon). 0 = any time. Items that appear earlier are held and sent when the hour comes." }
 *     responses:
 *       200:
 *         description: The new settings
 *       400:
 *         description: Send enabled (true/false) and/or sendFromHour (0-23)
 *       403:
 *         description: Admin only
 */
router.get("/push/interest/settings", authenticate, adminOnly, getSettings);
router.patch("/push/interest/settings", authenticate, adminOnly, updateSettings);

module.exports = router;
