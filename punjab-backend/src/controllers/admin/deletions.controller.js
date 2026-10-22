const DeletionAudit = require("../../models/deletionAudit.model");

const managedSiteId = (req) => Number(
  (req.user?.role === "ADMIN" && (req.body?.siteId || req.query?.siteId || req.get("x-management-site-id")))
  || req.user?.siteId
  || 1
);

const listDeletions = async (req, res) => {
  try {
    const requestedState = String(req.query.state || "ACTIVE").toUpperCase();
    const state = ["ACTIVE", "RESTORED", "PERMANENT", "ALL"].includes(requestedState)
      ? requestedState
      : "ACTIVE";
    const deletions = await DeletionAudit.list({ state, siteId: managedSiteId(req) });
    return res.status(200).json({ success: true, deletions });
  } catch (error) {
    console.error("List deletions error:", error);
    return res.status(500).json({ success: false, message: "Unable to load deleted items" });
  }
};

const restoreDeletion = async (req, res) => {
  try {
    const restored = await DeletionAudit.restore(req.params.id, req.user.userId, managedSiteId(req));
    if (!restored) return res.status(404).json({ success: false, message: "Deleted item is unavailable" });
    return res.status(200).json({ success: true, message: "Item restored" });
  } catch (error) {
    console.error("Restore deletion error:", error);
    const duplicate = error.code === "ER_DUP_ENTRY";
    return res.status(duplicate ? 409 : 500).json({
      success: false,
      message: duplicate ? "This item cannot be restored because a conflicting record now exists" : "Unable to restore item",
    });
  }
};

const permanentlyDelete = async (req, res) => {
  try {
    const deleted = await DeletionAudit.hardDelete(req.params.id, req.user.userId, managedSiteId(req));
    if (!deleted) return res.status(404).json({ success: false, message: "Deleted item is unavailable" });
    return res.status(200).json({ success: true, message: "Item permanently deleted" });
  } catch (error) {
    console.error("Permanent deletion error:", error);
    return res.status(500).json({ success: false, message: "Unable to permanently delete item" });
  }
};

module.exports = { listDeletions, restoreDeletion, permanentlyDelete };
