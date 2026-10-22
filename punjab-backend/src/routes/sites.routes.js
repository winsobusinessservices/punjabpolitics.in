const router = require("express").Router();
const { authenticate, authorize, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const { listSites, currentSite, siteFeatures, createSite, updateSite } = require("../controllers/admin/sites.controller");
const { uploadFields } = require("../middleware/upload.middleware");

const prepareSiteUpload = (req, res, next) => { req.contentType = "sites"; next(); };
const siteImageUpload = uploadFields([
  { name: "logoFile", maxCount: 1 },
  { name: "iconFile", maxCount: 1 },
]);

router.get("/sites/current", currentSite);
router.get("/admin/sites", authenticate, authorizePermission(PERMISSIONS.MANAGE_SERVICES, PERMISSIONS.TEAM_MEMBERS, PERMISSIONS.MANAGE_SITE_DATA, PERMISSIONS.MANAGE_WEBSITES, PERMISSIONS.MANAGE_SITE_MANAGEMENT), listSites);
router.get("/admin/site-features", authenticate, siteFeatures);
router.post("/admin/sites", authenticate, authorize("ADMIN"), prepareSiteUpload, ...siteImageUpload, createSite);
router.patch("/admin/sites/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_WEBSITES), prepareSiteUpload, ...siteImageUpload, updateSite);
module.exports = router;
