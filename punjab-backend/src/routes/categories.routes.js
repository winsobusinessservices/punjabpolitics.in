const express = require("express");
const {
  listCategories, listVisibilitySettings, createCategory, getCategoryContent, updateCategoryContent, updateCategoryVisibility, updateCategoryPremium, updateSectionVisibility, listReferenceVisibility, updateReferenceVisibility, deleteCategory,
} = require("../controllers/categories/categories.controller");
const { authenticate, authorizePermission, authorizeRoleOrPermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: List visible content categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Visible category list, including standalone category-page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, example: 1 }
 *                       name: { type: string, example: Politics }
 *                       slug: { type: string, example: politics }
 *                       is_visible: { type: integer, enum: [0, 1], example: 1 }
 *                       content: { type: string, nullable: true, example: Background information about Indian politics. }
 *       500: { description: Internal server error }
 *   post:
 *     summary: Create a category
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 120 }
 *               content: { type: string, maxLength: 50000, description: Standalone content displayed on the category page }
 *               isVisible: { type: boolean, default: true }
 *     responses:
 *       201: { description: Category created }
 *       400: { description: Invalid category name }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *       409: { description: Category already exists or its route belongs to a party, leader, state, or union territory }
 * /api/admin/ui-visibility:
 *   get:
 *     summary: List category and UI-section visibility settings
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Visibility settings }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 * /api/categories/{id}/visibility:
 *   patch:
 *     summary: Show or hide a category
 *     tags: [Categories]
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
 *             required: [isVisible]
 *             properties:
 *               isVisible: { type: boolean }
 *     responses:
 *       200: { description: Visibility updated }
 *       400: { description: Boolean visibility is required }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *       404: { description: Category not found }
 * /api/categories/{id}/content:
 *   get:
 *     summary: Get the standalone content and route ownership for one visible category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Category page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 category:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 12 }
 *                     name: { type: string, example: Politics }
 *                     slug: { type: string, example: politics }
 *                     content: { type: string, nullable: true }
 *                     is_visible: { type: integer, enum: [0, 1] }
 *                     route_owner: { type: object, nullable: true, additionalProperties: true }
 *       404: { description: Category not found or hidden }
 *       500: { description: Internal server error }
 *   patch:
 *     summary: Update a category's standalone page content
 *     tags: [Categories]
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
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 50000 }
 *     responses:
 *       200: { description: Category page content updated }
 *       400: { description: Content is too long }
 *       401: { description: Authentication required }
 *       403: { description: Manage Categories permission required }
 *       404: { description: Category not found }
 *       409: { description: Route belongs to dedicated party, leader, state, or union-territory data }
 *       500: { description: Internal server error }
 * /api/admin/ui-sections/{key}/visibility:
 *   patch:
 *     summary: Show or hide a UI section
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isVisible]
 *             properties:
 *               isVisible: { type: boolean }
 *     responses:
 *       200: { description: Visibility updated }
 *       400: { description: Boolean visibility is required }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *       404: { description: Section not found }
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Category deleted }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *       404: { description: Category not found }
 *       409: { description: Category is in use }
 */
router.get("/categories", listCategories);
router.get("/admin/ui-visibility", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), listVisibilitySettings);
router.get("/admin/reference-visibility", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), listReferenceVisibility);
router.patch("/admin/reference-visibility/:type/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), updateReferenceVisibility);
router.post("/categories", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), createCategory);
router.get("/categories/:id/content", getCategoryContent);
router.patch("/categories/:id/content", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), updateCategoryContent);
router.patch("/categories/:id/premium", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), updateCategoryPremium);
router.patch("/categories/:id/visibility", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), updateCategoryVisibility);
router.patch("/admin/ui-sections/:key/visibility", authenticate, authorizeRoleOrPermission(["ADMIN", "SUBADMIN"], PERMISSIONS.MANAGE_CATEGORIES, PERMISSIONS.MANAGE_SITE_MANAGEMENT), updateSectionVisibility);
router.delete("/categories/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_CATEGORIES), deleteCategory);

module.exports = router;
