const Ad = require("../../models/ad.model");
const { PLACEMENTS } = Ad;
const { fileUrl } = require("../../middleware/upload.middleware");

function requestedSiteId(req) {
  const value = req.user.role === "ADMIN"
    ? (req.body?.siteId ?? req.query?.siteId ?? req.get("x-management-site-id") ?? req.site?.id ?? 1)
    : req.user.siteId;
  const siteId = Number(value);
  return Number.isSafeInteger(siteId) && siteId > 0 ? siteId : null;
}

// Only http(s) destinations — blocks javascript:/data: URLs in ad links.
function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function dateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function build(req, current = {}) {
  const body = req.body || {};
  const pick = (key, fallback) => (body[key] !== undefined ? body[key] : fallback);
  const uploaded = req.files?.image?.[0];
  const uploadedLogo = req.files?.logo?.[0];
  const clean = (key, current, max) => String(pick(key, current) || "").trim().slice(0, max) || null;
  const startsAt = dateOrNull(pick("startsAt", current.starts_at));
  const endsAt = dateOrNull(pick("endsAt", current.ends_at));
  if (startsAt === undefined || endsAt === undefined) throw new Error("Start and end dates must be valid");
  if (startsAt && endsAt && endsAt < startsAt) throw new Error("End date must be after the start date");
  const data = {
    advertiser: String(pick("advertiser", current.advertiser) || "").trim().slice(0, 160),
    title: String(pick("title", current.title) || "").trim().slice(0, 180),
    placement: String(pick("placement", current.placement) || "").trim(),
    imageUrl: uploaded ? fileUrl("ads", uploaded) : (String(pick("imageUrl", current.image_url) || "").trim() || null),
    linkUrl: safeUrl(pick("linkUrl", current.link_url)),
    logoUrl: uploadedLogo ? fileUrl("ads", uploadedLogo) : (String(pick("logoUrl", current.logo_url) || "").trim() || null),
    displayUrl: clean("displayUrl", current.display_url, 200),
    headline: clean("headline", current.headline, 200),
    description: clean("description", current.description, 500),
    ctaLabel: clean("ctaLabel", current.cta_label, 60),
    altText: String(pick("altText", current.alt_text) || "").trim().slice(0, 200) || null,
    startsAt,
    endsAt,
    sortOrder: Number.parseInt(pick("sortOrder", current.sort_order), 10) || 0,
    isActive: !["false", "0"].includes(String(pick("isActive", current.is_active ?? true))),
  };
  if (!data.advertiser || !data.title) throw new Error("Advertiser and ad title are required");
  if (!PLACEMENTS.includes(data.placement)) throw new Error("Choose a valid ad placement");
  if (!data.imageUrl && !data.headline) throw new Error("Add a banner image or a headline for the ad");
  if (!data.linkUrl) throw new Error("The ad link must be a valid http(s) address");
  return data;
}

async function listPublic(req, res) {
  const placement = String(req.query.placement || "");
  if (!PLACEMENTS.includes(placement)) return res.status(400).json({ success: false, message: "Unknown ad placement" });
  const ads = await Ad.findLive(req.site.id, placement);
  // Count a view for each ad served. Approximate by design (server-rendered
  // pages, no viewability check) — enough to report reach to advertisers.
  Ad.recordImpressions(ads.map((ad) => ad.id)).catch((error) => console.error("Ad impression error:", error));
  return res.json({ success: true, ads });
}

// Public click-through: count the click, then redirect to the advertiser.
async function click(req, res) {
  const ad = await Ad.findById(req.params.id);
  const target = ad && Number(ad.site_id) === Number(req.site.id) ? safeUrl(ad.link_url) : null;
  if (!target) return res.status(404).json({ success: false, message: "Ad not found" });
  Ad.recordClick(ad.id).catch((error) => console.error("Ad click error:", error));
  return res.redirect(302, target);
}

async function listAdmin(req, res) {
  const siteId = requestedSiteId(req);
  if (!siteId) return res.status(400).json({ success: false, message: "Select a valid website" });
  return res.json({ success: true, ads: await Ad.findForAdmin(siteId), placements: PLACEMENTS });
}

async function create(req, res) {
  try {
    const siteId = requestedSiteId(req);
    if (!siteId) return res.status(400).json({ success: false, message: "Select a valid website" });
    const ad = await Ad.create({ ...build(req), siteId, createdBy: req.user.userId });
    return res.status(201).json({ success: true, message: "Ad created", ad });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const current = await Ad.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: "Ad not found" });
    if (req.user.role !== "ADMIN" && Number(current.site_id) !== Number(req.user.siteId)) {
      return res.status(403).json({ success: false, message: "This ad belongs to another website" });
    }
    return res.json({ success: true, message: "Ad updated", ad: await Ad.update(current.id, build(req, current)) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  const current = await Ad.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Ad not found" });
  if (req.user.role !== "ADMIN" && Number(current.site_id) !== Number(req.user.siteId)) {
    return res.status(403).json({ success: false, message: "This ad belongs to another website" });
  }
  await Ad.remove(current.id);
  return res.json({ success: true, message: "Ad deleted" });
}

module.exports = { listPublic, click, listAdmin, create, update, remove };
