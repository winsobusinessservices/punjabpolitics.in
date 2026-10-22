const express = require("express");
const {
  recordEvent,
  getOverview,
  getRetention,
} = require("../controllers/analytics/analytics.controller");
const {
  optionalAuthenticate,
  authenticate,
  authorizePermission,
} = require("../middleware/auth.middleware");
const {
  resolveAnalyticsIdentity,
} = require("../middleware/analytics.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * @openapi
 * /api/analytics/events:
 *   post:
 *     summary: Record daily public-site or panel activity
 *     description: >
 *       Records activity using server-resolved website, visitor, session, user, and role identities.
 *       Repeated events update one daily activity row per website and account (or anonymous browser)
 *       using IST calendar days. Raw event names, page paths, and content references are not retained
 *       in the daily activity table. Public/panel activity and roles are stored as flags. This endpoint supports active-user, streak, and retention reports,
 *       not page-view totals or click histories.
 *       Public events may be anonymous. Panel events require an authenticated account. The client
 *       must never send a user ID, role, visitor UUID, session UUID, or website ID.
 *     tags: [Analytics]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventName, surface]
 *             additionalProperties: false
 *             properties:
 *               eventName:
 *                 type: string
 *                 enum:
 *                   - PAGE_VIEW
 *                   - ARTICLE_VIEW
 *                   - BLOG_VIEW
 *                   - VIDEO_VIEW
 *                   - SEARCH
 *                   - COMMENT_SUBMITTED
 *                   - CAREER_APPLICATION_SUBMITTED
 *                   - INVESTOR_APPLICATION_SUBMITTED
 *                   - PANEL_PAGE_VIEW
 *                   - CONTENT_CREATED
 *                   - CONTENT_EDITED
 *                   - CONTENT_SUBMITTED
 *                   - CONTENT_APPROVED
 *                   - CONTENT_REJECTED
 *                   - COMMENT_MODERATED
 *                   - WITHDRAWAL_REQUESTED
 *                   - TEAM_MEMBER_UPDATED
 *                   - TOP_CONTENT_VIEWED
 *               surface:
 *                 type: string
 *                 enum: [PUBLIC, PANEL]
 *               path:
 *                 type: string
 *                 maxLength: 500
 *                 example: /news/example-article
 *               contentType:
 *                 type: string
 *                 nullable: true
 *                 enum: [ARTICLE, BLOG, VIDEO]
 *               contentId:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *           examples:
 *             anonymousArticleView:
 *               summary: Anonymous article view
 *               value:
 *                 eventName: ARTICLE_VIEW
 *                 surface: PUBLIC
 *                 path: /news/example-article
 *                 contentType: ARTICLE
 *                 contentId: 42
 *             authenticatedPanelView:
 *               summary: Authenticated panel page view
 *               value:
 *                 eventName: PANEL_PAGE_VIEW
 *                 surface: PANEL
 *                 path: /panel/top-content
 *     responses:
 *       202:
 *         description: Event accepted, or safely ignored when identified as automated traffic
 *         headers:
 *           Set-Cookie:
 *             description: May create or refresh anonymous visitor and analytics-session cookies
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 ignored: { type: boolean, example: false }
 *       400:
 *         description: Invalid surface or unsupported event name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: A PANEL event was submitted without an authenticated account
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Analytics event could not be recorded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post(
  "/analytics/events",
  optionalAuthenticate,
  resolveAnalyticsIdentity,
  recordEvent
);

/**
 * @openapi
 * /api/analytics/overview:
 *   get:
 *     summary: Get unique active-user analytics by reporting period
 *     description: >
 *       Returns unique active identities after resolving authenticated users and linked anonymous
 *       visitors. Overall, public-audience, team, anonymous, and role totals are calculated for the
 *       selected date or exclusive active-day group. Groups use the current consecutive-day streak across both surfaces in IST, ending today or yesterday. A missed full day resets the streak. Requires the view_audience_analytics privilege.
 *     tags: [Analytics]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         required: false
 *         description: Today and yesterday use IST dates. Usage groups are 7d = completed streak of 7-29 consecutive days, 30d = 30-89, 90d = 90 or more, and all = every recorded user without an active-day restriction. Defaults to 30d
 *         schema:
 *           type: string
 *           enum: [today, yesterday, 7d, 30d, 90d, all]
 *           default: 30d
 *       - in: query
 *         name: siteId
 *         required: false
 *         description: Website selection for an Admin; other roles are restricted to their assigned website
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Active-user overview for the selected reporting period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - period
 *                 - overall_active_users
 *                 - audience_active_users
 *                 - team_active_users
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 period: { type: string, enum: [today, yesterday, 7d, 30d, 90d, all], example: 30d }
 *                 overall_active_users: { type: integer, minimum: 0, example: 12450 }
 *                 audience_active_users: { type: integer, minimum: 0, example: 12380 }
 *                 team_active_users: { type: integer, minimum: 0, example: 70 }
 *                 anonymous_users: { type: integer, minimum: 0, example: 10100 }
 *                 authors: { type: integer, minimum: 0, example: 34 }
 *                 editors: { type: integer, minimum: 0, example: 18 }
 *                 investors: { type: integer, minimum: 0, example: 10 }
 *                 administrators: { type: integer, minimum: 0, example: 8 }
 *       401:
 *         description: Missing or invalid authentication
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: The account does not have the audience-analytics privilege
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Analytics overview could not be loaded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  "/analytics/overview",
  authenticate,
  authorizePermission(PERMISSIONS.VIEW_AUDIENCE_ANALYTICS),
  getOverview
);

/**
 * @openapi
 * /api/analytics/retention:
 *   get:
 *     summary: Get public website D7, D30 and D90 exact-day retention
 *     description: Uses first recorded public activity as Day 0. Counts return on exactly Day N in IST, across all recorded cohorts. Only users whose target day has fully ended are eligible. Rate is a percentage, or null when no users are eligible. Independent of overview period and streak groups.
 *     tags: [Analytics]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: siteId
 *         description: Website selection for Admin; other roles use their assigned website
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Retention percentages and underlying counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 surface: { type: string, example: PUBLIC }
 *                 timezone: { type: string, example: Asia/Kolkata }
 *                 retention:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day: { type: integer, enum: [7, 30, 90] }
 *                       eligible_users: { type: integer }
 *                       retained_users: { type: integer }
 *                       retention_rate: { type: number, nullable: true, example: 20 }
 *       400:
 *         description: Invalid website
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Audience analytics permission required
 *       500:
 *         description: Retention could not be loaded
 */
router.get("/analytics/retention", authenticate, authorizePermission(PERMISSIONS.VIEW_AUDIENCE_ANALYTICS), getRetention);

module.exports = router;
