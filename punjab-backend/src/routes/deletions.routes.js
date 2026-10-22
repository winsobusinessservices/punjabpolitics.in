const express = require("express");
const { authenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const {
  listDeletions,
  restoreDeletion,
  permanentlyDelete,
} = require("../controllers/admin/deletions.controller");

const router = express.Router();

router.get("/admin/deletions", authenticate, authorizePermission(PERMISSIONS.MANAGE_DELETED_ITEMS), listDeletions);
router.patch("/admin/deletions/:id/restore", authenticate, authorizePermission(PERMISSIONS.MANAGE_DELETED_ITEMS), restoreDeletion);
router.delete("/admin/deletions/:id/permanent", authenticate, authorizePermission(PERMISSIONS.MANAGE_DELETED_ITEMS), permanentlyDelete);

module.exports = router;
