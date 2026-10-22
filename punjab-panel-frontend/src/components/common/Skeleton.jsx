// Generic skeleton primitives, reusing the same `.shimmer-sweep` overlay
// ImagePlaceholder already uses for broken/loading images — here it sweeps
// over a neutral surface tone instead of a colored gradient, since these
// stand in for text/cards, not images.

export function SkeletonBlock({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-surface-container-high rounded ${className}`}>
      <span className="shimmer-sweep" aria-hidden="true" />
    </div>
  );
}

// A line of text — height/width tuned per call site via className.
export function SkeletonText({ className = "" }) {
  return <SkeletonBlock className={`h-4 rounded-sm ${className}`} />;
}

// Stands in for the breaking-news ticker + Header, since neither lives in
// the root layout — every page render includes them inline, so without this
// the area above the fold would flash blank while a route's data loads.
export function SkeletonHeaderBar() {
  return (
    <div aria-hidden="true">
      <div className="w-full h-9 bg-primary" />
      <div className="w-full border-b border-outline-variant/20 bg-surface">
        <div className="max-w-full mx-auto px-4 md:px-16 h-20 flex items-center justify-between gap-6">
          <SkeletonBlock className="h-8 w-40" />
          <div className="hidden md:flex items-center gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonText key={i} className="w-16" />
            ))}
          </div>
          <SkeletonBlock className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// A NewsCard-shaped placeholder: image + tag line + title lines.
export function SkeletonCard({ imageClassName = "aspect-video" }) {
  return (
    <div aria-hidden="true">
      <SkeletonBlock className={`w-full mb-3 ${imageClassName}`} />
      <SkeletonText className="w-1/3 mb-2 h-3" />
      <SkeletonText className="w-full mb-1.5" />
      <SkeletonText className="w-2/3" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 6, columns = "grid-cols-1 md:grid-cols-3" }) {
  return (
    <div className={`grid ${columns} gap-6`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
