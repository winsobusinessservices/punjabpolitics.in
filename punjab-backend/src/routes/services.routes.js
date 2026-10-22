const router = require("express").Router();
const { authenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const service = require("../controllers/services/services.controller");

router.get("/services", service.listPublic);
router.get("/services/:slug", service.getPublic);
router.get("/admin/services", authenticate, authorizePermission(PERMISSIONS.MANAGE_SERVICES), service.listAdmin);
router.post("/admin/services", authenticate, authorizePermission(PERMISSIONS.MANAGE_SERVICES), service.create);
router.patch("/admin/services/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_SERVICES), service.update);
router.delete("/admin/services/:id", authenticate, authorizePermission(PERMISSIONS.MANAGE_SERVICES), service.remove);
module.exports = router;
