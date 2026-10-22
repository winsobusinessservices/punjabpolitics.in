const { ContentLimit } = require("../models/contentLimit.model");

const TYPE_LABEL = {
  ARTICLE: "articles",
  BLOG: "blogs",
  VIDEO: "videos",
};

async function enforceDailyContentLimit(req, res, next) {
  const type = req.contentType;

  // Only authors and editors have daily posting limits. Admins and any role
  // added later retain their existing permission-driven behaviour.
  if (!['AUTHOR', 'EDITOR'].includes(req.user.role)) return next();

  try {
    const siteId = Number(req.user.siteId || req.site?.id || 1);
    const limit = await ContentLimit.get(req.user.role, type, siteId);
    const used = await ContentLimit.getUsage(req.user.userId, type, siteId);
    if (used >= limit) {
      return res.status(429).json({
        success: false,
        message: `Daily limit reached. ${req.user.role === "AUTHOR" ? "Authors" : "Editors"} can create up to ${limit} ${TYPE_LABEL[type]} per day.`,
        dailyLimit: {
          type,
          limit,
          used,
          remaining: 0,
        },
      });
    }

    return next();
  } catch (error) {
    console.error(`Daily ${type} limit check error:`, error);
    return res.status(500).json({ success: false, message: "Unable to check the daily posting limit" });
  }
}

module.exports = { enforceDailyContentLimit };
