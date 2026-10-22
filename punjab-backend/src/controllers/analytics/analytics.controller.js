const Analytics = require("../../models/analytics.model");
const { analyticsPeriod } = require("../../utils/analyticsPeriod");

const PUBLIC_EVENTS = new Set([
  "PAGE_VIEW",
  "ARTICLE_VIEW",
  "BLOG_VIEW",
  "VIDEO_VIEW",
  "SEARCH",
  "COMMENT_SUBMITTED",
  "CAREER_APPLICATION_SUBMITTED",
  "INVESTOR_APPLICATION_SUBMITTED",
]);

const PANEL_EVENTS = new Set([
  "PANEL_PAGE_VIEW",
  "CONTENT_CREATED",
  "CONTENT_EDITED",
  "CONTENT_SUBMITTED",
  "CONTENT_APPROVED",
  "CONTENT_REJECTED",
  "COMMENT_MODERATED",
  "WITHDRAWAL_REQUESTED",
  "TEAM_MEMBER_UPDATED",
  "TOP_CONTENT_VIEWED",
]);

const ignoredPathPatterns = [
  /^\/_next\//,
  /^\/api\//,
  /^\/favicon/,
  /^\/robots\.txt$/,
  /^\/sitemap/,
];

function isBot(req) {
  const userAgent = String(req.get("user-agent") || "");

  return /bot|crawler|spider|slurp|headless/i.test(userAgent);
}

const recordEvent = async (req, res) => {
  try {
    const {
      eventName,
      path,
      contentType,
      contentId,
      surface,
    } = req.body || {};

    if (!["PUBLIC", "PANEL"].includes(surface)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics surface",
      });
    }

    const allowedEvents =
      surface === "PUBLIC" ? PUBLIC_EVENTS : PANEL_EVENTS;

    if (!allowedEvents.has(eventName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics event",
      });
    }

    if (surface === "PANEL" && !req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      isBot(req) ||
      ignoredPathPatterns.some((pattern) =>
        pattern.test(String(path || ""))
      )
    ) {
      return res.status(202).json({
        success: true,
        ignored: true,
      });
    }

    await Analytics.recordEvent({
      siteId: Number(req.user?.siteId || req.site?.id || 1),
      visitorId: req.analytics.visitorId,
      sessionId: req.analytics.sessionId,
      userId: req.user?.userId || null,
      actorRole: req.user?.role || null,
      surface,
      eventName,
      path: String(path || "").slice(0, 500),
      contentType: contentType || null,
      contentId: Number(contentId) || null,
    });

    return res.status(202).json({ success: true });
  } catch (error) {
    console.error("Record analytics event error:", error);

    return res.status(500).json({
      success: false,
      message: "Analytics event could not be recorded",
    });
  }
};

const getOverview = async (req, res) => {
  try {
    const { period, ...filter } = analyticsPeriod(req.query.period);

    const requestedSiteId =
      req.user.role === "ADMIN"
        ? Number(
            req.query.siteId ||
              req.get("x-management-site-id") ||
              req.user.siteId
          )
        : Number(req.user.siteId);

    const overview = await Analytics.getOverview({
      siteId: requestedSiteId,
      ...filter,
    });

    return res.json({
      success: true,
      period,
      ...overview,
    });
  } catch (error) {
    console.error("Analytics overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Analytics overview could not be loaded",
    });
  }
};

const getRetention = async (req, res) => {
  try {
    const siteId = req.user.role === "ADMIN"
      ? Number(req.query.siteId || req.get("x-management-site-id") || req.user.siteId)
      : Number(req.user.siteId);
    if (!Number.isInteger(siteId) || siteId <= 0) return res.status(400).json({ success: false, message: "Invalid website" });
    const retention = await Analytics.getRetention({ siteId });
    return res.json({ success: true, surface: "PUBLIC", timezone: "Asia/Kolkata", retention });
  } catch (error) {
    console.error("Retention analytics error:", error);
    return res.status(500).json({ success: false, message: "Retention analytics could not be loaded" });
  }
};

module.exports = {
  getRetention,
  recordEvent,
  getOverview,
};
