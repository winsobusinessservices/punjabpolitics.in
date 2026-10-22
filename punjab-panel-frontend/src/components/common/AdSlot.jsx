// Demo ad creatives — fictional house promos (never a real brand), just so
// ad slots look like actual ads in the UI instead of empty gray boxes with
// their pixel dimensions printed on them. Swap for a real ad network's tag
// when one is wired up.
const DEMO_ADS = [
  {
    icon: "fa-solid fa-newspaper",
    eyebrow: "Punjab Politics Premium",
    headline: "Go Ad-Free & Unlock Deep-Dive Reports",
    body: "Support independent political journalism.",
    cta: "Try Premium",
    gradient: "from-primary to-primary-container",
  },
  {
    icon: "fa-solid fa-graduation-cap",
    eyebrow: "Civic Learning",
    headline: "Understand How Parliament Really Works",
    body: "A free 5-part video course on the legislative process.",
    cta: "Start Learning",
    gradient: "from-secondary to-secondary-container",
  },
  {
    icon: "fa-solid fa-box-ballot",
    eyebrow: "Public Service Announcement",
    headline: "Check Your Voter Registration Status",
    body: "Make sure you're ready for the next election.",
    cta: "Check Now",
    gradient: "from-surface-tint to-primary",
  },
];

function pickAd(label) {
  // Deterministic per-slot (not random — avoids a Date.now()/Math.random()
  // SSR/client hydration mismatch), but still varies across the 3 slots.
  const hash = (label || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return DEMO_ADS[hash % DEMO_ADS.length];
}

export default function AdSlot({ width, height, label, orientation = "square" }) {
  const ad = pickAd(label);

  return (
    <div className="flex flex-col items-center">
      <span className="font-label-sm text-outline-variant uppercase tracking-widest mb-1 text-[8px]">
        ADVERTISEMENT
      </span>
      <div
        className={`group w-full overflow-hidden rounded-sm bg-gradient-to-br ${ad.gradient} text-white relative cursor-pointer`}
        style={{ maxWidth: width, height }}
      >
        <span className="shimmer-sweep opacity-30" aria-hidden="true" />
        {orientation === "horizontal" ? (
          <div className="relative z-10 h-full flex items-center gap-4 px-5">
            <i className={`${ad.icon} text-2xl flex-shrink-0`} />
            <div className="flex-grow min-w-0">
              <p className="font-label-sm text-[9px] uppercase tracking-widest text-white/70 truncate">{ad.eyebrow}</p>
              <p className="font-headline-md text-sm truncate">{ad.headline}</p>
            </div>
            <span className="flex-shrink-0 font-label-sm text-[10px] uppercase tracking-wide bg-white/15 group-hover:bg-white/25 transition-colors px-3 py-1.5 rounded-sm whitespace-nowrap">
              {ad.cta}
            </span>
          </div>
        ) : orientation === "vertical" ? (
          <div className="relative z-10 h-full flex flex-col items-center text-center px-5 py-8 gap-4">
            <span className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
              <i className={`${ad.icon} text-2xl`} />
            </span>
            <div>
              <p className="font-label-sm text-[9px] uppercase tracking-widest text-white/70 mb-2">{ad.eyebrow}</p>
              <p className="font-headline-md text-base leading-snug mb-2">{ad.headline}</p>
              <p className="font-body-md text-xs text-white/80">{ad.body}</p>
            </div>
            <span className="mt-auto font-label-sm text-[10px] uppercase tracking-wide bg-white/15 group-hover:bg-white/25 transition-colors px-4 py-2 rounded-sm">
              {ad.cta}
            </span>
          </div>
        ) : (
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 gap-2">
            <i className={`${ad.icon} text-3xl mb-1`} />
            <p className="font-label-sm text-[9px] uppercase tracking-widest text-white/70">{ad.eyebrow}</p>
            <p className="font-headline-md text-base leading-snug">{ad.headline}</p>
            <p className="font-body-md text-xs text-white/80">{ad.body}</p>
            <span className="mt-2 font-label-sm text-[10px] uppercase tracking-wide bg-white/15 group-hover:bg-white/25 transition-colors px-4 py-2 rounded-sm">
              {ad.cta}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
