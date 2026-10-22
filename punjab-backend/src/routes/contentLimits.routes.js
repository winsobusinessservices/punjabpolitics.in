const express = require("express");
const { getContentLimits, getMyContentLimitStatus, updateContentLimits } = require("../controllers/admin/contentLimits.controller");
const { authenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/content-limits/me", authenticate, getMyContentLimitStatus);
router.get("/admin/content-limits", authenticate, authorizePermission(PERMISSIONS.MANAGE_POSTING_LIMITS), getContentLimits);
router.put("/admin/content-limits", authenticate, authorizePermission(PERMISSIONS.MANAGE_POSTING_LIMITS), updateContentLimits);

module.exports = router;
