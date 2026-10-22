"use client";

import { createPortal } from "react-dom";

// A fan of 9 rotated tracks (0deg to 160deg in 20deg steps) with a ball
// bouncing down each one, staggered by 0.2s per track — recolored in
// globals.css to the site's own primary-navy brand color. Shown as a full
// screen overlay while the backend's synchronous AI grammar/language check
// runs on submit (a few seconds against Gemini), so the wait reads as
// "checking your content" rather than a frozen button.
// Rotation applied directly per element rather than via CSS :nth-child —
// tracks and rails are two separate sibling groups under the same parent
// (18 divs total), so :nth-child(2..9) counts position among ALL of them,
// not position within just .ai-loader-track or just .ai-loader-rail. That
// silently matched nothing for the rails (they're children 10-18), leaving
// every ball stacked at 0deg instead of fanned out.
const ROTATIONS_DEG = [0, 20, 40, 60, 80, 100, 120, 140, 160];

export default function AiCheckLoader({ label = "Checking your content with AI..." }) {
  const loader = (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 bg-surface/90 backdrop-blur-sm">
      {/* Every track/rail inside is `position: absolute`, which gives this
          div zero intrinsic size — without an explicit size here, flex-col's
          gap is measured from that zero-size point, not the circle that's
          actually visible (which extends symmetrically above and below it),
          so the label below ends up rendering mid-circle instead of under it. */}
      <div className="relative flex items-center justify-center" style={{ fontSize: "10px", width: "26em", height: "26em" }}>
        {ROTATIONS_DEG.map((deg, index) => (
          <div key={`track-${index}`} className="ai-loader-track" style={{ transform: `rotate(${deg}deg)` }} />
        ))}
        {ROTATIONS_DEG.map((deg, index) => (
          <div key={`rail-${index}`} className="ai-loader-rail" style={{ transform: `rotate(${deg}deg)` }}>
            <div className="ai-loader-ball" style={{ animationDelay: `${index * 0.2}s` }} />
          </div>
        ))}
      </div>
      <p className="font-label-md text-sm text-on-surface-variant animate-pulse">{label}</p>
    </div>
  );

  // The author workspace main panel creates its own stacking context. If the
  // overlay stays inside it, even a high z-index cannot cover the sidebar,
  // which is a sibling stacking context. Portaling to body makes the AI check
  // the only visible UI across the entire viewport.
  return typeof document === "undefined" ? null : createPortal(loader, document.body);
}
