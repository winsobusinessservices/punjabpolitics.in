const Policy = require("../../models/policy.model");
const User = require("../../models/user.model");
const DeletionAudit = require("../../models/deletionAudit.model");
const { sanitizeRichText, richTextToPlainText } = require("../../utils/richText");

const VALID_STATUS = new Set(["DRAFT", "PUBLISHED"]);

function policyPayload(body) {
  return {
    title: String(body.title || "").trim(),
    policyType: String(body.policyType || "").trim(),
    summary: String(body.summary || "").trim(),
    content: sanitizeRichText(body.content),
    status: String(body.status || "DRAFT").toUpperCase(),
    showOnRegistration: body.showOnRegistration === true,
  };
}

function validationMessage(payload) {
  if (!payload.title || !payload.policyType || !payload.summary || !richTextToPlainText(payload.content)) {
    return "Title, policy area, summary, and content are required";
  }
  if (payload.title.length > 200) return "Title must be 200 characters or fewer";
  if (payload.policyType.length > 100) return "Policy area must be 100 characters or fewer";
  if (payload.summary.length > 600) return "Summary must be 600 characters or fewer";
  if (!VALID_STATUS.has(payload.status)) return "Status must be DRAFT or PUBLISHED";
  return null;
}

function managedSiteId(req) {
  return req.user?.role === "ADMIN"
    ? Number(req.body?.siteId || req.query?.siteId || req.get("x-management-site-id") || req.user.siteId || 1)
    : Number(req.user?.siteId || req.site?.id || 1);
}

const listPublishedPolicies = async (req, res) => {
  try {
    const policies = await Policy.findAll({ publishedOnly: true, siteId: req.site.id });
    return res.status(200).json({ success: true, policies });
  } catch (error) {
    console.error("List published policies error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPublishedPolicy = async (req, res) => {
  try {
    const policy = await Policy.findBySlug(req.params.slug, { publishedOnly: true, siteId: req.site.id });
    if (!policy) return res.status(404).json({ success: false, message: "Policy not found" });
    return res.status(200).json({ success: true, policy });
  } catch (error) {
    console.error("Get published policy error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const listRegistrationPolicies = async (req, res) => {
  try {
    const policies = await Policy.findRegistrationPolicies(req.site.id);
    return res.status(200).json({ success: true, policies });
  } catch (error) {
    console.error("List registration policies error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const listPoliciesForAdmin = async (req, res) => {
  try {
    const policies = await Policy.findAll({ siteId: managedSiteId(req) });
    return res.status(200).json({ success: true, policies });
  } catch (error) {
    console.error("List policies for admin error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createPolicy = async (req, res) => {
  try {
    const payload = policyPayload(req.body);
    const message = validationMessage(payload);
    if (message) return res.status(400).json({ success: false, message });
    const siteId = managedSiteId(req);
    const policy = await Policy.create({ ...payload, siteId, createdBy: req.user.userId });
    if (payload.status === "PUBLISHED" && payload.showOnRegistration) {
      await User.requirePrivacyConsentForSite(siteId);
    }
    return res.status(201).json({ success: true, message: "Policy created", policy });
  } catch (error) {
    console.error("Create policy error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updatePolicy = async (req, res) => {
  try {
    const payload = policyPayload(req.body);
    const message = validationMessage(payload);
    if (message) return res.status(400).json({ success: false, message });
    const current = await Policy.findById(req.params.id);
    if (!current || Number(current.site_id) !== managedSiteId(req)) return res.status(404).json({ success: false, message: "Policy not found for this website" });
    const wasRequired = current.status === "PUBLISHED" && Boolean(Number(current.show_on_registration));
    const remainsRequired = payload.status === "PUBLISHED" && payload.showOnRegistration;
    const changed = current.title !== payload.title
      || current.policy_type !== payload.policyType
      || current.summary !== payload.summary
      || current.content !== payload.content;
    const policy = await Policy.update(req.params.id, payload);
    if (!policy) return res.status(404).json({ success: false, message: "Policy not found" });
    if (remainsRequired && (!wasRequired || changed)) {
      await User.requirePrivacyConsentForSite(Number(current.site_id));
    }
    return res.status(200).json({ success: true, message: "Policy updated", policy });
  } catch (error) {
    console.error("Update policy error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deletePolicy = async (req, res) => {
  try {
    const current = await Policy.findById(req.params.id);
    if (!current || Number(current.site_id) !== managedSiteId(req)) return res.status(404).json({ success: false, message: "Policy not found for this website" });
    const removed = await DeletionAudit.softDelete({ entityType: "POLICY", entityId: req.params.id, deletedBy: req.user.userId, reason: req.body?.reason });
    if (!removed) return res.status(404).json({ success: false, message: "Policy not found" });
    return res.status(200).json({ success: true, message: "Policy moved to deleted items" });
  } catch (error) {
    console.error("Delete policy error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  listPublishedPolicies,
  getPublishedPolicy,
  listRegistrationPolicies,
  listPoliciesForAdmin,
  createPolicy,
  updatePolicy,
  deletePolicy,
};
