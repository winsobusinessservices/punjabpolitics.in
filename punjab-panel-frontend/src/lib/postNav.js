// Where a post-detail action (View's "Back", Edit's post-save redirect)
// returns to — My Content, Review Queue, or Content History — depending on
// which list the user came from. Carried as a `?from=` query param rather
// than router.back(), since a hard refresh or a shared link has no browser
// history to go back to. Shared between ViewPostClient and EditPostClient so
// the two stay in sync as new "from" sources are added.
export const BACK_TARGETS = {
  history: { href: "/author/history", label: "Back to Content History" },
  review: { href: "/author/review", label: "Back to Review Queue" },
};
export const DEFAULT_BACK_TARGET = { href: "/author/content", label: "Back to My Content" };

export function resolveBackTarget(fromParam) {
  return BACK_TARGETS[fromParam] || DEFAULT_BACK_TARGET;
}
