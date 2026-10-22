const crypto = require("crypto");
const { providerName } = require("../config/donationConfig");

class DonationProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "DonationProviderError";
    this.status = status;
  }
}

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
};
const hmacHex = (secret, payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

// ---- Razorpay ---------------------------------------------------------------------------------------------
async function razorpayCall(path, body) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Razorpay request failed:", path, error.message);
    throw new DonationProviderError("The payment service could not be reached. Please try again in a moment.", 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Razorpay rejected the request:", path, response.status, JSON.stringify(data.error || data).slice(0, 300));
    throw new DonationProviderError("The payment could not be started. Please try again later.", 502);
  }
  return data;
}

// One Razorpay plan per monthly amount (kept for the life of the process).
const planIds = new Map();

const razorpay = {
  name: "razorpay",
  isConfigured: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  publicKey: () => process.env.RAZORPAY_KEY_ID || null,

  /** Creates the gateway order the checkout window pays for. The amount is decided by our server only. */
  async createOrder({ amountPaise, receipt, notes }) {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    let response;
    try {
      response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error("Razorpay order request failed:", error.message);
      throw new DonationProviderError("The payment service could not be reached. Please try again in a moment.", 503);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
      console.error("Razorpay rejected the order:", response.status, JSON.stringify(data.error || data).slice(0, 300));
      throw new DonationProviderError("The payment could not be started. Please try again later.", 502);
    }
    return { orderId: data.id };
  },

  /** A monthly contribution: a Razorpay subscription on a plan for this amount. Returns { subscriptionId }. */
  async createSubscription({ amountPaise, notes }) {
    let planId = planIds.get(amountPaise);
    if (!planId) {
      const plan = await razorpayCall("/plans", { period: "monthly", interval: 1, item: { name: `Monthly support Rs ${amountPaise / 100}`, amount: amountPaise, currency: "INR" } });
      planId = plan.id;
      planIds.set(amountPaise, planId);
    }
    const subscription = await razorpayCall("/subscriptions", { plan_id: planId, total_count: 120, customer_notify: 1, notes });
    return { subscriptionId: subscription.id };
  },

  /** Subscription payment proof: signature = HMAC_SHA256(secret, "<payment_id>|<subscription_id>"). */
  verifySubscriptionPayment({ subscriptionId, paymentId, signature }) {
    if (!subscriptionId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
    return safeEqual(hmacHex(process.env.RAZORPAY_KEY_SECRET, `${paymentId}|${subscriptionId}`), signature);
  },

  /** Stops the monthly charges right away. */
  async cancelSubscription(subscriptionId) {
    await razorpayCall(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: 0 });
  },

  /** The browser's payment proof: signature = HMAC_SHA256(secret, "<order_id>|<payment_id>"). */
  verifyPayment({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
    return safeEqual(hmacHex(process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
  },

  /** Checks the webhook's signature against the raw request body and turns the event into a simple shape. */
  parseWebhook(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !rawBody || !safeEqual(hmacHex(secret, rawBody), signature)) return null;
    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return null;
    }
    const payment = event.payload?.payment?.entity || {};
    const order = event.payload?.order?.entity || {};
    const refund = event.payload?.refund?.entity || {};
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        return { kind: "paid", orderId: payment.order_id || order.id, paymentId: payment.id };
      case "payment.failed":
        return { kind: "failed", orderId: payment.order_id, paymentId: payment.id };
      case "subscription.charged": {
        const subscription = event.payload?.subscription?.entity || {};
        return { kind: "charged", subscriptionId: subscription.id, paymentId: payment.id, amountPaise: Number(payment.amount) || null };
      }
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.halted":
        return { kind: "subscription_ended", subscriptionId: (event.payload?.subscription?.entity || {}).id };
      case "refund.processed":
      case "payment.refunded":
        return { kind: "refunded", paymentId: refund.payment_id || payment.id };
      default:
        return { kind: "ignored" };
    }
  },
};

// ---- Test mode (no gateway; never available in production) -------------------------------------------------
const testProvider = {
  name: "test",
  isConfigured: () => process.env.NODE_ENV !== "production",
  publicKey: () => null,
  async createOrder({ receipt }) {
    return { orderId: `order_test_${receipt}` };
  },
  verifyPayment({ signature }) {
    return signature === "TEST_OK";
  },
  async createSubscription({ notes }) {
    return { subscriptionId: `sub_test_${String(notes?.donation || Date.now()).slice(0, 30)}` };
  },
  verifySubscriptionPayment({ signature }) {
    return signature === "TEST_OK";
  },
  async cancelSubscription() {},
  parseWebhook() {
    return null;
  },
};

const PROVIDERS = { razorpay, test: testProvider };
const getProvider = () => PROVIDERS[providerName()] || null;
const getProviderByName = (name) => PROVIDERS[String(name || "").toLowerCase()] || null;

module.exports = { getProvider, getProviderByName, DonationProviderError };
