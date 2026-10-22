"use client";

import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-8565149254500305";

// Google AdSense unit. The adsbygoogle.js loader is included once in the root
// layout; each unit only needs its <ins> tag plus one push() after it mounts.
export default function GoogleAd({ slot, format = "autorelaxed", className = "", style }) {
  const insRef = useRef(null);

  useEffect(() => {
    // Skip units AdSense has already filled (e.g. React re-running effects in development).
    if (!insRef.current || insRef.current.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers or a not-yet-approved site make AdSense throw; the page should carry on.
    }
  }, [slot]);

  return (
    <div className={className}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-format={format}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
      />
    </div>
  );
}
