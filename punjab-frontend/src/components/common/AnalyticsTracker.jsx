"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsApi } from "@/lib/api";

const MIN_INTERVAL_MS = 60 * 1000;

// Records one public activity ping per visit (throttled), feeding the daily
// active-user and retention reports. Renders nothing.
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastSent = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastSent.current < MIN_INTERVAL_MS) return;
    lastSent.current = now;
    analyticsApi.track("PAGE_VIEW", pathname);
  }, [pathname]);

  return null;
}
