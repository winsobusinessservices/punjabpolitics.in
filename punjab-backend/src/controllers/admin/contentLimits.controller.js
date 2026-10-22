const { ContentLimit, ROLES, CONTENT_TYPES } = require("../../models/contentLimit.model");

const siteIdFor = (req) => Number(
  (req.user?.role === "ADMIN" && (req.get("X-Management-Site-Id") || req.body?.siteId))
  || req.user?.siteId
  || 1
);

const getContentLimits = async (req, res) => {
  try {
    const limits = await ContentLimit.getAll(siteIdFor(req));
    return res.status(200).json({ success: true, limits });
  } catch (error) {
    console.error("Get content limits error:", error);
    return res.status(500).json({ success: false, message: "Posting limits could not be loaded" });
  }
};

const getMyContentLimitStatus = async (req, res) => {
  try {
    if (!ROLES.includes(req.user.role)) {
      return res.status(200).json({ success: true, limited: false, dailyLimits: {} });
    }

    const dailyLimits = {};
    await Promise.all(CONTENT_TYPES.map(async (contentType) => {
      const [limit, used] = await Promise.all([
        ContentLimit.get(req.user.role, contentType, siteIdFor(req)),
        ContentLimit.getUsage(req.user.userId, contentType, siteIdFor(req)),
      ]);
      dailyLimits[contentType] = {
        type: contentType,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        reached: used >= limit,
      };
    }));

    return res.status(200).json({ success: true, limited: true, dailyLimits });
  } catch (error) {
    console.error("Get personal content limit status error:", error);
    return res.status(500).json({ success: false, message: "Your posting limit could not be checked" });
  }
};

const updateContentLimits = async (req, res) => {
  try {
    const requested = req.body?.limits;
    const limits = {};
    for (const role of ROLES) {
      limits[role] = {};
      for (const contentType of CONTENT_TYPES) {
        const value = Number(requested?.[role]?.[contentType]);
        if (!Number.isInteger(value) || value < 1 || value > 1000) {
          return res.status(400).json({
            success: false,
            message: `${role} ${contentType.toLowerCase()} limit must be a whole number between 1 and 1000`,
          });
        }
        limits[role][contentType] = value;
      }
    }

    const updated = await ContentLimit.setAll(limits, req.user.userId, siteIdFor(req));
    return res.status(200).json({ success: true, message: "Daily posting limits updated", limits: updated });
  } catch (error) {
    console.error("Update content limits error:", error);
    return res.status(500).json({ success: false, message: "Posting limits could not be updated" });
  }
};

module.exports = { getContentLimits, getMyContentLimitStatus, updateContentLimits };
