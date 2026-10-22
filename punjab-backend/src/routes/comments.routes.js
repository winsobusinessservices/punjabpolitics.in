const express = require("express");
const {
  listPostComments,
  createComment,
  listAllComments,
  updateCommentVisibility,
  deleteComment,
} = require("../controllers/comments/comments.controller");
const { authenticate, optionalAuthenticate, authorizePermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/comments/post/:slug", optionalAuthenticate, listPostComments);
router.post("/comments", authenticate, createComment);
router.get("/admin/comments", authenticate, authorizePermission(PERMISSIONS.MANAGE_COMMENTS), listAllComments);
router.patch("/admin/comments/:id/visibility", authenticate, authorizePermission(PERMISSIONS.MANAGE_COMMENTS), updateCommentVisibility);
router.delete("/comments/:id", authenticate, deleteComment);

module.exports = router;
