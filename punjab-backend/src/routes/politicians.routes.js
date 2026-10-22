// Public, read-only reference data — no auth required.
//   GET /politicians              grouped: keyFigures, formerPMs, chiefMinisters
//   GET /politicians/:slug        one politician's full profile
//   GET /parties                  every party
//   GET /parties/:slug            one party's full profile
const express = require("express");
const { getPoliticians, getPoliticianBySlug, getParties, getPartyBySlug, getStates, getStateBySlug, getDistricts, getDistrictBySlug } = require("../controllers/politicians/politicians.controller");

const router = express.Router();

/**
 * @openapi
 * /api/politicians:
 *   get:
 *     summary: List politicians, grouped by category
 *     tags: [Politicians]
 *     responses:
 *       200:
 *         description: keyFigures, formerPMs, and chiefMinisters arrays
 */
router.get("/politicians", getPoliticians);

/**
 * @openapi
 * /api/politicians/{slug}:
 *   get:
 *     summary: Get a single politician's full profile by slug
 *     tags: [Politicians]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The matching politician
 *       404:
 *         description: Politician not found
 */
router.get("/politicians/:slug", getPoliticianBySlug);

/**
 * @openapi
 * /api/parties:
 *   get:
 *     summary: List every political party
 *     tags: [Politicians]
 *     responses:
 *       200:
 *         description: List of parties
 */
router.get("/parties", getParties);

/**
 * @openapi
 * /api/parties/{slug}:
 *   get:
 *     summary: Get a single party's full profile by slug
 *     tags: [Politicians]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The matching party
 *       404:
 *         description: Party not found
 */
router.get("/parties/:slug", getPartyBySlug);

/**
 * @openapi
 * /api/states:
 *   get:
 *     summary: List Indian states and union territories
 *     tags: [States]
 *     responses:
 *       200: { description: State list }
 *       500: { description: Internal server error }
 * /api/states/{slug}:
 *   get:
 *     summary: Get state details by slug
 *     tags: [States]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: State details }
 *       404: { description: State not found }
 *       500: { description: Internal server error }
 */
router.get("/states", getStates);
router.get("/states/:slug", getStateBySlug);

router.get("/districts", getDistricts);
router.get("/districts/:slug", getDistrictBySlug);

module.exports = router;
