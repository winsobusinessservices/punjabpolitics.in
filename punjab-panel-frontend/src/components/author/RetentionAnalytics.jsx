"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import AnalyticsHelp from "@/components/author/AnalyticsHelp";

const format = (value) => Number(value || 0).toLocaleString("en-IN");
const LABELS = { 7: "Day 7", 30: "Day 30", 90: "Day 90" };

export default function RetentionAnalytics({ siteId, refresh }) {
  const [state, setState] = useState({ key: "", rows: null, error: "" });
  const requestKey = `${siteId}:${refresh}`;

  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    analyticsApi.getRetention(siteId)
      .then((data) => active && setState({ key: requestKey, rows: data.retention || [], error: "" }))
      .catch((err) => active && setState({ key: requestKey, rows: null, error: err.message }));
    return () => { active = false; };
  }, [siteId, requestKey]);

  const current = state.key === requestKey ? state : null;

  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-surface p-5 sm:p-6">
      <h2 className="font-headline-md text-base text-on-surface">Returning visitors</h2>
      <p className="mt-1 mb-6 text-xs leading-relaxed text-on-surface-variant">Share of website visitors who came back exactly 7, 30 or 90 days after their first visit.</p>
      {!current && <div className="h-28 animate-pulse rounded-xl bg-surface-container" role="status" aria-label="Loading retention" />}
      {current?.error && <p role="alert" className="text-sm text-error">Retention could not be loaded: {current.error}</p>}
      {current?.rows && <div className="grid gap-4 sm:grid-cols-3">
        {current.rows.map((row) => <div key={row.day} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
          <p className="text-xs font-semibold text-on-surface-variant">{LABELS[row.day] || `Day ${row.day}`}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-on-surface">{row.retention_rate == null ? "—" : `${row.retention_rate}%`}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.retention_rate || 0)}%` }} /></div>
          <p className="mt-2 text-[11px] text-on-surface-variant">{row.eligible_users ? `${format(row.retained_users)} of ${format(row.eligible_users)} visitors returned` : "Not enough history yet"}</p>
        </div>)}
      </div>}
      <AnalyticsHelp>A visitor counts as retained on day N when they were active on the website exactly N days after their first visit. Only visitors whose day N has already passed are included. Days follow Indian Standard Time.</AnalyticsHelp>
    </section>
  );
}
