const Site = require("../../models/site.model");
const { slugify } = require("../../utils/slugify");
const { fileUrl } = require("../../middleware/upload.middleware");
const UiSection = require("../../models/uiSection.model");

const cleanDomain = (value) => String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const parsedArray = (value) => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const cleanSocialLinks = (value) => parsedArray(value).map((item) => ({
  label: String(item?.label || "").trim(),
  url: String(item?.url || "").trim(),
})).filter((item) => item.label && /^https?:\/\//i.test(item.url)).slice(0, 12);
const storedSocialLinks = (value) => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
};
const booleanValue = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (["true", "1", "on"].includes(String(value).toLowerCase())) return true;
  if (["false", "0", "off"].includes(String(value).toLowerCase())) return false;
  return fallback;
};
const uploadedImage = (req, field) => req.files?.[field]?.[0] ? fileUrl("sites", req.files[field][0]) : null;

async function listSites(req, res) {
  try {
    return res.json({ success: true, sites: [req.site] });
  } catch (error) {
    console.error("List sites error:", error);
    return res.status(500).json({ success: false, message: "Unable to load websites" });
  }
}

async function currentSite(req, res) {
  return res.json({ success: true, site: req.site });
}

async function siteFeatures(req, res) {
  try {
    const siteId = Number(req.site.id);
    const site = await Site.findById(siteId);
    if (!site) return res.status(404).json({ success: false, message: "Website not found" });
    const visibility = await UiSection.visibilityMap(siteId);
    const features = Object.fromEntries(Object.entries(visibility).filter(([key]) => key.startsWith("feature_")));
    return res.json({ success: true, site, features });
  } catch (error) {
    console.error("Load site features error:", error);
    return res.status(500).json({ success: false, message: "Unable to load website features" });
  }
}

async function createSite(req, res) {
  return res.status(403).json({ success: false, message: "This backend is dedicated to Punjab Politics and cannot create additional websites" });
}

async function updateSite(req, res) {
  try {
    if (Number(req.params.id) !== Number(req.site.id)) return res.status(403).json({ success: false, message: "Only the Punjab Politics website can be updated" });
    const current = await Site.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: "Website not found" });
    const name = String(req.body.name || current.name).trim();
    const site = await Site.update(current.id, {
      ...current, ...req.body, name,
      slug: slugify(req.body.slug || current.slug || name),
      domain: cleanDomain(req.body.domain || current.domain),
      logoUrl: uploadedImage(req, "logoFile") || current.logo_url,
      iconUrl: uploadedImage(req, "iconFile") || current.icon_url,
      primaryColor: req.body.primaryColor ?? current.primary_color,
      secondaryColor: req.body.secondaryColor ?? current.secondary_color,
      socialLinks: req.body.socialLinks === undefined ? storedSocialLinks(current.social_links) : cleanSocialLinks(req.body.socialLinks),
      servicesEnabled: booleanValue(req.body.servicesEnabled, Boolean(current.services_enabled)),
    });
    return res.json({ success: true, message: "Website updated", site });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "That website slug or domain already exists" });
    console.error("Update site error:", error);
    return res.status(500).json({ success: false, message: "Unable to update website" });
  }
}

module.exports = { listSites, currentSite, siteFeatures, createSite, updateSite };
