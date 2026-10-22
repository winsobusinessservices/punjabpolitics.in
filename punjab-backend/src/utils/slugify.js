function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Appends -2, -3, ... until `exists(candidate)` (an async slug -> boolean
// check against the table) returns false, so slugs stay unique per table.
async function uniqueSlug(title, exists) {
  const base = slugify(title) || "post";
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
