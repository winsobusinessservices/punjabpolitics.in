const push = require("../../services/webPush.service");

const WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map();

// Simple per-IP limit for these public endpoints.
function limited(req, max) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= max) return true;
  attempts.set(ip, [...recent, now]);
  return false;
}

function fail(res, error, fallback) {
  if (error instanceof push.PushError) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

const saveSubscription = async (req, res) => {
  try {
    if (limited(req, 30)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const { topics } = await push.saveSubscription(req.body || {}, {
      // From the verified sign-in only (optionalAuthenticate), never from the request body.
      userId: req.user?.userId || null,
      // The browser's anonymous id: it ties this subscription to survey answers given before signing in.
      visitorId: req.analytics?.visitorId || null,
      siteId: Number(req.site?.id || 1),
    });
    return res.status(201).json({ success: true, message: "Notifications enabled.", topics });
  } catch (error) {
    return fail(res, error, "Unable to save subscription");
  }
};

const removeSubscription = async (req, res) => {
  try {
    if (limited(req, 60)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const { removed } = await push.removeSubscription(req.body?.endpoint);
    return res.status(200).json({ success: true, removed, message: "Notifications turned off." });
  } catch (error) {
    return fail(res, error, "Unable to turn notifications off");
  }
};

module.exports = { saveSubscription, removeSubscription };
