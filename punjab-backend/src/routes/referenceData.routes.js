const express = require("express");
const { authenticate, authorize, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const {
  listReferenceData, politicianCrud, partyCrud, stateCrud, districtCrud, updateParliament, updateSchedule, updateVidhanSabhas, updateHomeWidget, getSiteManagement, updateSiteHeader, updatePageProfiles, votePoll, getParliament, getVidhanSabhas, getPageProfiles,
} = require("../controllers/admin/referenceData.controller");

const router = express.Router();
const siteData = [authenticate, authorizePermission(PERMISSIONS.MANAGE_SITE_DATA)];
const siteGuard = (permission) => [authenticate, authorizePermission(permission)];
const widgetPermission = (key) => ({
  breaking_news: PERMISSIONS.SITE_WIDGET_BREAKING_NEWS,
  poll_of_the_day: PERMISSIONS.SITE_WIDGET_POLL,
  election_results: PERMISSIONS.SITE_WIDGET_ELECTION_RESULTS,
}[key] || PERMISSIONS.SITE_WIDGET_OTHER);
const authorizeWidget = (req, res, next) => {
  if (["ADMIN", "SUBADMIN"].includes(req.user?.role)) return next();
  return authorizePermission(PERMISSIONS.MANAGE_SITE_MANAGEMENT, PERMISSIONS.SITE_HOME_WIDGETS, widgetPermission(req.params.key))(req, res, next);
};

router.get("/admin/site-management", authenticate, authorizePermission(PERMISSIONS.MANAGE_SITE_MANAGEMENT), getSiteManagement);
router.put("/admin/site-management/header", authenticate, authorizePermission(PERMISSIONS.MANAGE_SITE_MANAGEMENT), updateSiteHeader);

/**
 * @openapi
 * /api/parliament:
 *   get:
 *     summary: Get Lok Sabha and Rajya Sabha details
 *     tags: [Reference Data]
 *     responses:
 *       200:
 *         description: Current Parliament data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 parliament: { type: object, nullable: true, additionalProperties: true }
 */
router.get("/parliament", getParliament);

/**
 * @openapi
 * /api/vidhan-sabhas:
 *   get:
 *     summary: List all Vidhan Sabha records
 *     tags: [Reference Data]
 *     responses:
 *       200:
 *         description: Vidhan Sabha list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 vidhanSabhas:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/VidhanSabha' }
 */
router.get("/vidhan-sabhas", getVidhanSabhas);
/**
 * @openapi
 * /api/page-profiles:
 *   get:
 *     summary: Get Speeches, Rallies, and Elections page information
 *     tags: [Reference Data]
 *     responses:
 *       200:
 *         description: Saved public-page profiles, or null when defaults are in use
 */
router.get("/page-profiles", getPageProfiles);

/**
 * @openapi
 * /api/poll/vote:
 *   post:
 *     summary: Vote in the Poll of the Day
 *     description: Atomically increments the selected option and recalculates total votes and percentages.
 *     tags: [Poll]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [optionIndex]
 *             properties:
 *               optionIndex: { type: integer, enum: [0, 1], example: 0 }
 *     responses:
 *       200:
 *         description: Vote recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Vote recorded }
 *                 poll: { $ref: '#/components/schemas/Poll' }
 *       400:
 *         description: Invalid option or unavailable poll
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/poll/vote", votePoll);

/**
 * @openapi
 * /api/admin/reference-data:
 *   get:
 *     summary: Get all admin-managed site data
 *     description: Returns politicians, parties, states, Parliament, events, rallies, Vidhan Sabhas, and every home widget.
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Complete reference-data bundle }
 *       401: { description: Authentication required }
 *       403: { description: Administrator role required }
 */
router.get("/admin/reference-data", ...siteData, listReferenceData);

/**
 * @openapi
 * /api/admin/reference-data/politicians:
 *   post:
 *     summary: Create a politician
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PoliticianInput' }
 *     responses:
 *       201: { description: Politician created }
 *       400: { description: Invalid politician details }
 *       401: { description: Authentication required }
 *       403: { description: Administrator role required }
 */
router.post("/admin/reference-data/politicians", ...siteGuard(PERMISSIONS.SITE_POLITICIANS), politicianCrud.create);

/**
 * @openapi
 * /api/admin/reference-data/politicians/{id}:
 *   patch:
 *     summary: Update a politician
 *     tags: [Admin Reference Data]
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
 *           schema: { $ref: '#/components/schemas/PoliticianInput' }
 *     responses:
 *       200: { description: Politician updated }
 *       404: { description: Politician not found }
 *   delete:
 *     summary: Delete a politician
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Politician deleted }
 *       404: { description: Politician not found }
 */
router.patch("/admin/reference-data/politicians/:id", ...siteGuard(PERMISSIONS.SITE_POLITICIANS), politicianCrud.update);
router.delete("/admin/reference-data/politicians/:id", ...siteGuard(PERMISSIONS.SITE_POLITICIANS), politicianCrud.remove);

/**
 * @openapi
 * /api/admin/reference-data/parties:
 *   post:
 *     summary: Create a political party
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PartyInput' }
 *     responses:
 *       201: { description: Party created }
 *       400: { description: Invalid party details }
 */
router.post("/admin/reference-data/parties", ...siteGuard(PERMISSIONS.SITE_PARTIES), partyCrud.create);

/**
 * @openapi
 * /api/admin/reference-data/parties/{id}:
 *   patch:
 *     summary: Update a political party
 *     tags: [Admin Reference Data]
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
 *           schema: { $ref: '#/components/schemas/PartyInput' }
 *     responses:
 *       200: { description: Party updated }
 *       404: { description: Party not found }
 *   delete:
 *     summary: Delete a political party
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Party deleted }
 *       404: { description: Party not found }
 */
router.patch("/admin/reference-data/parties/:id", ...siteGuard(PERMISSIONS.SITE_PARTIES), partyCrud.update);
router.delete("/admin/reference-data/parties/:id", ...siteGuard(PERMISSIONS.SITE_PARTIES), partyCrud.remove);

/**
 * @openapi
 * /api/admin/reference-data/states:
 *   post:
 *     summary: Create a state or union territory
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StateInput' }
 *     responses:
 *       201: { description: State or union territory created }
 *       400: { description: Invalid details }
 */
router.post("/admin/reference-data/states", ...siteGuard(PERMISSIONS.SITE_STATES), stateCrud.create);

/**
 * @openapi
 * /api/admin/reference-data/states/{id}:
 *   patch:
 *     summary: Update a state or union territory
 *     tags: [Admin Reference Data]
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
 *           schema: { $ref: '#/components/schemas/StateInput' }
 *     responses:
 *       200: { description: State or union territory updated }
 *       404: { description: Record not found }
 *   delete:
 *     summary: Delete a state or union territory
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: State or union territory deleted }
 *       404: { description: Record not found }
 */
router.patch("/admin/reference-data/states/:id", ...siteGuard(PERMISSIONS.SITE_STATES), stateCrud.update);
router.delete("/admin/reference-data/states/:id", ...siteGuard(PERMISSIONS.SITE_STATES), stateCrud.remove);

router.post("/admin/reference-data/districts", ...siteGuard(PERMISSIONS.SITE_DISTRICTS), districtCrud.create);
router.patch("/admin/reference-data/districts/:id", ...siteGuard(PERMISSIONS.SITE_DISTRICTS), districtCrud.update);
router.delete("/admin/reference-data/districts/:id", ...siteGuard(PERMISSIONS.SITE_DISTRICTS), districtCrud.remove);

/**
 * @openapi
 * /api/admin/reference-data/parliament:
 *   put:
 *     summary: Replace Parliament details
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parliament]
 *             properties:
 *               parliament:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200: { description: Parliament data updated }
 *       400: { description: Parliament details are required }
 */
router.put("/admin/reference-data/parliament", ...siteGuard(PERMISSIONS.SITE_PARLIAMENT), updateParliament);

/**
 * @openapi
 * /api/admin/reference-data/schedule/{type}:
 *   put:
 *     summary: Replace upcoming events or rallies
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [events, rallies] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ScheduleItem' }
 *     responses:
 *       200: { description: Schedule updated }
 *       400: { description: Invalid schedule items }
 *       404: { description: Invalid schedule type }
 */
router.put("/admin/reference-data/schedule/:type", ...siteGuard(PERMISSIONS.SITE_SCHEDULES), updateSchedule);

/**
 * @openapi
 * /api/admin/reference-data/vidhan-sabhas:
 *   put:
 *     summary: Replace all Vidhan Sabha records
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/VidhanSabha' }
 *     responses:
 *       200: { description: Vidhan Sabha data updated }
 *       400: { description: Invalid Vidhan Sabha records }
 */
router.put("/admin/reference-data/vidhan-sabhas", ...siteGuard(PERMISSIONS.SITE_VIDHAN_SABHAS), updateVidhanSabhas);

/**
 * @openapi
 * /api/admin/reference-data/home-widgets/{key}:
 *   put:
 *     summary: Update an existing home-page widget
 *     description: Updates one existing home_widgets key. Poll totals are reset and generated automatically when poll_of_the_day is saved.
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         example: breaking_news
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 description: Widget value; its shape depends on the selected existing widget key.
 *                 nullable: true
 *     responses:
 *       200: { description: Home widget updated }
 *       400: { description: Widget data is missing or invalid }
 *       404: { description: Home widget key not found }
 */
router.put("/admin/reference-data/home-widgets/:key", authenticate, authorizeWidget, updateHomeWidget);
/**
 * @openapi
 * /api/admin/reference-data/page-profiles:
 *   put:
 *     summary: Update Speeches, Rallies, and Elections page information
 *     tags: [Admin Reference Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profiles]
 *             properties:
 *               profiles:
 *                 type: object
 *                 required: [speeches, rallies, elections]
 *                 properties:
 *                   speeches: { type: object, additionalProperties: true }
 *                   rallies: { type: object, additionalProperties: true }
 *                   elections: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Page information updated }
 *       400: { description: Missing or invalid page information }
 *       401: { description: Authentication required }
 *       403: { description: Administrator role required }
 */
router.put("/admin/reference-data/page-profiles", ...siteGuard(PERMISSIONS.SITE_PAGE_PROFILES), updatePageProfiles);

module.exports = router;
