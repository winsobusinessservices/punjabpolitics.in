const crypto = require("crypto");
const pool = require("../config/db");

const VISITOR_COOKIE = "ir_visitor_id";
const SESSION_COOKIE = "ir_session_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cookieSameSite = (
  process.env.COOKIE_SAME_SITE || "lax"
).toLowerCase();

const baseCookieOptions = {
  httpOnly: true,
  secure:
    process.env.NODE_ENV === "production" ||
    cookieSameSite === "none",
  sameSite: cookieSameSite,
  ...(process.env.COOKIE_DOMAIN
    ? { domain: process.env.COOKIE_DOMAIN }
    : {}),
};

async function resolveAnalyticsIdentity(req, res, next) {
  try {
    let visitorId = req.cookies?.[VISITOR_COOKIE];

    if (!UUID_PATTERN.test(String(visitorId || ""))) {
      visitorId = crypto.randomUUID();

      res.cookie(VISITOR_COOKIE, visitorId, {
        ...baseCookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }

    let sessionId = req.cookies?.[SESSION_COOKIE];

    if (!UUID_PATTERN.test(String(sessionId || ""))) {
      sessionId = crypto.randomUUID();
    }

    // Refresh the 30-minute session cookie after each event.
    res.cookie(SESSION_COOKIE, sessionId, {
      ...baseCookieOptions,
      maxAge: 30 * 60 * 1000,
    });

    const userId = req.user?.userId || null;

    await pool.query(
      `INSERT INTO analytics_visitors
        (visitor_id, linked_user_id, first_seen_at, last_seen_at, linked_at)
       VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(),
         CASE WHEN ? IS NULL THEN NULL ELSE UTC_TIMESTAMP() END)
       ON DUPLICATE KEY UPDATE
         last_seen_at = UTC_TIMESTAMP(),
         linked_user_id = COALESCE(VALUES(linked_user_id), linked_user_id),
         linked_at = CASE
           WHEN VALUES(linked_user_id) IS NULL THEN linked_at
           ELSE UTC_TIMESTAMP()
         END`,
      [visitorId, userId, userId]
    );

    req.analytics = {
      visitorId,
      sessionId,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  resolveAnalyticsIdentity,
  baseCookieOptions,
  VISITOR_COOKIE,
  SESSION_COOKIE,
};