const crypto = require("crypto");
const Subscription = require("../models/subscription.model");
const { DEFAULT_PLANS, cleanPlans, normalizeStored } = require("../config/premiumConfig");
const { providerName } = require("../config/donationConfig");
const { getProvider, getProviderByName } = require("./donationProviders");

/*
 * Premium: one month, paid once (no automatic renewal).
 *
 *   startSubscription    validates the form, asks the gateway for an order, records a CREATED purchase and
 *                        returns what the browser needs to open the payment window.
 *   confirmSubscription  the browser reports a finished payment; its signature is verified before the month starts.
 *   applyGatewayEvent    the gateway's webhook (routed here by donations.service) also activates it, so a closed tab is fine.
 * A purchase turns PAID exactly once, whichever of confirm / webhook arrives first.
 */

class SubscriptionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SubscriptionError";
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The two cards, the price and the length: what an admin saved, over the defaults. */
async function getPlans(siteId) {
  const saved = await Subscription.getPlansRow(siteId);
  const merged = cleanPlans(normalizeStored(saved?.plans) || {}, DEFAULT_PLANS);
  return { plans: merged.plans || DEFAULT_PLANS, updatedAt: saved?.updatedAt || null, updatedByName: saved?.updatedByName || null };
}

/** An admin changes the cards / price. Returns { plans } or throws SubscriptionError with the reason. */
async function savePlans(siteId, input, userId) {
  const current = (await getPlans(siteId)).plans;
  const { plans, error } = cleanPlans(input, current);
  if (error) throw new SubscriptionError(error);
  await Subscription.savePlans(siteId, plans, userId);
  return getPlans(siteId);
}

async function getPublicConfig(siteId) {
  const provider = getProvider();
  const { plans } = await getPlans(siteId);
  return {
    enabled: Boolean(provider && provider.isConfigured()),
    provider: providerName(),
    plans,
    publicKey: provider ? provider.publicKey() : null,
  };
}

async function sendWelcome(row) {
  try {
    const { sendPremiumWelcomeEmail } = require("./nodemailer.service");
    await sendPremiumWelcomeEmail({ to: row.email, name: row.name, amountPaise: row.amount_paise, receiptNumber: row.receipt_number, endsAt: row.ends_at });
  } catch (error) {
    console.error("Premium welcome email failed:", error.message); // the subscription itself is already active
  }
}

async function completePayment(row, paymentId) {
  const changed = await Subscription.markPaid(row.id, row.user_id, paymentId);
  const fresh = await Subscription.findByPublicId(row.public_id);
  if (changed) await sendWelcome(fresh);
  return { subscription: fresh, newlyPaid: changed };
}

/** @param input { name, email, phone, consent }   @param identity { siteId, userId } */
async function startSubscription(input, identity) {
  if (!identity.userId) throw new SubscriptionError("Please sign in to subscribe.", 401);
  await Subscription.expireStale().catch((error) => console.error("Closing old unfinished subscriptions failed:", error.message));
  const provider = getProvider();
  if (!provider || !provider.isConfigured()) throw new SubscriptionError("Subscriptions are not open right now. Please try again later.", 503);

  const name = String(input.name || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(input.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!name) throw new SubscriptionError("Please enter your name.");
  if (!EMAIL_PATTERN.test(email)) throw new SubscriptionError("Please enter a valid email address. Your receipt is sent there.");
  if (phone && !/^\+?\d{10,15}$/.test(phone)) throw new SubscriptionError("Please enter a valid phone number, or leave it empty.");
  if (input.consent !== true) throw new SubscriptionError("Please confirm that you have read the Privacy Policy.");

  const { plans } = await getPlans(identity.siteId);
  // Which card they chose. With a single card there is nothing to choose.
  const plan = plans.paid.length === 1 ? plans.paid[0] : plans.paid.find((item) => item.id === input.planId);
  if (!plan) throw new SubscriptionError("Please choose a plan.");
  const { priceRupees, days } = plan;
  const amountPaise = priceRupees * 100; // the price is ours, never taken from the browser
  const publicId = crypto.randomUUID();
  const { orderId } = await provider.createOrder({ amountPaise, receipt: publicId.slice(0, 40), notes: { premium: publicId, plan: plan.id, site: String(identity.siteId) } });
  await Subscription.create({ publicId, siteId: identity.siteId, userId: identity.userId, name, email, phone, planId: plan.id, planName: plan.name, amountPaise, days, provider: provider.name, orderId });

  return {
    subscription: { publicId, amountPaise, days, planName: plan.name },
    checkout: { provider: provider.name, publicKey: provider.publicKey(), orderId, amountPaise, currency: "INR", prefill: { name, email, contact: phone || undefined } },
  };
}

/** The browser reports a finished payment. Its signature must verify, and it must be the buyer's own purchase. */
async function confirmSubscription(publicId, payment, userId) {
  const row = await Subscription.findByPublicId(publicId);
  if (!row || Number(row.user_id) !== Number(userId)) throw new SubscriptionError("Subscription not found.", 404);
  if (row.status === "PAID") return { subscription: row, newlyPaid: false };
  if (!["CREATED", "FAILED", "EXPIRED"].includes(row.status)) throw new SubscriptionError("This payment can no longer be confirmed.", 409);

  const provider = getProviderByName(row.provider);
  if (!provider) throw new SubscriptionError("This payment can no longer be verified.", 409);
  const verified = provider.verifyPayment({
    orderId: row.provider_order_id, // from OUR record, never from the browser
    paymentId: String(payment?.paymentId || ""),
    signature: String(payment?.signature || ""),
  });
  if (!verified) throw new SubscriptionError("The payment could not be verified. If money was taken, your subscription will start automatically shortly.", 400);
  return completePayment(row, String(payment.paymentId));
}

// The gateway's events (called from the Support webhook handler, which already checked the signature).
// Returns true when the event belonged to a Premium purchase.
async function applyGatewayEvent(providerNameValue, event) {
  switch (event.kind) {
    case "paid": {
      const row = (await Subscription.findByOrderId(providerNameValue, event.orderId)) || (await Subscription.findByPaymentId(providerNameValue, event.paymentId));
      if (!row) return false;
      await completePayment(row, event.paymentId);
      return true;
    }
    case "failed": {
      const row = await Subscription.findByOrderId(providerNameValue, event.orderId);
      if (!row) return false;
      await Subscription.markFailed(row.id);
      return true;
    }
    case "refunded": {
      const row = await Subscription.findByPaymentId(providerNameValue, event.paymentId);
      if (!row) return false;
      await Subscription.markRefunded(row.id);
      return true;
    }
    default:
      return false;
  }
}

async function publicStatus(publicId, userId) {
  const row = await Subscription.findByPublicId(publicId);
  if (!row || Number(row.user_id) !== Number(userId)) return null;
  return { publicId: row.public_id, status: row.status, receiptNumber: row.receipt_number, endsAt: row.ends_at, amountPaise: row.amount_paise };
}

const isPremiumUser = async (userId) => (await Subscription.statusForUser(userId)).active;

module.exports = { SubscriptionError, getPlans, savePlans, getPublicConfig, startSubscription, confirmSubscription, applyGatewayEvent, publicStatus, isPremiumUser };
