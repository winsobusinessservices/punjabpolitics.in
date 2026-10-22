// The crown that marks Premium-only stories and the Premium menu item.
//   variant="overlay"  a pill for the corner of a card image (put it inside a `relative` box)
//   variant="inline"   a small crown with text, for rows of metadata
//   variant="icon"     just the crown
export default function PremiumBadge({ variant = "inline", className = "" }) {
  if (variant === "icon") {
    return <i className={`fa-solid fa-crown text-secondary ${className}`} role="img" aria-label="Premium" title="Premium" />;
  }
  if (variant === "overlay") {
    return (
      <span
        title="Premium story"
        className={`pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-label-sm text-[10px] font-bold uppercase tracking-wider text-on-secondary shadow ${className}`}
      >
        <i className="fa-solid fa-crown text-[9px]" aria-hidden="true" /> Premium
      </span>
    );
  }
  return (
    <span title="Premium story" className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary ${className}`}>
      <i className="fa-solid fa-crown text-[9px]" aria-hidden="true" /> Premium
    </span>
  );
}
