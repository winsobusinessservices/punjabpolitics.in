// Premium stories: what an author can mark an article as (the same keys the server accepts).
// Empty = free for everyone.
export const PREMIUM_TYPES = [
  { key: "premium_article", label: "Premium article", hint: "A story only Premium members can read in full." },
  { key: "exclusive_analysis", label: "Exclusive political analysis", hint: "In-depth analysis that is not published anywhere else." },
  { key: "election_analysis", label: "Premium election analysis", hint: "Seat-by-seat and trend analysis for an election." },
  { key: "special_report", label: "Special report", hint: "A long-form investigation or report." },
  // { key: "category_exclusive", label: "Category exclusive", hint: "Shown under Category exclusive on the Premium page." },
];

export const premiumLabel = (key) => PREMIUM_TYPES.find((type) => type.key === key)?.label || "Premium";

// The access filter in the content lists: "" all, "free", "premium" (any kind), or one kind.
export const ACCESS_OPTIONS = [
  { value: "", label: "All access" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Any premium" },
  ...PREMIUM_TYPES.map((type) => ({ value: type.key, label: type.label })),
];

export function matchesAccess(post, access) {
  if (!access) return true;
  const type = post.premium_type || "";
  if (access === "free") return !type;
  if (access === "premium") return Boolean(type);
  return type === access;
}
