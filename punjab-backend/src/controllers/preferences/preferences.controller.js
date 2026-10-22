const crypto = require("crypto");
const pool = require("../../config/db");
const UserPreferences = require("../../models/userPreferences.model");
const { TOPICS, REGIONS, CONTENT_TYPES, CHANNELS, FREQUENCIES } = require("../../config/preferenceOptions");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const keysOf = (list) => list.map((option) => option.key);

// Who is answering: the signed-in account, or - without an account - the browser's
// anonymous visitor id (set by resolveAnalyticsIdentity). The IP address is never
// used to identify anyone: it is only hashed, for spam limiting.
const identityOf = (req) => ({ userId: req.user?.userId || null, visitorId: req.analytics?.visitorId || null });

function hashIp(ip) {
  const salt = process.env.CONSENT_HASH_SALT || process.env.JWT_SECRET || "preferences";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

// Spam limit for saving: 20 saves per IP per hour.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SAVES = 20;
const savesByIp = new Map();

async function siteParties(siteId) {
  const [rows] = await pool.query(
    "SELECT slug, name, abbreviation FROM parties WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name",
    [siteId]
  );
  return rows.map((row) => ({ key: row.slug, label: row.abbreviation ? `${row.name} (${row.abbreviation})` : row.name }));
}

// Keeps only values that are real options, once each.
function pickAllowed(value, allowed, max = 50) {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return [...new Set(value.map((item) => String(item)))].filter((item) => allowedSet.has(item)).slice(0, max);
}

// The survey form: its options and this reader's saved answers (if any).
async function getMyPreferences(req, res) {
  try {
    const siteId = Number(req.site?.id || req.user?.siteId || 1);
    const [parties, preferences] = await Promise.all([siteParties(siteId), UserPreferences.findByIdentity(identityOf(req))]);
    return res.status(200).json({
      success: true,
      signedIn: Boolean(req.user),
      options: { topics: TOPICS, regions: REGIONS, parties, contentTypes: CONTENT_TYPES, channels: CHANNELS, frequencies: FREQUENCIES },
      preferences,
      completed: Boolean(preferences),
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return res.status(500).json({ success: false, message: "Your interests could not be loaded" });
  }
}

// Saves the survey answers (creating them the first time, replacing them after).
async function saveMyPreferences(req, res) {
  try {
    const identity = identityOf(req);
    if (!identity.userId && !identity.visitorId) {
      return res.status(400).json({ success: false, message: "Your browser could not be identified. Please enable cookies and try again." });
    }

    const body = req.body || {};
    // A hidden field that only bots fill in: pretend it worked and store nothing.
    if (String(body.website || "").trim()) return res.status(200).json({ success: true, message: "Thank you! Your interests were saved.", completed: true });

    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (savesByIp.get(ip) || []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= MAX_SAVES) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }
    savesByIp.set(ip, [...recent, now]);

    const siteId = Number(req.site?.id || req.user?.siteId || 1);
    const parties = await siteParties(siteId);
    const signedIn = Boolean(identity.userId);

    const data = {
      topics: pickAllowed(body.topics, keysOf(TOPICS)),
      regions: pickAllowed(body.regions, keysOf(REGIONS)),
      parties: pickAllowed(body.parties, keysOf(parties), 30),
      contentTypes: pickAllowed(body.contentTypes, keysOf(CONTENT_TYPES)),
      channels: pickAllowed(body.channels, keysOf(CHANNELS)),
      frequency: keysOf(FREQUENCIES).includes(body.frequency) ? body.frequency : "weekly",
      feedback: String(body.feedback || "").trim().slice(0, 1000),
      notifyConsent: body.notifyConsent === true,
      // Without an account there is nowhere else to find a contact, so it is asked for.
      email: signedIn ? null : String(body.email || "").trim().toLowerCase().slice(0, 254),
      phone: signedIn ? null : String(body.phone || "").replace(/[^\d+]/g, "").slice(0, 20),
      ipHash: hashIp(ip),
    };

    if (!data.topics.length && !data.regions.length && !data.parties.length && !data.contentTypes.length) {
      return res.status(400).json({ success: false, message: "Please choose at least one thing you are interested in." });
    }
    if (data.channels.length && !data.notifyConsent) {
      return res.status(400).json({ success: false, message: "Please tick the box that allows us to send you notifications, or untick the notification channels." });
    }
    if (!signedIn) {
      if (data.channels.includes("email") && !EMAIL_PATTERN.test(data.email)) {
        return res.status(400).json({ success: false, message: "Please enter your email address so we can send you updates." });
      }
      if (data.channels.includes("whatsapp") && !/^\+?\d{10,15}$/.test(data.phone)) {
        return res.status(400).json({ success: false, message: "Please enter your WhatsApp number (10 to 15 digits)." });
      }
      if (data.email && !EMAIL_PATTERN.test(data.email)) data.email = null;
      if (data.phone && !/^\+?\d{10,15}$/.test(data.phone)) data.phone = null;
    }

    const saved = await UserPreferences.save(identity, siteId, data);
    return res.status(200).json({ success: true, message: "Thank you! Your interests were saved.", preferences: saved, completed: true });
  } catch (error) {
    console.error("Save preferences error:", error);
    return res.status(500).json({ success: false, message: "Your interests could not be saved" });
  }
}

// Admin: how many readers picked each option, and their free-text feedback.
async function getPreferencesSummary(req, res) {
  try {
    const siteId = Number(req.site?.id || req.user?.siteId || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [summary, feedback, parties] = await Promise.all([
      UserPreferences.summary(siteId),
      UserPreferences.listFeedback(siteId, { limit, offset }),
      siteParties(siteId),
    ]);
    return res.status(200).json({
      success: true,
      summary,
      labels: { topics: TOPICS, regions: REGIONS, parties, contentTypes: CONTENT_TYPES, channels: CHANNELS, frequencies: FREQUENCIES },
      feedback,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Preferences summary error:", error);
    return res.status(500).json({ success: false, message: "The summary could not be loaded" });
  }
}

module.exports = { getMyPreferences, saveMyPreferences, getPreferencesSummary };
