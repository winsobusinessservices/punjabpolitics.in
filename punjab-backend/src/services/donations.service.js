const crypto = require("crypto");
const Donation = require("../models/donation.model");
const { MIN_RUPEES, MAX_RUPEES, PRESETS, providerName } = require("../config/donationConfig");
const { getProvider, getProviderByName } = require("./donationProviders");

/*
 * Support (donations): one-time or monthly, paid through the gateway.
 *
 *   startDonation    validates the form, asks the gateway for an order (or a monthly subscription), records a CREATED
 *                    donation and returns what the browser needs to open the payment window.
 *   confirmDonation  the browser reports a finished payment; its signature is verified before it counts as paid.
 *   applyGatewayEvent the gateway's webhook also settles it (and records every later monthly charge), so a closed
 *                    tab is fine. A donation turns PAID exactly once, whichever of confirm / webhook comes first.
 */

class DonationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "DonationError";
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const firstNameOf = (name) => String(name || "").trim().split(/\s+/)[0] || "";

function getSupportConfig() {
  const provider = getProvider();
  return {
    enabled: Boolean(provider && provider.isConfigured()),
    provider: providerName(),
    presets: PRESETS,
    minAmount: MIN_RUPEES,
    maxAmount: MAX_RUPEES,
    monthlyEnabled: true,
    publicKey: provider ? provider.publicKey() : null,
  };
}

async function sendReceipt(row) {
  try {
    const { sendDonationReceiptEmail } = require("./nodemailer.service");
    await sendDonationReceiptEmail({ to: row.email, name: row.name, amountPaise: row.amount_paise, kind: row.kind, receiptNumber: row.receipt_number, paidAt: row.paid_at });
  } catch (error) {
    console.error("Donation receipt email failed:", error.message); // the donation itself is already recorded
  }
}

async function settle(row, paymentId) {
  const changed = await Donation.markPaid(row.id, paymentId);
  const fresh = await Donation.findByPublicId(row.public_id);
  if (changed) await sendReceipt(fresh);
  return { donation: fresh, newlyPaid: changed };
}

/** @param input { name, email, phone, message, showOnWall, consent, amount, kind }  @param identity { siteId, userId? } */
async function startDonation(input, identity) {
  await Donation.expireStale().catch((error) => console.error("Closing old unfinished donations failed:", error.message));
  const provider = getProvider();
  if (!provider || !provider.isConfigured()) throw new DonationError("Contributions are not open right now. Please try again later.", 503);

  const name = String(input.name || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(input.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  const message = String(input.message || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const kind = input.kind === "MONTHLY" ? "MONTHLY" : "ONE_TIME";
  const rupees = Number(input.amount);
  if (!name) throw new DonationError("Please enter your name.");
  if (!EMAIL_PATTERN.test(email)) throw new DonationError("Please enter a valid email address. Your receipt is sent there.");
  if (phone && !/^\+?\d{10,15}$/.test(phone)) throw new DonationError("Please enter a valid phone number, or leave it empty.");
  if (!Number.isInteger(rupees) || rupees < MIN_RUPEES || rupees > MAX_RUPEES) {
    throw new DonationError(`Please choose a whole amount from ₹${MIN_RUPEES.toLocaleString("en-IN")} to ₹${MAX_RUPEES.toLocaleString("en-IN")}.`);
  }
  if (input.consent !== true) throw new DonationError("Please confirm that you have read the Privacy Policy.");

  const amountPaise = rupees * 100;
  const publicId = crypto.randomUUID();
  const notes = { donation: publicId, site: String(identity.siteId), kind };

  let orderId = null;
  let subscriptionId = null;
  if (kind === "MONTHLY") {
    ({ subscriptionId } = await provider.createSubscription({ amountPaise, notes }));
  } else {
    ({ orderId } = await provider.createOrder({ amountPaise, receipt: publicId.slice(0, 40), notes }));
  }
  await Donation.create({
    publicId, siteId: identity.siteId, userId: identity.userId || null, name, email, phone, message,
    showOnWall: input.showOnWall === true, kind, amountPaise, provider: provider.name, orderId, subscriptionId,
  });

  return {
    donation: { publicId, kind, amountPaise },
    checkout: { provider: provider.name, publicKey: provider.publicKey(), orderId, subscriptionId, amountPaise, currency: "INR", prefill: { name, email, contact: phone || undefined } },
  };
}

/** The browser reports a finished payment. The signature must verify against OUR stored order / subscription. */
async function confirmDonation(publicId, payment) {
  const row = await Donation.findByPublicId(publicId);
  if (!row) throw new DonationError("Contribution not found.", 404);
  if (row.status === "PAID") return { donation: row, newlyPaid: false };
  if (!["CREATED", "FAILED", "EXPIRED"].includes(row.status)) throw new DonationError("This payment can no longer be confirmed.", 409);

  const provider = getProviderByName(row.provider);
  if (!provider) throw new DonationError("This payment can no longer be verified.", 409);
  const paymentId = String(payment?.paymentId || "");
  const signature = String(payment?.signature || "");
  const verified = row.kind === "MONTHLY"
    ? provider.verifySubscriptionPayment({ subscriptionId: row.provider_subscription_id, paymentId, signature })
    : provider.verifyPayment({ orderId: row.provider_order_id, paymentId, signature });
  if (!verified) throw new DonationError("The payment could not be verified. If money was taken, it will be recorded automatically shortly.", 400);
  return settle(row, paymentId);
}

// The gateway's events. Returns true when the event belonged to a Support donation.
async function applyGatewayEvent(providerNameValue, event) {
  switch (event.kind) {
    case "paid": {
      const row = (await Donation.findByOrderId(providerNameValue, event.orderId)) || (await Donation.findByPaymentId(providerNameValue, event.paymentId));
      if (!row) return false;
      await settle(row, event.paymentId);
      return true;
    }
    case "charged": {
      // A monthly charge: the first one settles the first row, every later one becomes a new row.
      const root = await Donation.findSubscriptionRoot(providerNameValue, event.subscriptionId);
      if (!root) return false;
      if (await Donation.findByPaymentId(providerNameValue, event.paymentId)) return true; // already recorded
      if (["CREATED", "FAILED", "EXPIRED"].includes(root.status) && !root.provider_payment_id) {
        await settle(root, event.paymentId);
        return true;
      }
      const id = await Donation.addMonthlyCharge(root, event.paymentId, event.amountPaise);
      if (id) await sendReceipt(await Donation.findById(id));
      return true;
    }
    case "failed": {
      const row = await Donation.findByOrderId(providerNameValue, event.orderId);
      if (!row) return false;
      await Donation.markFailed(row.id);
      return true;
    }
    case "refunded": {
      const row = await Donation.findByPaymentId(providerNameValue, event.paymentId);
      if (!row) return false;
      await Donation.markRefunded(row.id);
      return true;
    }
    case "subscription_ended": {
      const root = await Donation.findSubscriptionRoot(providerNameValue, event.subscriptionId);
      if (!root) return false;
      await Donation.endSubscription(providerNameValue, event.subscriptionId);
      return true;
    }
    default:
      return false;
  }
}

// The thank-you page's check. Knowing the donation's random id is the only access it needs.
async function publicStatus(publicId) {
  const row = await Donation.findByPublicId(publicId);
  if (!row) return null;
  return {
    publicId: row.public_id, status: row.status, kind: row.kind, amountPaise: row.amount_paise,
    firstName: firstNameOf(row.name), receiptNumber: row.receipt_number,
  };
}

/** A signed-in donor stops their own monthly contribution. */
async function stopMonthly(publicId, userId) {
  const row = await Donation.findByPublicId(publicId);
  if (!row || !userId || Number(row.user_id) !== Number(userId)) throw new DonationError("Contribution not found.", 404);
  if (row.kind !== "MONTHLY" || !row.provider_subscription_id) throw new DonationError("This is not a monthly contribution.", 400);
  if (row.subscription_ended_at) return { alreadyStopped: true };
  const provider = getProviderByName(row.provider);
  if (!provider) throw new DonationError("This contribution can no longer be changed here. Please contact us.", 409);
  await provider.cancelSubscription(row.provider_subscription_id);
  await Donation.endSubscription(row.provider, row.provider_subscription_id);
  return { alreadyStopped: false };
}

async function listMine(userId) {
  const rows = await Donation.listForUser(userId);
  return rows.map((row) => ({
    publicId: row.public_id, kind: row.kind, amountPaise: row.amount_paise, status: row.status, paidAt: row.paid_at,
    receiptNumber: row.receipt_number, monthlyActive: row.kind === "MONTHLY" && !row.subscription_ended_at && row.status === "PAID" && !row.parent_id,
  }));
}

module.exports = { DonationError, getSupportConfig, startDonation, confirmDonation, applyGatewayEvent, publicStatus, stopMonthly, listMine };
