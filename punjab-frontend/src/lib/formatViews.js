export function formatViews(value) {
  const views = Math.max(0, Number(value) || 0);
  if (views < 1000) return `${views} views`;
  if (views < 1_000_000) {
    return `${(views / 1000).toFixed(views < 10_000 ? 1 : 0).replace(/\.0$/, "")}K views`;
  }
  return `${(views / 1_000_000).toFixed(views < 10_000_000 ? 1 : 0).replace(/\.0$/, "")}M views`;
}
