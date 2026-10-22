const express = require("express");
const {
  listPublishedPolicies,
  getPublishedPolicy,
  listRegistrationPolicies,
  listPoliciesForAdmin,
  createPolicy,
  updatePolicy,
  deletePolicy,
} = require("../controllers/policies/policies.controller");
const { authenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * @openapi
 * /api/policies:
 *   get:
 *     summary: List published policies
 *     tags: [Policies]
 *     responses:
 *       200: { description: Published policies }
 *       500: { description: Internal server error }
 *   post:
 *     summary: Create a policy
 *     tags: [Policies]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, policyType, summary, content]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               policyType: { type: string, maxLength: 100 }
 *               summary: { type: string, maxLength: 600 }
 *               content: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED] }
 *               showOnRegistration: { type: boolean }
 *     responses:
 *       201: { description: Policy created }
 *       400: { description: Invalid policy }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 * /api/policies/registration:
 *   get:
 *     summary: List policies required during registration
 *     tags: [Policies]
 *     responses:
 *       200: { description: Registration policies }
 *       500: { description: Internal server error }
 * /api/policies/manage:
 *   get:
 *     summary: List all policies for administration
 *     tags: [Policies]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All policies }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 * /api/policies/{id}:
 *   patch:
 *     summary: Update a policy
 *     tags: [Policies]
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
 *             required: [title, policyType, summary, content]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               policyType: { type: string, maxLength: 100 }
 *               summary: { type: string, maxLength: 600 }
 *               content: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED] }
 *               showOnRegistration: { type: boolean }
 *     responses:
 *       200: { description: Policy updated }
 *       400: { description: Invalid policy }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 *       404: { description: Policy not found }
 *   delete:
 *     summary: Delete a policy
 *     tags: [Policies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Policy deleted }
 *       401: { description: Authentication required }
 *       403: { description: Admin role required }
 *       404: { description: Policy not found }
 * /api/policies/{slug}:
 *   get:
 *     summary: Get a published policy by slug
 *     tags: [Policies]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Published policy }
 *       404: { description: Policy not found }
 *       500: { description: Internal server error }
 */
router.get("/policies", listPublishedPolicies);
router.get("/policies/registration", listRegistrationPolicies);
router.get("/policies/manage", authenticate, authorizePermission(PERMISSIONS.MANAGE_POLICIES), listPoliciesForAdmin);
router.post("/policies", authenticate, authorizePermission(PERMISSIONS.MANAGE_POLICIES), createPolicy);
router.patch("/policies/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_POLICIES), updatePolicy);
router.delete("/policies/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_POLICIES), deletePolicy);
router.get("/policies/:slug", getPublishedPolicy);

module.exports = router;
