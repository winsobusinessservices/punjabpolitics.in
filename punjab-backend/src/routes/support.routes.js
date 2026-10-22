const express = require("express");
const {
  getConfig, startDonation, confirmDonation, getDonationStatus, stopMonthly, getMine, getSupporters, adminList, adminExport,
} = require("../controllers/support/support.controller");
const { authenticate, optionalAuthenticate } = require("../middleware/auth.middleware");

const router = express.Router();

// Public: the Support page needs no account.
router.get("/support/config", getConfig);
router.get("/support/supporters", getSupporters);
router.post("/support/donations", optionalAuthenticate, startDonation);
router.post("/support/donations/:publicId/confirm", confirmDonation);

// A signed-in donor's own contributions, and stopping a monthly one.
router.get("/support/me", authenticate, getMine);
router.post("/support/donations/:publicId/stop", authenticate, stopMonthly);

// The donation's random id is the only access the thank-you page needs.
router.get("/support/donations/:publicId", getDonationStatus);

const adminOnly = (req, res, next) => {
  if (req.user?.role === "ADMIN") return next();
  return res.status(403).json({ success: false, message: "Only an admin can manage donations." });
};
router.get("/admin/donations", authenticate, adminOnly, adminList);
router.get("/admin/donations/export", authenticate, adminOnly, adminExport);

module.exports = router;
