// Which stories are for subscribers only. A story is premium when its author marked it (premium_type) OR when it
// belongs to a category an admin made "subscribers only" (then its kind is "premium_category").

const norm = (value) => String(value ?? "").trim().toLowerCase();

/** A Set of lower-case category names from the list the Category model returns. */
const premiumNameSet = (names) => new Set((names || []).map(norm).filter(Boolean));

/** The kind of premium story a row is ("exclusive_analysis", ..., "premium_category"), or null when it is free. */
function premiumKind(row, premiumNames) {
  if (row.premium_type) return row.premium_type;
  if (!premiumNames || premiumNames.size === 0) return null;
  const categories = [row.category, ...(Array.isArray(row.categories) ? row.categories : [])];
  return categories.some((name) => premiumNames.has(norm(name))) ? "premium_category" : null;
}

/** The same rows, with premium_type filled in for stories that are premium only because of their category. */
const withPremium = (rows, premiumNames) => rows.map((row) => ({ ...row, premium_type: premiumKind(row, premiumNames) }));

module.exports = { premiumNameSet, premiumKind, withPremium };
