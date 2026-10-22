const express = require("express");
const {
  getWallet,
  requestWithdrawal,
  listWithdrawalsForAdmin,
  markWithdrawalPaid,
  rejectWithdrawal,
  listWalletsForAdmin,
  updateWithdrawalAccess,
  getPointRates,
  updatePointRates,
  getWithdrawalSettings,
  updateWithdrawalSettings,
  awardContentBonus,
  acknowledgeBonus,
} = require("../controllers/wallet/wallet.controller");
const { authenticate, authorize, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * @openapi
 * /api/wallet:
 *   get:
 *     summary: Get the current contributor's wallet summary and point history
 *     tags: [Wallet]
 *     responses:
 *       200: { description: Wallet summary and up to 100 recent transactions }
 *       401: { description: Authentication required }
 *       403: { description: Author or editor role required }
 */
router.get("/wallet", authenticate, authorize("AUTHOR", "EDITOR"), getWallet);

/**
 * @openapi
 * /api/wallet/withdrawals:
 *   post:
 *     summary: Request a wallet withdrawal
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [points, upiId]
 *             properties:
 *               points: { type: integer, minimum: 1 }
 *               upiId: { type: string, example: name@okbank }
 *     responses:
 *       201: { description: Withdrawal requested }
 *       400: { description: Invalid amount or withdrawal unavailable }
 *       401: { description: Authentication required }
 *       403: { description: Withdrawal access denied }
 *       409: { description: Withdrawal already requested }
 * /api/admin/withdrawals:
 *   get:
 *     summary: List withdrawal requests (pending first)
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PAID, REJECTED] }
 *     responses:
 *       200: { description: Withdrawal requests with contributor and UPI details }
 * /api/admin/withdrawals/{withdrawalId}/pay:
 *   patch:
 *     summary: Mark a withdrawal paid with the bank UTR
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [utrNumber]
 *             properties:
 *               utrNumber: { type: string, example: 412345678901 }
 *     responses:
 *       200: { description: Marked paid; contributor emailed }
 *       409: { description: Already settled }
 * /api/admin/withdrawals/{withdrawalId}/reject:
 *   patch:
 *     summary: Reject a withdrawal and return the points
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Rejected; contributor emailed }
 *       409: { description: Already settled }
 * /api/admin/wallets:
 *   get:
 *     summary: List contributor wallets and withdrawals
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Wallet administration data }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 * /api/admin/wallets/withdrawal-settings:
 *   get:
 *     summary: Get withdrawal balance settings
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Withdrawal settings }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 *   put:
 *     summary: Update withdrawal balance settings
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr]
 *             properties:
 *               minimumWithdrawalInr: { type: number, minimum: 0 }
 *               authorMinimumRemainingInr: { type: number, minimum: 0 }
 *               editorMinimumRemainingInr: { type: number, minimum: 0 }
 *     responses:
 *       200: { description: Withdrawal settings updated }
 *       400: { description: Invalid amounts }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 * /api/admin/wallets/{userId}/withdrawal-access:
 *   patch:
 *     summary: Enable or disable withdrawals for a user
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200: { description: Withdrawal access updated }
 *       400: { description: Boolean enabled value required }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 * /api/admin/wallets/point-rates:
 *   get:
 *     summary: Get point values and reward settings
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Point and reward settings }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *   put:
 *     summary: Update point values and reward settings
 *     tags: [Wallet Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [authorRate, editorRate, authorArticlePoints, authorBlogPoints, authorVideoPoints, editorArticlePoints, editorBlogPoints, editorVideoPoints, editorReviewArticlePoints, editorReviewBlogPoints, editorReviewVideoPoints]
 *             properties:
 *               authorRate: { type: number, minimum: 0 }
 *               editorRate: { type: number, minimum: 0 }
 *               authorArticlePoints: { type: integer, minimum: 1 }
 *               authorBlogPoints: { type: integer, minimum: 1 }
 *               authorVideoPoints: { type: integer, minimum: 1 }
 *               editorArticlePoints: { type: integer, minimum: 1 }
 *               editorBlogPoints: { type: integer, minimum: 1 }
 *               editorVideoPoints: { type: integer, minimum: 1 }
 *               editorReviewArticlePoints: { type: integer, minimum: 1 }
 *               editorReviewBlogPoints: { type: integer, minimum: 1 }
 *               editorReviewVideoPoints: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Point and reward settings updated }
 *       400: { description: Invalid rates or reward points }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 */
router.post("/wallet/withdrawals", authenticate, authorize("AUTHOR", "EDITOR"), requestWithdrawal);
router.patch("/wallet/bonuses/:bonusId/acknowledge", authenticate, authorize("AUTHOR", "EDITOR"), acknowledgeBonus);
router.get("/admin/withdrawals", authenticate, authorizePermission(PERMISSIONS.MANAGE_WITHDRAWALS), listWithdrawalsForAdmin);
router.patch("/admin/withdrawals/:withdrawalId/pay", authenticate, authorizePermission(PERMISSIONS.MANAGE_WITHDRAWALS), markWithdrawalPaid);
router.patch("/admin/withdrawals/:withdrawalId/reject", authenticate, authorizePermission(PERMISSIONS.MANAGE_WITHDRAWALS), rejectWithdrawal);
router.get("/admin/wallets", authenticate, authorizePermission(PERMISSIONS.MANAGE_WALLETS), listWalletsForAdmin);
router.get("/admin/wallets/withdrawal-settings", authenticate, authorize("ADMIN"), getWithdrawalSettings);
router.put("/admin/wallets/withdrawal-settings", authenticate, authorize("ADMIN"), updateWithdrawalSettings);
router.patch("/admin/wallets/:userId/withdrawal-access", authenticate, authorizePermission(PERMISSIONS.MANAGE_WALLETS), updateWithdrawalAccess);
router.get("/admin/wallets/point-rates", authenticate, authorizePermission(PERMISSIONS.MANAGE_POINT_RATES), getPointRates);
router.put("/admin/wallets/point-rates", authenticate, authorizePermission(PERMISSIONS.MANAGE_POINT_RATES), updatePointRates);
router.post("/admin/wallets/bonuses", authenticate, authorize("ADMIN"), awardContentBonus);

module.exports = router;
