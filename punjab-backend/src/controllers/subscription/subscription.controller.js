const Subscription = require("../../models/subscription.model");
const subscriptions = require("../../services/subscription.services");
const { PREMIUM_TYPES } = require("../../config/premiumConfig");
const { getProvider } = require("../../services/donationProviders");
const donations = require("../../services/donations.service");

const WINDOW_MS = 60 * 60 * 1000;
const attemptsByIp = new Map();

// Simple per-IP limit for the public endpoints (the Support form uses the same idea).
function limited(req, key, max) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const bucket = `${key}:${ip}`;
  const now = Date.now();
  const recent = (attemptsByIp.get(bucket) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= max) return true;
  attemptsByIp.set(bucket, [...recent, now]);
  return false;
}

function fail(res, error, fallback) {
  if (error instanceof subscriptions.SubscriptionError || error?.name === "DonationProviderError") {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

const siteIdOf = (req) => Number(req.site?.id || 1);

// What the subscription page needs: is it open, the price, how long it lasts, and the public gateway key.
async function getConfig(req, res) {
  try {
    return res.status(200).json({ success: true, config: { ...(await subscriptions.getPublicConfig(siteIdOf(req))), types: PREMIUM_TYPES } });
  } catch (error) {
    return fail(res, error, "Subscription settings could not be loaded.");
  }
}

// Admin: the cards and price as saved (and who last changed them).
async function getAdminPlans(req, res) {
  try {
    return res.status(200).json({ success: true, ...(await subscriptions.getPlans(siteIdOf(req))) });
  } catch (error) {
    return fail(res, error, "The subscription plans could not be loaded.");
  }
}

// Admin: change the cards and/or the price.
async function updateAdminPlans(req, res) {
  try {
    const result = await subscriptions.savePlans(siteIdOf(req), req.body?.plans || {}, req.user.userId);
    return res.status(200).json({ success: true, message: "The subscription plans were saved. The page and new purchases use them right away.", ...result });
  } catch (error) {
    return fail(res, error, "The subscription plans could not be saved.");
  }
}

// Is the signed-in reader Premium, until when, and their past purchases.
async function getMine(req, res) {
  try {
    const [status, history] = await Promise.all([Subscription.statusForUser(req.user.userId), Subscription.listForUser(req.user.userId)]);
    return res.status(200).json({
      success: true,
      premium: status,
      history: history.map((row) => ({
        publicId: row.public_id, status: row.status, amountPaise: row.amount_paise, days: row.days,
        startsAt: row.starts_at, endsAt: row.ends_at, paidAt: row.paid_at, receiptNumber: row.receipt_number,
      })),
    });
  } catch (error) {
    return fail(res, error, "Your subscription could not be loaded.");
  }
}

async function startSubscription(req, res) {
  try {
    // Hidden field only bots fill: look successful, create nothing.
    if (String(req.body?.website || "").trim()) return res.status(201).json({ success: true, subscription: { publicId: "ignored" }, checkout: null });
    if (limited(req, "premium-start", 15)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const result = await subscriptions.startSubscription(req.body || {}, { siteId: siteIdOf(req), userId: req.user.userId });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return fail(res, error, "The subscription could not be started. Please try again.");
  }
}

async function confirmSubscription(req, res) {
  try {
    if (limited(req, "premium-confirm", 30)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const { subscription, newlyPaid } = await subscriptions.confirmSubscription(
      req.params.publicId,
      { paymentId: req.body?.paymentId, signature: req.body?.signature },
      req.user.userId
    );
    return res.status(200).json({ success: true, status: subscription.status, receiptNumber: subscription.receipt_number, endsAt: subscription.ends_at, newlyPaid });
  } catch (error) {
    return fail(res, error, "The payment could not be confirmed. Please contact us if money was taken.");
  }
}

async function getSubscriptionStatus(req, res) {
  try {
    const status = await subscriptions.publicStatus(req.params.publicId, req.user.userId);
    if (!status) return res.status(404).json({ success: false, message: "Subscription not found." });
    return res.status(200).json({ success: true, subscription: status });
  } catch (error) {
    return fail(res, error, "The subscription could not be loaded.");
  }
}

// Admin: totals and the list of purchases.
async function adminList(req, res) {
  try {
    const siteId = siteIdOf(req);
    await Subscription.expireStale().catch(() => {});
    const status = ["CREATED", "PAID", "FAILED", "EXPIRED", "REFUNDED"].includes(req.query.status) ? req.query.status : undefined;
    const q = String(req.query.q || "").trim().slice(0, 100) || undefined;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [summary, rows] = await Promise.all([Subscription.adminSummary(siteId), Subscription.adminList(siteId, { status, q, limit, offset })]);
    return res.status(200).json({ success: true, summary, subscriptions: rows, limit, offset });
  } catch (error) {
    return fail(res, error, "Subscriptions could not be loaded.");
  }
}

// The payment gateway's webhook: it activates a purchase even if the buyer closed the tab. The signature
// is checked against the raw request body (captured in server.js), so nothing here trusts the JSON alone.
async function webhook(req, res) {
  try {
    const provider = getProvider();
    if (!provider || provider.name === "test") return res.status(404).json({ success: false });
    const event = provider.parseWebhook(req.rawBody, String(req.get("x-razorpay-signature") || ""));
    if (!event) return res.status(400).json({ success: false, message: "Invalid signature" });
    if (event.kind !== "ignored") {
      // The same gateway address serves Premium purchases and Support donations.
      const handled = await subscriptions.applyGatewayEvent(provider.name, event);
      if (!handled) await donations.applyGatewayEvent(provider.name, event);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Subscription webhook error:", error);
    return res.status(500).json({ success: false }); // the gateway retries
  }
}

module.exports = { webhook, getConfig, getAdminPlans, updateAdminPlans, getMine, startSubscription, confirmSubscription, getSubscriptionStatus, adminList };
