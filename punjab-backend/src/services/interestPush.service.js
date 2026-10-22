const pool = require("../config/db");
const push = require("./webPush.service");
const { isConfigured } = require("../config/webPush");
const { TOPICS } = require("../config/preferenceOptions");
const { regionsInText } = require("../config/regions");
const { slugify } = require("../utils/slugify");

/*
 * Interest-based browser notifications.
 *
 * WHO is told: a reader who, in the "My interests" survey, ticked the notification consent AND chose "Browser
 * notification", and whose answers match the item. Their browser is found through the account (signed in) or the
 * browser's visitor id (visitors).
 *
 * WHAT is announced: a newly published article, blog or video, a newly added upcoming election, event or rally, and
 * new election results.
 *
 * HOW OFTEN: never more than 3 a day to one person, and the same item is never sent to the same browser twice.
 * "Only breaking updates" readers get only breaking items; "Weekly" readers get at most 3 a week.
 *
 * A small checker (startInterestPushScheduler) looks every few minutes for items that are new, so it works however
 * an item was published: editor approval, bulk approval, scheduled publishing, or an admin edit.
 */

const DAILY_LIMIT = 3;
const WEEKLY_LIMIT = 3;
const RECENT_HOURS = 6; // content published longer ago than this is no longer "new"
const DEFAULT_SEND_FROM_HOUR = 12; // notifications are sent from 12:00 PM India time (an admin can change it)
const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_REF = "__baseline__";

// ---------------------------------------------------------------- reading an item

const TOPIC_RULES = [
  ["lok-sabha", /\blok\s*sabha\b|\bloksabha\b/],
  ["rajya-sabha", /\brajya\s*sabha\b|\brajyasabha\b/],
  ["vidhan-sabha", /\bvidhan\s*sabha\b|\bvidhansabha\b|\bassembly\b/],
  ["elections", /\belections?\b|\bpolls?\b|\bpolling\b|\bresults?\b|\bvot(e|es|ing|ers?)\b|\bmanifesto\b/],
  ["rallies", /\brall(y|ies)\b/],
  ["speeches", /\bspeech(es)?\b|\bbhashan\b/],
  ["politicians", /\bpoliticians?\b/],
  ["chief-ministers", /\bchief\s*ministers?\b/],
  ["parties", /\bpolitical\s*parties\b/],
  ["parliament", /\bparliament(ary)?\b|\bsession\b/],
  ["events", /\bevents?\b|\bcalendar\b/],
];
const TOPIC_LABEL = Object.fromEntries(TOPICS.map((topic) => [topic.key, topic.label]));

/** The survey topics a piece of text is about. */
function topicsFromText(text) {
  const lower = String(text || "").toLowerCase();
  return new Set(TOPIC_RULES.filter(([, pattern]) => pattern.test(lower)).map(([key]) => key));
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The parties (by slug) named in a piece of text, by abbreviation or full name. */
function partiesFromText(text, parties) {
  const lower = String(text || "").toLowerCase();
  const found = new Set();
  for (const party of parties) {
    const abbreviation = String(party.abbreviation || "").trim().toLowerCase();
    const name = String(party.name || "").trim().toLowerCase();
    if ((abbreviation.length >= 2 && new RegExp(`(^|[^a-z0-9])${escapeRegex(abbreviation)}($|[^a-z0-9])`).test(lower)) || (name.length >= 4 && lower.includes(name))) found.add(party.slug);
  }
  return found;
}

const isBreaking = (text) => /\b(breaking|live)\b/i.test(String(text || ""));

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};

// A link inside this website stays a path; anything else falls back to a page of ours.
function internalPath(link, fallback) {
  const value = String(link || "").trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    const ours = String(process.env.CLIENT_ORIGIN || "").split(",").map((origin) => { try { return new URL(origin.trim()).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean);
    if (ours.includes(url.hostname.replace(/^www\./, ""))) return url.pathname + url.search;
  } catch { /* not a link */ }
  return fallback;
}

const truncate = (text, max) => { const value = String(text || "").trim(); return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value; };

function topicLabelOf(topics) {
  const first = TOPICS.find((topic) => topics.has(topic.key));
  return first ? first.label : "";
}

// ---------------------------------------------------------------- the items

const CONTENT_SOURCES = [
  { kind: "article", table: "articles", type: "articles", label: "New article", columns: "t.id, t.slug, t.title, t.category, t.tags, t.state", path: (row) => `/news/${row.slug}` },
  { kind: "blog", table: "blogs", type: "blogs", label: "New blog", columns: "t.id, t.slug, t.title, t.category, t.tags", path: (row) => `/news/${row.slug}` },
  { kind: "video", table: "videos", type: "videos", label: "New video", columns: "t.id, t.title, t.category, t.tags, t.state", path: () => "/videos" },
];

function contentItem(source, row, parties, siteId) {
  const labels = [row.category, ...asList(row.categories), ...asList(row.tags)].filter(Boolean).join(" | ");
  const wider = `${labels} | ${row.title}`;
  const topics = topicsFromText(labels);
  const regions = regionsInText(`${wider} | ${row.state || ""}`);
  const contentTypes = [source.type];
  if (source.kind === "video" && /press\s*conference/i.test(labels)) contentTypes.push("press-conferences");
  return {
    siteId, kind: source.kind, ref: String(row.id),
    title: truncate(row.title, 100),
    body: truncate(`${source.label}${topicLabelOf(topics) ? ` · ${topicLabelOf(topics)}` : ""}`, 140),
    url: source.path(row),
    topics, regions, parties: partiesFromText(wider, parties), contentTypes,
    breaking: isBreaking(labels),
  };
}

const WIDGET_SOURCES = [
  {
    kind: "election", widget: "upcoming_elections",
    build: (entry, parties) => ({
      title: truncate(`Upcoming: ${entry.title}`, 100), body: truncate(entry.date ? `Election on ${entry.date}` : "Upcoming election", 140),
      url: internalPath(entry.link, "/upcoming-elections"), topics: new Set(["elections", ...topicsFromText(entry.title)]),
      regions: regionsInText(entry.title), parties: partiesFromText(entry.title, parties),
    }),
    // only elections that have not happened yet
    isNew: (entry, today) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") && entry.date >= today,
  },
  {
    kind: "event", widget: "political_calendar",
    build: (entry, parties) => ({
      title: truncate(`Upcoming event: ${entry.title}`, 100), body: truncate(entry.date || "Political calendar", 140),
      url: internalPath(entry.link, "/political-calendar"), topics: new Set(["events", ...topicsFromText(entry.title)]),
      regions: regionsInText(entry.title), parties: partiesFromText(entry.title, parties),
    }),
  },
  {
    kind: "rally", widget: "political_rallys",
    build: (entry, parties) => ({
      title: truncate(`Upcoming rally: ${entry.title}`, 100), body: truncate(entry.date || "Political rallies", 140),
      url: internalPath(entry.link, "/political-rallies"), topics: new Set(["rallies", ...topicsFromText(entry.title)]),
      regions: regionsInText(entry.title), parties: partiesFromText(entry.title, parties),
    }),
  },
  {
    kind: "result", widget: "election_results",
    build: (entry, parties) => ({
      title: truncate(`Election result: ${entry.party || "Party"}${entry.seats !== undefined ? ` ${entry.seats} seats` : ""}${entry.state ? ` in ${entry.state}` : ""}`, 100),
      body: truncate(entry.change ? `Change: ${entry.change}` : "Election results", 140),
      url: "/elections", topics: new Set(["elections"]),
      regions: regionsInText(entry.state), parties: partiesFromText(entry.party, parties),
    }),
  },
];

// ---------------------------------------------------------------- who matches

const intersects = (set, list) => list.some((value) => set.has(value));

/**
 * Does this item fit what the reader said they follow?
 *  - what they follow = topics and parties; where = regions ("All of India" means no regional filter);
 *  - they must have picked topics, parties or a region (nothing else tells us what they like);
 *  - if they chose content types, an article / blog / video must be one of them.
 * A region only narrows things when topics or parties were chosen too; national items (no state) still count then.
 * A reader who picked only regions gets only items that are about those regions.
 */
function matchesInterest(item, prefs) {
  const topics = asList(prefs.topics);
  const parties = asList(prefs.parties);
  const regions = asList(prefs.regions).filter((region) => region !== "all-india");
  const types = asList(prefs.content_types);

  if (types.length && item.contentTypes && !item.contentTypes.some((type) => types.includes(type))) return false;
  const hasWhat = topics.length > 0 || parties.length > 0;
  if (!hasWhat && regions.length === 0) return false;
  if (hasWhat && !(intersects(item.topics, topics) || intersects(item.parties, parties))) return false;
  if (regions.length === 0) return true;
  return hasWhat ? item.regions.size === 0 || intersects(item.regions, regions) : intersects(item.regions, regions);
}

/** Midnight (India time) that started today, as a moment in time. */
function startOfDayIst(now = Date.now()) {
  const offset = 5.5 * 60 * 60 * 1000;
  const shifted = new Date(now + offset);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offset);
}

/** The hour of the day (0-23) it is now in India. */
function hourInIst(now = Date.now()) {
  return new Date(now + 5.5 * 60 * 60 * 1000).getUTCHours();
}

/** Readers who agreed to browser notifications and whose answers fit the item (before the daily limit). */
async function interestedSubscribers(item) {
  const [rows] = await pool.query(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth_key, p.topics, p.regions, p.parties, p.content_types, p.channels, p.frequency
       FROM web_push_subscriptions s
       JOIN user_preferences p
         ON ((s.user_id IS NOT NULL AND p.user_id = s.user_id) OR (s.visitor_id IS NOT NULL AND p.visitor_id = s.visitor_id))
      WHERE s.is_active = 1 AND s.site_id = ? AND p.site_id = ? AND p.notify_consent = 1`,
    [item.siteId, item.siteId]
  );
  const byId = new Map();
  for (const row of rows) {
    if (byId.has(row.id)) continue;
    if (!asList(row.channels).includes("browser")) continue;
    if (!matchesInterest(item, row)) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

/**
 * Tells the interested readers about one item, within the limits. Returns what happened.
 * dryRun: only counts who would be told (nothing is sent or recorded).
 */
async function dispatch(item, { dryRun = false, now = Date.now() } = {}) {
  const candidates = await interestedSubscribers(item);
  const outcome = { matched: candidates.length, alreadyTold: 0, limited: 0, notBreaking: 0, sent: 0, removed: 0, failed: 0 };
  let targets = candidates;

  if (targets.length) {
    const ids = targets.map((row) => row.id);
    const [told] = await pool.query("SELECT subscription_id FROM push_notification_log WHERE kind = ? AND ref = ? AND subscription_id IN (?)", [item.kind, item.ref, ids]);
    const toldIds = new Set(told.map((row) => row.subscription_id));
    outcome.alreadyTold = toldIds.size;
    targets = targets.filter((row) => !toldIds.has(row.id));
  }
  if (targets.length) {
    const dayStart = startOfDayIst(now);
    const weekStart = new Date(now - 7 * DAY_MS);
    const [counts] = await pool.query(
      "SELECT subscription_id, SUM(sent_at >= ?) AS today, COUNT(*) AS week FROM push_notification_log WHERE sent_at >= ? AND subscription_id IN (?) GROUP BY subscription_id",
      [dayStart, weekStart, targets.map((row) => row.id)]
    );
    const usage = new Map(counts.map((row) => [row.subscription_id, { today: Number(row.today), week: Number(row.week) }]));
    targets = targets.filter((row) => {
      if (row.frequency === "breaking" && !item.breaking) { outcome.notBreaking += 1; return false; }
      const used = usage.get(row.id) || { today: 0, week: 0 };
      if (used.today >= DAILY_LIMIT || (row.frequency === "weekly" && used.week >= WEEKLY_LIMIT)) { outcome.limited += 1; return false; }
      return true;
    });
  }

  if (dryRun || !targets.length) return { ...outcome, wouldSend: targets.length };

  const result = await push.sendToRows(targets, { title: item.title, body: item.body, url: item.url });
  outcome.sent = result.sent; outcome.removed = result.removed; outcome.failed = result.failed;
  if (result.sentIds.length) {
    await pool.query(
      "INSERT IGNORE INTO push_notification_log (subscription_id, kind, ref, title, sent_at) VALUES ?",
      [result.sentIds.map((id) => [id, item.kind, item.ref, item.title, new Date(now)])]
    );
  }
  return outcome;
}

// ---------------------------------------------------------------- the email channel

/**
 * Readers who agreed to notifications and chose "Email". A signed-in reader is written to at their account
 * address; a visitor at the address they gave in the survey. The same interest matching and the same limits
 * (3 a day, weekly readers 3 a week, "breaking" readers only breaking items) apply as for browser notifications.
 */
async function emailRecipients(item) {
  const [rows] = await pool.query(
    `SELECT p.id, p.user_id, p.topics, p.regions, p.parties, p.content_types, p.channels, p.frequency, p.email AS pref_email,
            u.email AS user_email, u.name AS user_name, u.status AS user_status
       FROM user_preferences p LEFT JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
      WHERE p.site_id = ? AND p.notify_consent = 1 AND JSON_CONTAINS(p.channels, '"email"')`,
    [item.siteId]
  );
  return rows
    .filter((row) => !row.user_id || row.user_status === "ACTIVE")
    .map((row) => ({ ...row, to: String((row.user_id ? row.user_email : row.pref_email) || "").trim().toLowerCase(), name: row.user_name || "" }))
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.to) && matchesInterest(item, row));
}

async function dispatchEmail(item, { dryRun = false, now = Date.now() } = {}) {
  const { sendInterestEmail } = require("./nodemailer.service");
  const outcome = { emailMatched: 0, emailAlreadyTold: 0, emailLimited: 0, emailNotBreaking: 0, emailSent: 0, emailFailed: 0 };
  let targets = await emailRecipients(item);
  outcome.emailMatched = targets.length;
  if (targets.length) {
    const ids = targets.map((row) => row.id);
    const [told] = await pool.query("SELECT preference_id FROM interest_email_log WHERE kind = ? AND ref = ? AND preference_id IN (?)", [item.kind, item.ref, ids]);
    const toldIds = new Set(told.map((row) => row.preference_id));
    outcome.emailAlreadyTold = toldIds.size;
    targets = targets.filter((row) => !toldIds.has(row.id));
  }
  if (targets.length) {
    const [counts] = await pool.query(
      "SELECT preference_id, SUM(sent_at >= ?) AS today, COUNT(*) AS week FROM interest_email_log WHERE sent_at >= ? AND preference_id IN (?) GROUP BY preference_id",
      [startOfDayIst(now), new Date(now - 7 * DAY_MS), targets.map((row) => row.id)]
    );
    const usage = new Map(counts.map((row) => [row.preference_id, { today: Number(row.today), week: Number(row.week) }]));
    targets = targets.filter((row) => {
      if (row.frequency === "breaking" && !item.breaking) { outcome.emailNotBreaking += 1; return false; }
      const used = usage.get(row.id) || { today: 0, week: 0 };
      if (used.today >= DAILY_LIMIT || (row.frequency === "weekly" && used.week >= WEEKLY_LIMIT)) { outcome.emailLimited += 1; return false; }
      return true;
    });
  }
  if (dryRun) return { ...outcome, emailWouldSend: targets.length };

  for (let start = 0; start < targets.length; start += 5) {
    await Promise.all(targets.slice(start, start + 5).map(async (row) => {
      try {
        await sendInterestEmail({ to: row.to, name: row.name, title: item.title, body: item.body, url: item.url });
        await pool.query("INSERT IGNORE INTO interest_email_log (preference_id, kind, ref, title, sent_at) VALUES (?, ?, ?, ?, ?)", [row.id, item.kind, item.ref, item.title, new Date(now)]);
        outcome.emailSent += 1;
      } catch (error) {
        outcome.emailFailed += 1;
        console.error("Interest email failed:", error.message);
      }
    }));
  }
  return outcome;
}

// ---------------------------------------------------------------- finding what is new

const siteParties = async (siteId) => (await pool.query("SELECT slug, name, abbreviation FROM parties WHERE site_id = ? AND deleted_at IS NULL", [siteId]))[0];

const markHandled = (siteId, kind, refs) => refs.length ? pool.query("INSERT IGNORE INTO push_dispatched_items (site_id, kind, ref) VALUES ?", [refs.map((ref) => [siteId, kind, ref])]) : null;

// The first time a kind is looked at for a website, everything that already exists is recorded as "handled", so
// switching this on never sends a flood of old items. Returns true when that is what just happened.
async function baselineIfFirstRun(siteId, kind, existingRefs, dryRun) {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM push_dispatched_items WHERE site_id = ? AND kind = ?", [siteId, kind]);
  if (n > 0) return false;
  if (!dryRun) await markHandled(siteId, kind, [BASELINE_REF, ...existingRefs]);
  return true;
}

async function handledAmong(siteId, kind, refs) {
  if (!refs.length) return new Set();
  const [rows] = await pool.query("SELECT ref FROM push_dispatched_items WHERE site_id = ? AND kind = ? AND ref IN (?)", [siteId, kind, refs]);
  return new Set(rows.map((row) => row.ref));
}

async function newContentItems(siteId, parties, { dryRun, lookbackHours = RECENT_HOURS }) {
  const items = [];
  for (const source of CONTENT_SOURCES) {
    const published = "t.site_id = ? AND t.status = 'APPROVED' AND t.deleted_at IS NULL AND COALESCE(t.published_at, t.created_at) <= NOW()";
    const [all] = await pool.query(`SELECT t.id FROM ${source.table} t WHERE ${published}`, [siteId]);
    if (await baselineIfFirstRun(siteId, source.kind, all.map((row) => String(row.id)), dryRun)) continue;

    const [recent] = await pool.query(
      `SELECT ${source.columns} FROM ${source.table} t WHERE ${published} AND COALESCE(t.published_at, t.created_at) >= (NOW() - INTERVAL ? HOUR) ORDER BY COALESCE(t.published_at, t.created_at)`,
      [siteId, lookbackHours]
    );
    const handled = await handledAmong(siteId, source.kind, recent.map((row) => String(row.id)));
    for (const row of recent) if (!handled.has(String(row.id))) items.push(contentItem(source, row, parties, siteId));
  }
  return items;
}

const refOf = (entry) => String(entry.id ?? `${entry.title}|${entry.date}`);

async function newWidgetItems(siteId, parties, { dryRun, now }) {
  const items = [];
  const today = new Date(now + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10); // today's date in India
  for (const source of WIDGET_SOURCES) {
    const [rows] = await pool.query("SELECT data FROM home_widgets WHERE site_id = ? AND widget_key = ?", [siteId, source.widget]);
    const entries = asList(rows[0]?.data).filter((entry) => entry && typeof entry === "object");
    if (await baselineIfFirstRun(siteId, source.kind, entries.map(refOf), dryRun)) continue;
    const handled = await handledAmong(siteId, source.kind, entries.map(refOf));
    for (const entry of entries) {
      if (handled.has(refOf(entry)) || (source.isNew && !source.isNew(entry, today))) continue;
      items.push({ siteId, kind: source.kind, ref: refOf(entry), contentTypes: null, breaking: false, ...source.build(entry, parties) });
    }
  }
  return items;
}

// ---------------------------------------------------------------- the admin on/off switch

/** Is the automatic interest-based notification sending on for this website? (No saved choice = on.) */
async function isInterestPushEnabled(siteId) {
  const [rows] = await pool.query("SELECT enabled FROM interest_push_settings WHERE site_id = ?", [siteId]);
  return rows.length === 0 || Boolean(rows[0].enabled);
}

/** The switch, who last changed it, and a few live numbers for the admin page. */
async function getInterestPushSettings(siteId, now = Date.now()) {
  const dayStart = startOfDayIst(now);
  const [[saved], [browsers], [eligible], [today]] = await Promise.all([
    pool.query("SELECT s.enabled, s.send_from_hour, s.updated_at, u.name AS updated_by_name FROM interest_push_settings s LEFT JOIN users u ON u.id = s.updated_by WHERE s.site_id = ?", [siteId]),
    pool.query("SELECT COUNT(*) AS n FROM web_push_subscriptions WHERE site_id = ? AND is_active = 1", [siteId]),
    pool.query(
      `SELECT COUNT(DISTINCT s.id) AS n FROM web_push_subscriptions s
         JOIN user_preferences p ON ((s.user_id IS NOT NULL AND p.user_id = s.user_id) OR (s.visitor_id IS NOT NULL AND p.visitor_id = s.visitor_id))
        WHERE s.is_active = 1 AND s.site_id = ? AND p.site_id = ? AND p.notify_consent = 1 AND JSON_CONTAINS(p.channels, '"browser"')`,
      [siteId, siteId]
    ),
    pool.query(
      "SELECT COUNT(*) AS sent, COUNT(DISTINCT l.subscription_id) AS people FROM push_notification_log l JOIN web_push_subscriptions s ON s.id = l.subscription_id WHERE s.site_id = ? AND l.sent_at >= ?",
      [siteId, dayStart]
    ),
  ]);
  return {
    sendFromHour: saved.length ? Number(saved[0].send_from_hour) : DEFAULT_SEND_FROM_HOUR,
    enabled: saved.length === 0 || Boolean(saved[0].enabled),
    updatedAt: saved[0]?.updated_at || null,
    updatedByName: saved[0]?.updated_by_name || null,
    dailyLimit: DAILY_LIMIT,
    activeBrowsers: Number(browsers[0].n),
    eligibleBrowsers: Number(eligible[0].n),
    sentToday: Number(today[0].sent),
    peopleToday: Number(today[0].people),
    configured: isConfigured(),
  };
}

/** From which hour of the day (India time) notifications are sent. No saved choice = 12 (noon). 0 = any time. */
async function getSendFromHour(siteId) {
  const [rows] = await pool.query("SELECT send_from_hour FROM interest_push_settings WHERE site_id = ?", [siteId]);
  return rows.length ? Number(rows[0].send_from_hour) : DEFAULT_SEND_FROM_HOUR;
}

async function setSendFromHour(siteId, hour, userId) {
  await pool.query(
    `INSERT INTO interest_push_settings (site_id, send_from_hour, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE send_from_hour = VALUES(send_from_hour), updated_by = VALUES(updated_by)`,
    [siteId, hour, userId || null]
  );
  return getInterestPushSettings(siteId);
}

async function setInterestPushEnabled(siteId, enabled, userId) {
  await pool.query(
    `INSERT INTO interest_push_settings (site_id, enabled, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by = VALUES(updated_by)`,
    [siteId, enabled ? 1 : 0, userId || null]
  );
  return getInterestPushSettings(siteId);
}

let running = false;

/**
 * Looks for new items and tells the interested readers. Safe to run as often as you like.
 * Options: siteIds (default: every active website), dryRun (count only: sends and records nothing).
 */
async function scanForInterestPush({ siteIds, dryRun = false, now = Date.now() } = {}) {
  if (running) return { skipped: "A check is already running." };
  running = true;
  try {
    const sites = siteIds || (await pool.query("SELECT id FROM sites WHERE status = 'ACTIVE'"))[0].map((row) => row.id);
    const report = [];
    for (const siteId of sites) {
      const parties = await siteParties(siteId);
      // Before the send-from hour nothing is sent and nothing is marked as handled, so what appears in the
      // morning is held and goes out once the hour comes. The lookback then covers everything since midnight.
      const sendFromHour = await getSendFromHour(siteId);
      const tooEarly = hourInIst(now) < sendFromHour;
      // While items are being held (before the hour) and in the hours right after it (catching up), "new" means
      // anything published today, so the whole morning goes out at the hour. Later in the day it is the usual few hours.
      const hourNow = hourInIst(now);
      const catchingUp = sendFromHour > 0 && (tooEarly || hourNow < sendFromHour + RECENT_HOURS);
      const sinceMidnightHours = Math.ceil((now - startOfDayIst(now).getTime()) / (60 * 60 * 1000));
      const lookbackHours = catchingUp ? Math.max(RECENT_HOURS, sinceMidnightHours) : RECENT_HOURS;
      const items = [...(await newContentItems(siteId, parties, { dryRun, lookbackHours })), ...(await newWidgetItems(siteId, parties, { dryRun, now }))];
      const enabled = await isInterestPushEnabled(siteId);
      for (const item of items) {
        if (tooEarly) {
          const preview = dryRun ? await dispatch(item, { dryRun, now }) : { matched: 0, sent: 0, removed: 0, failed: 0, alreadyTold: 0, limited: 0, notBreaking: 0 };
          report.push({ siteId, kind: item.kind, ref: item.ref, title: item.title, ...preview, held: true, sendFromHour });
          continue;
        }
        // Switched off by an admin: the item is still marked as handled, but nobody is told about it,
        // so switching it back on never sends a pile of items from the time it was off.
        if (!enabled && !dryRun) {
          await markHandled(siteId, item.kind, [item.ref]);
          report.push({ siteId, kind: item.kind, ref: item.ref, title: item.title, paused: true, matched: 0, sent: 0, removed: 0, failed: 0, alreadyTold: 0, limited: 0, notBreaking: 0 });
          continue;
        }
        const outcome = { ...(await dispatch(item, { dryRun, now })), ...(await dispatchEmail(item, { dryRun, now })) };
        if (!dryRun) await markHandled(siteId, item.kind, [item.ref]);
        report.push({ siteId, kind: item.kind, ref: item.ref, title: item.title, ...outcome, ...(enabled ? {} : { paused: true }) });
      }
    }
    return { items: report };
  } finally {
    running = false;
  }
}

/**
 * Built into the server: checks every 5 minutes. Turn it off with INTEREST_PUSH_SCHEDULER=off (for example
 * if you run scripts/sendInterestPush.js from cron instead).
 */
function startInterestPushScheduler() {
  if (String(process.env.INTEREST_PUSH_SCHEDULER || "").toLowerCase() === "off") {
    console.log("Interest notifications scheduler is off (INTEREST_PUSH_SCHEDULER=off).");
    return null;
  }

  const check = async () => {
    try {
      const result = await scanForInterestPush();
      const sent = (result.items || []).reduce((sum, item) => sum + (item.sent || 0), 0);
      if (sent) console.log(`Interest notifications: ${sent} sent about ${(result.items || []).filter((item) => item.sent).length} item(s).`);
    } catch (error) {
      console.error("Interest notifications check failed:", error.message); // tried again at the next check
    }
  };
  const timer = setInterval(check, 5 * 60 * 1000);
  timer.unref();
  setTimeout(check, 60 * 1000).unref();
  console.log("Interest notifications scheduler on: new items are checked every 5 minutes.");
  return timer;
}

module.exports = {
  DAILY_LIMIT, WEEKLY_LIMIT, topicsFromText, partiesFromText, matchesInterest, startOfDayIst, internalPath, isBreaking,
  dispatch, dispatchEmail, scanForInterestPush, startInterestPushScheduler, isInterestPushEnabled, getInterestPushSettings, setInterestPushEnabled, getSendFromHour, setSendFromHour, hourInIst, DEFAULT_SEND_FROM_HOUR,
};
