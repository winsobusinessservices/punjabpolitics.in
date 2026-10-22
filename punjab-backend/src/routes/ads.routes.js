const router = require("express").Router();
const { authenticate, authorize, authorizePermission } = require("../middleware/auth.middleware");
const { uploadAdImage, uploadMediaImage, uploadMediaVideo, fileUrl } = require("../middleware/upload.middleware");
const { PERMISSIONS } = require("../config/permissions");
const ads = require("../controllers/ads/ads.controller");

const manage = [authenticate, authorizePermission(PERMISSIONS.MANAGE_ADS)];

router.get("/ads", ads.listPublic);
router.get("/ads/:id/click", ads.click);
router.get("/admin/ads", ...manage, ads.listAdmin);
router.post("/admin/ads", ...manage, uploadAdImage, ads.create);
router.patch("/admin/ads/:id", ...manage, uploadAdImage, ads.update);
router.delete("/admin/ads/:id", ...manage, ads.remove);

// Generic image upload for admin forms; any signed-in staff account may use it.
router.post("/admin/upload-image", authenticate, authorize("ADMIN", "SUBADMIN", "EDITOR", "AUTHOR"), uploadMediaImage, (req, res) => {
  const file = req.files?.image?.[0];
  if (!file) return res.status(400).json({ success: false, message: "Choose an image to upload" });
  return res.status(201).json({ success: true, url: fileUrl("media", file) });
});

// Homepage video upload (MP4/WebM/Ogg/MOV, up to 200 MB). Returns the stored path.
router.post("/admin/upload-video", authenticate, authorize("ADMIN", "SUBADMIN", "EDITOR", "AUTHOR"), uploadMediaVideo, (req, res) => {
  const file = req.files?.videoFile?.[0];
  if (!file) return res.status(400).json({ success: false, message: "Choose a video to upload" });
  return res.status(201).json({ success: true, url: fileUrl("media", file) });
});

module.exports = router;
