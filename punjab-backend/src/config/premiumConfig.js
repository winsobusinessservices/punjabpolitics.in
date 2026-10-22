// Settings for the Premium subscription (one month of Premium, paid once; there is no automatic renewal).
//
//   PREMIUM_PRICE_RUPEES  price of one month (default 199)
//   PREMIUM_DAYS          how long one purchase lasts (default 30)
// Payments use the same gateway as Support (DONATIONS_PROVIDER, see donationConfig.js).

const PRICE_RUPEES = Math.max(1, Number(process.env.PREMIUM_PRICE_RUPEES) || 199);
const DAYS = Math.max(1, Math.round(Number(process.env.PREMIUM_DAYS) || 30));

// What an author can mark an article as. null / empty = free for everyone.
const PREMIUM_TYPES = [
  { key: "premium_article", label: "Premium article" },
  { key: "exclusive_analysis", label: "Exclusive political analysis" },
  { key: "election_analysis", label: "Premium election analysis" },
  { key: "special_report", label: "Special report" },
  // { key: "category_exclusive", label: "Category exclusive" },
];
const PREMIUM_TYPE_KEYS = PREMIUM_TYPES.map((type) => type.key);

// The value that gets saved: a known key, or null (free).
const normalizePremiumType = (value) => {
  const key = String(value || "").trim();
  return PREMIUM_TYPE_KEYS.includes(key) ? key : null;
};

// What the subscription page shows until an admin changes it (Panel > Subscription plans).
// "free" is the fixed Free card. "paid" are the cards people can buy (1 to MAX_PAID_PLANS); every one of them unlocks
// all premium stories, they differ in price and length (for example Monthly and Yearly).
const DEFAULT_PLANS = {
  free: {
    name: "Free",
    tagline: "Everything you need to follow Indian politics every day.",
    features: [
      "Latest news, top stories and breaking updates",
      "Free articles, blogs and videos in full",
      "Politician, party and Vidhan Sabha profiles",
      "Personal alerts with My Interests",
      "Comments and a free account",
    ],
    notIncluded: ["Ad-free experience", "Exclusive political analysis & reports", "Premium election analysis"],
    ctaLabel: "Keep reading for free",
  },
  paid: [
    {
      id: "premium",
      name: "Premium",
      tagline: "Deeper analysis and a clean, ad-free reading experience.",
      features: [
        "Everything in the Free plan",
        "Ad-free experience on every page",
        "Exclusive political analysis & reports",
        "Premium election analysis",
        "Every premium story in full, as soon as it is published",
      ],
      notIncluded: [],
      ctaLabel: "Get Premium",
      priceRupees: PRICE_RUPEES,
      days: DAYS,
      recommended: true,
    },
  ],
};

const MAX_PRICE_RUPEES = 100000;
const MAX_DAYS = 366;
const MAX_FEATURES = 10;
const MAX_PAID_PLANS = 4;

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (value, max, itemMax) => (Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/)).map((item) => text(item, itemMax)).filter(Boolean).slice(0, max);
const newPlanId = () => "plan-" + require("crypto").randomBytes(4).toString("hex");

// Older saved settings had one "premium" card; it is the first (and only) paid card now.
function normalizeStored(saved) {
  if (!saved) return saved;
  if (!Array.isArray(saved.paid) && saved.premium) return { free: saved.free, paid: [{ id: "premium", recommended: true, ...saved.premium }] };
  return saved;
}

/**
 * Checks what an admin sends and returns the clean plans, or { error } with a sentence for the admin.
 * A card left out of the request is removed; a field left out of a card keeps its current value (matched by id).
 */
function cleanPlans(input, current) {
  const free = cleanCard(input?.free, current.free, "The Free card");
  if (free.error) return free;

  const given = Array.isArray(input?.paid) ? input.paid : current.paid;
  if (given.length < 1) return { error: "Keep at least one Premium card so people can subscribe." };
  if (given.length > MAX_PAID_PLANS) return { error: `You can have up to ${MAX_PAID_PLANS} Premium cards.` };

  const paid = [];
  const usedIds = new Set();
  let recommendedSeen = false;
  for (const [index, item] of given.entries()) {
    const existing = current.paid.find((plan) => plan.id === item?.id);
    const label = `Premium card ${index + 1}`;
    const card = cleanCard(item, existing || {}, label);
    if (card.error) return card;
    const price = Number(item?.priceRupees ?? existing?.priceRupees);
    const days = Number(item?.days ?? existing?.days);
    if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE_RUPEES) return { error: `${label}: the price must be a whole number of rupees from 1 to ${MAX_PRICE_RUPEES.toLocaleString("en-IN")}.` };
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { error: `${label}: the length must be a whole number of days from 1 to ${MAX_DAYS}.` };
    let id = /^[a-z0-9-]{1,40}$/.test(String(item?.id || "")) ? item.id : newPlanId();
    while (usedIds.has(id)) id = newPlanId();
    usedIds.add(id);
    const recommended = !recommendedSeen && Boolean(item?.recommended ?? existing?.recommended);
    recommendedSeen = recommendedSeen || recommended;
    paid.push({ id, ...card.card, priceRupees: price, days, recommended });
  }
  return { plans: { free: free.card, paid } };
}

function cleanCard(given = {}, base = {}, label) {
  const card = {
    name: text(given.name ?? base.name, 40),
    tagline: text(given.tagline ?? base.tagline, 200),
    features: list(given.features ?? base.features, MAX_FEATURES, 120),
    notIncluded: list(given.notIncluded ?? base.notIncluded, MAX_FEATURES, 120),
    ctaLabel: text(given.ctaLabel ?? base.ctaLabel, 30),
  };
  if (!card.name) return { error: `${label} needs a name.` };
  if (!card.ctaLabel) return { error: `${label} needs button text.` };
  if (!card.features.length) return { error: `${label} needs at least one feature.` };
  return { card };
}

module.exports = { PRICE_RUPEES, DAYS, PREMIUM_TYPES, PREMIUM_TYPE_KEYS, normalizePremiumType, DEFAULT_PLANS, MAX_PAID_PLANS, cleanPlans, normalizeStored };
