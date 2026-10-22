const crypto = require("crypto");
const pool = require("../config/db");
const { webpush, isConfigured } = require("../config/webPush");

class PushError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PushError";
    this.status = status;
  }
}

/*
 * A push endpoint is an address chosen by the browser, and later THIS SERVER sends a request to it. If any
 * address were accepted, someone could make the server send requests to places it should never reach.
 * So only the real push services of the browsers are accepted. PUSH_EXTRA_ENDPOINT_HOSTS (comma separated)
 * adds more, for testing only.
 */
const PUSH_SERVICE_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/, // Chrome, Edge, Brave, Opera, Samsung Internet
  /(^|\.)android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)notify\.windows\.com$/, // older Edge / Windows
  /(^|\.)push\.apple\.com$/, // Safari
];

function isAllowedPushHost(hostname) {
  const extra = String(process.env.PUSH_EXTRA_ENDPOINT_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return PUSH_SERVICE_HOSTS.some((pattern) => pattern.test(hostname)) || extra.includes(hostname);
}

const hashEndpoint = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex");

function cleanTopics(topics) {
  if (topics === undefined) return [];
  if (!Array.isArray(topics) || topics.length > 20 || topics.some((topic) => typeof topic !== "string" || topic.trim().length === 0 || topic.length > 80)) {
    throw new PushError("Invalid notification topics");
  }
  return [...new Set(topics.map((topic) => topic.trim().toLowerCase()))];
}

/** Saves (or refreshes) a browser's subscription. userId comes from the verified sign-in, never from the request body. */
async function saveSubscription({ subscription, topics }, { userId = null, visitorId = null, siteId = 1 } = {}) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof authKey !== "string" || !endpoint || !p256dh || !authKey) {
    throw new PushError("Invalid push subscription");
  }
  if (endpoint.length > 2000 || p256dh.length > 255 || authKey.length > 255) throw new PushError("Invalid push subscription");

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new PushError("Invalid subscription endpoint");
  }
  if (parsed.protocol !== "https:" || !isAllowedPushHost(parsed.hostname.toLowerCase())) throw new PushError("Invalid subscription endpoint");

  const cleaned = cleanTopics(topics);
  await pool.execute(
    `INSERT INTO web_push_subscriptions (user_id, visitor_id, site_id, endpoint, endpoint_hash, p256dh, auth_key, topics, is_active, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
     ON DUPLICATE KEY UPDATE
       user_id = COALESCE(VALUES(user_id), user_id),
       visitor_id = COALESCE(VALUES(visitor_id), visitor_id),
       site_id = VALUES(site_id),
       p256dh = VALUES(p256dh),
       auth_key = VALUES(auth_key),
       topics = VALUES(topics),
       is_active = 1,
       failure_count = 0`,
    [userId, visitorId, siteId, endpoint, hashEndpoint(endpoint), p256dh, authKey, JSON.stringify(cleaned)]
  );
  return { topics: cleaned };
}

/** The browser turned notifications off: stop sending to it. */
async function removeSubscription(endpoint) {
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > 2000) throw new PushError("Invalid push subscription");
  const [result] = await pool.execute("UPDATE web_push_subscriptions SET is_active = 0 WHERE endpoint_hash = ?", [hashEndpoint(endpoint)]);
  return { removed: result.affectedRows > 0 };
}

const MAX_FAILURES = 5; // switched off after this many failures in a row (other than "gone")

/**
 * Sends one notification to the given subscription rows.
 * payload: { title, body, url }. Returns { sent, removed, failed }.
 * A subscription the push service reports as gone (404 / 410) is switched off at once.
 */
async function sendToRows(rows, payload, options = {}) {
  if (!isConfigured()) throw new PushError("Web Push is not set up on the server (VAPID keys).", 503);
  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/" });
  const result = { sent: 0, removed: 0, failed: 0, sentIds: [] };

  for (let start = 0; start < rows.length; start += 20) {
    await Promise.all(rows.slice(start, start + 20).map(async (row) => {
      const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } };
      try {
        await webpush.sendNotification(subscription, body, { TTL: options.ttl ?? 3600, urgency: options.urgency || "normal" });
        result.sent += 1;
        result.sentIds.push(row.id);
        await pool.execute("UPDATE web_push_subscriptions SET failure_count = 0, last_success_at = NOW() WHERE id = ?", [row.id]);
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          result.removed += 1;
          await pool.execute("UPDATE web_push_subscriptions SET is_active = 0 WHERE id = ?", [row.id]);
        } else {
          result.failed += 1;
          await pool.execute("UPDATE web_push_subscriptions SET failure_count = failure_count + 1, is_active = IF(failure_count + 1 >= ?, 0, is_active) WHERE id = ?", [MAX_FAILURES, row.id]);
        }
      }
    }));
  }
  return result;
}

const activeRows = async (where, params) => (await pool.execute(`SELECT id, endpoint, p256dh, auth_key FROM web_push_subscriptions WHERE is_active = 1 AND ${where}`, params))[0];

const sendToUser = async (userId, payload) => sendToRows(await activeRows("user_id = ?", [userId]), payload);
const sendToTopic = async (topic, payload, siteId = 1) => sendToRows(await activeRows("site_id = ? AND JSON_CONTAINS(topics, JSON_QUOTE(?))", [siteId, String(topic).toLowerCase()]), payload);
const sendToAll = async (payload, siteId = 1) => sendToRows(await activeRows("site_id = ?", [siteId]), payload);

module.exports = { PushError, saveSubscription, removeSubscription, sendToRows, sendToUser, sendToTopic, sendToAll, activeRows, isAllowedPushHost };
