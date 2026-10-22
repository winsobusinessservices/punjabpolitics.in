"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { analyticsApi, authorApi } from "@/lib/api";
import { useAdminSite } from "@/context/AdminSiteContext";
import RetentionAnalytics from "@/components/author/RetentionAnalytics";
import AnalyticsHelp from "@/components/author/AnalyticsHelp";

const format = (value) => Number(value || 0).toLocaleString("en-IN");
const colors = ["#2563eb", "#14b8a6", "#f59e0b", "#a855f7"];
const card = "rounded-2xl border border-outline-variant/25 bg-surface p-5 sm:p-6";

function ChartCard({ title, description, help, wide = false, children }) {
  return <section className={card + (wide ? " xl:col-span-2" : "")}>
    <h2 className="font-headline-md text-base text-on-surface">{title}</h2>
    <p className="mt-1 mb-6 text-xs leading-relaxed text-on-surface-variant">{description}</p>
    {children}
    {help && <AnalyticsHelp>{help}</AnalyticsHelp>}
  </section>;
}

function EmptyChart({ text = "No activity recorded for this period." }) {
  return <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/50 p-6 text-center text-sm text-on-surface-variant">{text}</div>;
}

function Donut({ rows, label }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <EmptyChart text={`No ${label.toLowerCase()} to display yet.`} />;
  return <div className="flex flex-col items-center gap-6 sm:flex-row">
    <div className="relative h-44 w-44 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        {rows.map((row, index) => {
          const length = row.value / total * 100;
          const start = rows.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * 100;
          return <circle key={row.label} cx="60" cy="60" r="48" fill="none" stroke={row.color} strokeWidth="13" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl tabular-nums">{format(total)}</strong><span className="mt-1 text-xs text-on-surface-variant">{label}</span></div>
    </div>
    <ul className="w-full space-y-4" aria-label={label}>{rows.map((row) => <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />{row.label}</span>
      <span className="text-right tabular-nums"><strong>{format(row.value)}</strong><span className="ml-2 text-xs text-on-surface-variant">{Math.round(row.value / total * 100)}%</span></span>
    </li>)}</ul>
  </div>;
}

function Bars({ rows, vertical = false }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.some((row) => row.value)) return <EmptyChart />;
  if (vertical) return <div className="grid grid-cols-4 gap-3" aria-label="Active users by role">
    {rows.map((row) => <div key={row.label} className="min-w-0 text-center">
      <div className="flex h-40 flex-col items-center justify-end gap-2 border-b border-outline-variant/30">
        <strong className="text-sm tabular-nums">{format(row.value)}</strong>
        <div className="w-full max-w-12 rounded-t-md" style={{ height: `${row.value / max * 120}px`, background: row.color }} />
      </div>
      <p className="mt-3 break-words text-[11px] text-on-surface-variant">{row.label}</p>
    </div>)}
  </div>;
  return <div className="space-y-7 py-3">{rows.map((row) => <div key={row.label}>
    <div className="mb-2 flex justify-between gap-3 text-sm"><span>{row.label}</span><strong className="tabular-nums">{format(row.value)}</strong></div>
    <div className="h-4 overflow-hidden rounded-full bg-surface-container"><div className="h-full rounded-full" style={{ width: `${row.value / max * 100}%`, background: row.color }} /></div>
  </div>)}</div>;
}

export default function AdminAnalyticsDashboard() {
  const { user } = useAuth();
  const canViewContent = user?.role === "INVESTOR" || hasPermission(user, PERMISSIONS.CONTENT_HISTORY) || hasPermission(user, PERMISSIONS.REVIEW_CONTENT);
  const { activeSite, activeSiteId } = useAdminSite();
  const [period, setPeriod] = useState("today");
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = `${activeSiteId}:${period}:${refresh}`;

  useEffect(() => {
    if (!activeSiteId) return;
    let active = true;
    Promise.allSettled([analyticsApi.getOverview(period, activeSiteId), canViewContent ? authorApi.listAllHistory({ siteId: activeSiteId }) : Promise.resolve([])]).then(([overview, content]) => {
      if (!active) return;
      setResult({
        key: requestKey,
        updatedAt: new Date().toISOString(),
        overview: overview.status === "fulfilled" ? overview.value : null,
        error: overview.status === "rejected" ? overview.reason.message : "",
        posts: content.status === "fulfilled" ? content.value : null,
        contentError: content.status === "rejected" ? content.reason.message : "",
      });
    });
    return () => { active = false; };
  }, [activeSiteId, period, refresh, requestKey, canViewContent]);

  const current = result?.key === requestKey ? result : null;
  const overview = current?.overview;
  const isStreak = ["7d", "30d", "90d"].includes(period);
  const selectionLabel = { today: "Today", yesterday: "Yesterday", all: "All time", "7d": "7-day streak", "30d": "30-day streak", "90d": "90-day streak" }[period];
  const count = (key) => Math.max(0, Number(overview?.[key]) || 0);
  const statuses = [
    { key: "APPROVED", label: "Approved", color: "#14b8a6" },
    { key: "PENDING", label: "Pending", color: "#f59e0b" },
    { key: "DRAFT", label: "Draft", color: "#64748b" },
    { key: "REJECTED", label: "Rejected", color: "#ef4444" },
  ].map((status) => ({ ...status, value: (current?.posts || []).filter((post) => post.status === status.key).length }));
  const roles = ["authors", "editors", "investors", "administrators"].map((key, index) => ({ label: key[0].toUpperCase() + key.slice(1), value: count(key), color: colors[index] }));

  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="mb-2 text-xs font-medium text-on-surface-variant">{activeSite?.name || "Website"} / Analytics</p>
        <h1 className="font-headline-lg text-3xl text-on-surface">Audience analytics</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Monitor activity, engagement, and returning visitors.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-on-surface-variant" role="status">{!current ? "Updating..." : current.error ? "Update failed" : <>Activity updated <time dateTime={current.updatedAt}>{new Date(current.updatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</time> IST</>}</p>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={!current} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"><i className="fa-solid fa-rotate-right" aria-hidden="true" />Refresh</button>
      </div>
    </header>
    <section aria-labelledby="activity-heading" className="rounded-2xl border border-outline-variant/25 bg-surface p-5">
      <div className="space-y-5">
        <div className="min-w-0"><h2 id="activity-heading" className="font-headline-md text-lg text-on-surface">{isStreak ? "Regular users" : "Active users"}</h2><p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{isStreak ? "Users who completed a consecutive-day streak." : "Unique users across the website and panel."}</p></div>
        <div className="grid w-full min-w-0 gap-4 sm:max-w-xl sm:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium text-on-surface">Activity measurement</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-low p-1">
              <button type="button" aria-pressed={!isStreak} onClick={() => setPeriod("today")} className={"min-h-10 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (!isStreak ? "bg-primary text-on-primary" : "bg-surface text-on-surface hover:bg-primary/5")}>By date</button>
              <button type="button" aria-pressed={isStreak} onClick={() => setPeriod("7d")} className={"min-h-10 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (isStreak ? "bg-primary text-on-primary" : "bg-surface text-on-surface hover:bg-primary/5")}>By streak</button>
            </div>
          </fieldset>
          <div className="min-w-0">
            <label htmlFor="analytics-period" className="mb-2 block text-xs font-medium text-on-surface">{isStreak ? "Completed streak" : "Date range"}</label>
            <select id="analytics-period" value={period} onChange={(event) => setPeriod(event.target.value)} className="min-h-[50px] w-full min-w-0 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm leading-5 text-on-surface focus:outline-primary">
              {isStreak ? <><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></> : <><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="all">All time</option></>}
            </select>
          </div>
        </div>
      </div>
      <AnalyticsHelp>{isStreak ? "A completed streak requires activity on consecutive days: 7-29, 30-89, or 90+ days. Each user appears in their highest completed group. A missed full day breaks the streak; activity through yesterday still qualifies while today is in progress. Multiple visits on a day count once." : "Each recorded user is counted once for the selected dates. Website and panel counts can overlap. All time includes all recorded activity, not all registered accounts."} Days follow India time (IST).</AnalyticsHelp>
    </section>

    {!current ? <div className="grid gap-5 sm:grid-cols-2" role="status" aria-label="Loading analytics">{[1, 2, 3, 4].map((key) => <div key={key} className="h-56 animate-pulse rounded-2xl bg-surface-container" />)}<span className="sr-only">Loading analytics...</span></div> : <>
      {current.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">Analytics could not be loaded: {current.error}. Use Refresh to try again.</p>}
      {overview && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [isStreak ? "Users with completed streak" : "Active users", "overall_active_users", "Across the website and panel", "fa-users"],
            ["Website visitors", "audience_active_users", "Visitors active on public pages", "fa-globe"],
            ["Panel users", "team_active_users", "Signed-in users active in the panel", "fa-user-tie"],
            ["Anonymous users", "anonymous_users", "Visitors not linked to an account", "fa-user-secret"],
          ].map(([label, key, description, icon], index) => <section key={key} className={`${card} ${index === 0 ? "border-primary/40 bg-primary/5" : ""}`}>
            <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold text-on-surface-variant">{label}</h2><i className={`fa-solid ${icon} text-primary/60`} aria-hidden="true" /></div>
            <p className="mt-4 text-4xl font-semibold tabular-nums text-on-surface">{format(count(key))}</p><p className="mt-2 text-[11px] text-on-surface-variant">{description}</p>
          </section>)}
        </div>
        {!count("overall_active_users") && <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface-variant">{isStreak ? "No users have completed this streak yet." : "No recorded activity for this date range."}</p>}
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Activity by surface" description={selectionLabel} help="Users may visit both the public website and panel. These counts overlap and should not be added together."><Bars rows={[{ label: "Public website", value: count("audience_active_users"), color: colors[0] }, { label: "Editorial panel", value: count("team_active_users"), color: colors[1] }]} /></ChartCard>
          <ChartCard title="Visitor identity" description="Known accounts and anonymous users."><Donut label="Active users" rows={[{ label: "Known accounts", value: Math.max(0, count("overall_active_users") - count("anonymous_users")), color: colors[0] }, { label: "Anonymous", value: count("anonymous_users"), color: colors[2] }]} /></ChartCard>
          <ChartCard wide title="Active users by role" description={selectionLabel} help="Roles are recorded at the time of activity. Administrators includes Admins and Subadmins; a user who changed roles can appear more than once."><Bars rows={roles} vertical /></ChartCard>

        </div>
      </>}
      <RetentionAnalytics siteId={activeSiteId} refresh={refresh} />
          {canViewContent && <ChartCard title="Content status" description="All time / independent of activity filters">{current.contentError ? <p role="alert" className="text-sm text-error">Content could not be loaded: {current.contentError}</p> : <Donut label="Posts" rows={statuses} />}</ChartCard>}
      <nav aria-label="Admin shortcuts" className="grid gap-3 sm:grid-cols-3">
        {[["/author/top-content", "Top-performing content", "fa-chart-simple"], ["/author/review", "Review queue", "fa-clipboard-check"], ["/author/team", "Manage team", "fa-users-gear"]].filter(([href]) => hasPermission(user, { "/author/top-content": PERMISSIONS.VIEW_TOP_CONTENT, "/author/review": PERMISSIONS.REVIEW_CONTENT, "/author/team": PERMISSIONS.TEAM_MEMBERS }[href])).map(([href, label, icon]) => <Link key={href} href={href} className={`${card} flex items-center justify-between gap-3 text-sm font-semibold text-primary hover:border-primary/50`}><span><i className={`fa-solid ${icon} mr-3`} aria-hidden="true" />{label}</span><i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>)}
      </nav>
    </>}
  </div>;
}
