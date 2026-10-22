// The parts of India a reader can follow in the "My interests" survey, and a way to find which of them a piece of
// text is about (used to match new stories with readers' interests).
//   "all-india" is not a place: it means "no regional filter".
const { slugify } = require("../utils/slugify");

// [label, extra names the text may use instead]
const PLACES = [
  ["Andhra Pradesh"], ["Arunachal Pradesh"], ["Assam"], ["Bihar", ["Patna"]], ["Chhattisgarh"], ["Goa"], ["Gujarat"],
  ["Haryana"], ["Himachal Pradesh"], ["Jharkhand", ["Ranchi"]], ["Karnataka", ["Bengaluru", "Bangalore"]], ["Kerala"],
  ["Madhya Pradesh"], ["Maharashtra", ["Mumbai"]], ["Manipur"], ["Meghalaya"], ["Mizoram"], ["Nagaland"], ["Odisha"],
  ["Punjab"], ["Rajasthan"], ["Sikkim"], ["Tamil Nadu"], ["Telangana", ["Hyderabad"]], ["Tripura"],
  ["Uttar Pradesh", ["Lucknow"]], ["Uttarakhand"], ["West Bengal", ["Kolkata"]],
  ["Delhi", ["New Delhi", "NCT of Delhi"]], ["Jammu and Kashmir", ["J&K", "Kashmir"]], ["Ladakh"], ["Puducherry", ["Pondicherry"]],
  ["Chandigarh"], ["Andaman and Nicobar Islands"], ["Lakshadweep"], ["Dadra and Nagar Haveli and Daman and Diu"],
];

const REGIONS = [
  { key: "all-india", label: "All of India" },
  ...PLACES.map(([label]) => ({ key: slugify(label), label })),
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MATCHERS = PLACES.map(([label, aliases = []]) => ({
  key: slugify(label),
  pattern: new RegExp(`(^|[^a-z0-9])(${[label, ...aliases].map((name) => escapeRegex(name.toLowerCase())).join("|")})($|[^a-z0-9])`),
}));

/** The region keys (state / union territory slugs) a piece of text mentions. */
function regionsInText(text) {
  const lower = String(text || "").toLowerCase();
  return new Set(MATCHERS.filter(({ pattern }) => pattern.test(lower)).map(({ key }) => key));
}

module.exports = { REGIONS, regionsInText };
