const Service = require("../../models/service.model");
const Site = require("../../models/site.model");
const { slugify } = require("../../utils/slugify");
const { sanitizeRichText } = require("../../utils/richText");

function requestedSiteId(req) {
  const value = req.user.role === "ADMIN"
    ? (req.body?.siteId ?? req.query?.siteId ?? req.get("x-management-site-id") ?? req.site?.id ?? 1)
    : req.user.siteId;
  const siteId = Number(value);
  return Number.isSafeInteger(siteId) && siteId > 0 ? siteId : null;
}

function payload(req, siteId) {
  return {
    siteId,
    title: String(req.body.title || "").trim(),
    slug: slugify(req.body.slug || req.body.title || "service"),
    summary: String(req.body.summary || "").trim() || null,
    content: sanitizeRichText(req.body.content || ""),
    icon: String(req.body.icon || "").trim() || null,
    imageUrl: String(req.body.imageUrl || "").trim() || null,
    ctaLabel: String(req.body.ctaLabel || "").trim() || null,
    ctaUrl: String(req.body.ctaUrl || "").trim() || null,
    seoTitle: String(req.body.seoTitle || "").trim() || null,
    seoDescription: String(req.body.seoDescription || "").trim() || null,
    sortOrder: Number(req.body.sortOrder) || 0,
    isVisible: req.body.isVisible !== false,
    createdBy: req.user.userId,
  };
}

async function listPublic(req, res) {
  if (!req.site.services_enabled) return res.json({ success: true, site: req.site, services: [] });
  const services = await Service.findPublic(req.site.id);
  return res.json({ success: true, site: req.site, services });
}
async function getPublic(req, res) {
  if (!req.site.services_enabled) return res.status(404).json({ success: false, message: "Services are not available on this website" });
  const service = await Service.findPublicBySlug(req.site.id, req.params.slug);
  if (!service) return res.status(404).json({ success: false, message: "Service not found" });
  return res.json({ success: true, site: req.site, service });
}
async function listAdmin(req, res) {
  const siteId = requestedSiteId(req);
  if (!siteId) return res.status(400).json({ success: false, message: "Select a valid website" });
  const site = await Site.findById(siteId);
  if (!site?.services_enabled) return res.status(400).json({ success: false, message: "Services are not enabled for this website" });
  const services = await Service.findForAdmin(siteId);
  return res.json({ success: true, services });
}
async function create(req, res) {
  try {
    const siteId = requestedSiteId(req);
    if (!siteId) return res.status(400).json({ success: false, message: "Select a valid website" });
    const site = await Site.findById(siteId);
    if (!site?.services_enabled) return res.status(400).json({ success: false, message: "Services are not enabled for this website" });
    const data = payload(req, siteId);
    if (!data.title || !data.content) return res.status(400).json({ success: false, message: "Title and detailed content are required" });
    const service = await Service.create(data);
    return res.status(201).json({ success: true, message: "Service created", service });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "This service slug already exists on the website" });
    console.error("Create service error:", error);
    return res.status(500).json({ success: false, message: "Unable to create service" });
  }
}
async function update(req, res) {
  try {
    const current = await Service.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: "Service not found" });
    if (!(await Site.findById(current.site_id))?.services_enabled) return res.status(400).json({ success: false, message: "Services are not enabled for this website" });
    if (req.user.role !== "ADMIN" && Number(current.site_id) !== Number(req.user.siteId)) return res.status(403).json({ success: false, message: "This service belongs to another website" });
    const mergedBody = {
      title: req.body.title ?? current.title, slug: req.body.slug ?? current.slug,
      summary: req.body.summary ?? current.summary, content: req.body.content ?? current.content,
      icon: req.body.icon ?? current.icon, imageUrl: req.body.imageUrl ?? current.image_url,
      ctaLabel: req.body.ctaLabel ?? current.cta_label, ctaUrl: req.body.ctaUrl ?? current.cta_url,
      seoTitle: req.body.seoTitle ?? current.seo_title, seoDescription: req.body.seoDescription ?? current.seo_description,
      sortOrder: req.body.sortOrder ?? current.sort_order, isVisible: req.body.isVisible ?? Boolean(current.is_visible),
    };
    const data = payload({ body: mergedBody, user: req.user }, Number(current.site_id));
    const service = await Service.update(current.id, data);
    return res.json({ success: true, message: "Service updated", service });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "This service slug already exists on the website" });
    console.error("Update service error:", error);
    return res.status(500).json({ success: false, message: "Unable to update service" });
  }
}
async function remove(req, res) {
  const current = await Service.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Service not found" });
  if (!(await Site.findById(current.site_id))?.services_enabled) return res.status(400).json({ success: false, message: "Services are not enabled for this website" });
  if (req.user.role !== "ADMIN" && Number(current.site_id) !== Number(req.user.siteId)) return res.status(403).json({ success: false, message: "This service belongs to another website" });
  await Service.remove(current.id);
  return res.json({ success: true, message: "Service deleted" });
}

module.exports = { listPublic, getPublic, listAdmin, create, update, remove };
