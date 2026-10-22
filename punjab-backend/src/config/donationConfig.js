// Online payments (Support donations and Premium subscriptions).
//   DONATIONS_PROVIDER=razorpay   real payments (needs RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET)
//   DONATIONS_PROVIDER=test       no gateway: the website shows a "Simulate payment" button (never in production)
//
// Support page amounts (rupees):
//   DONATION_PRESETS   quick-pick amounts, comma separated        (default 100,500,1000,2500)
//   DONATION_MIN_RUPEES / DONATION_MAX_RUPEES   allowed range     (default 10 to 100000)
const SUPPORTED = ["razorpay", "test"];

function providerName() {
  const name = String(process.env.DONATIONS_PROVIDER || "").trim().toLowerCase();
  return SUPPORTED.includes(name) ? name : "test";
}

const wholeRupees = (value, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const MIN_RUPEES = wholeRupees(process.env.DONATION_MIN_RUPEES, 10);
const MAX_RUPEES = Math.max(MIN_RUPEES, wholeRupees(process.env.DONATION_MAX_RUPEES, 100000));
const PRESETS = String(process.env.DONATION_PRESETS || "100,500,1000,2500")
  .split(",")
  .map((value) => wholeRupees(value, 0))
  .filter((value) => value >= MIN_RUPEES && value <= MAX_RUPEES)
  .slice(0, 6);

module.exports = {
  providerName,
  SUPPORTED,
  MIN_RUPEES,
  MAX_RUPEES,
  PRESETS: PRESETS.length ? PRESETS : [MIN_RUPEES],
};
