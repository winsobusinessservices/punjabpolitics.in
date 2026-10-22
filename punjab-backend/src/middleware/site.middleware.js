const Site = require("../models/site.model");

const SITE_SLUG = process.env.SITE_SLUG || "punjab-politics";

async function resolveSite(req, res, next) {
  try {
    const site = await Site.findBySlug(SITE_SLUG);
    if (!site) return res.status(503).json({ success: false, message: `The ${SITE_SLUG} website is not configured` });
    req.site = site;
    next();
  } catch (error) {
    console.error("Resolve site error:", error);
    return res.status(500).json({ success: false, message: "Website could not be resolved" });
  }
}

module.exports = { resolveSite };
