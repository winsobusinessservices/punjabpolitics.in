"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { analyticsApi } from "@/lib/api";

const MIN_INTERVAL_MS = 60 * 1000;

// Records signed-in panel activity (throttled) for the team-activity reports. Renders nothing.
export default function PanelAnalyticsTracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastSent.current < MIN_INTERVAL_MS) return;
    lastSent.current = now;
    analyticsApi.track("PANEL_PAGE_VIEW", pathname);
  }, [pathname, user]);

  return null;
}
