"use client";

import { useState } from "react";

const TYPES = [
  { key: "ARTICLE", label: "Articles", color: "#6366f1" },
  { key: "BLOG", label: "Blogs", color: "#0d9488" },
  { key: "VIDEO", label: "Videos", color: "#d97706" },
];
const STATUSES = [
  { key: "DRAFT", label: "Draft", color: "#64748b" },
  { key: "PENDING", label: "In review", color: "#d97706" },
  { key: "SCHEDULED", label: "Scheduled", color: "#6366f1" },
  { key: "APPROVED", label: "Approved", color: "#059669" },
  { key: "REJECTED", label: "Rejected", color: "#dc2626" },
];
const card = "min-w-0 rounded-xl border border-outline-variant/25 bg-surface p-5";
const dayKey = (value) => new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 10);

export default function DashboardContentCharts({ posts, scope }) {
  const [period, setPeriod] = useState(30);
  const types = TYPES.map((item) => ({ ...item, count: posts.filter((post) => post.type === item.key).length }));
  const statuses = STATUSES.map((item) => ({
    ...item, count: posts.filter((post) =>
      (post.status === "PENDING" && post.scheduled_publish_at ? "SCHEDULED" : post.status) === item.key
    ).length
  }));
  const total = types.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const segments = types.map((item) => {
    const start = offset;
    offset += total ? item.count / total * 100 : 0;
    return item.color + " " + start + "% " + offset + "%";
  });
  const today = dayKey(new Date());
  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - period + index + 1);
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
  const counts = new Map(days.map((day) => [day.date, day]));
  for (const post of posts) {
    if (!post.created_at || Number.isNaN(new Date(post.created_at).getTime())) continue;
    const day = counts.get(dayKey(post.created_at));
    if (day) day.count++;
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  const created = days.reduce((sum, day) => sum + day.count, 0);
  const dateLabel = (day) => new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section aria-label="Content charts" className="mb-8 space-y-4">
      <div><h2 className="font-headline-lg text-xl text-primary">Content overview</h2><p className="mt-1 text-xs text-on-surface-variant">{scope} Totals include all dates.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="font-headline-md text-base text-on-surface">Content by type</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Articles, blogs, and videos in your available content.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            <div aria-hidden="true" className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full" style={{ background: total ? "conic-gradient(" + segments.join(",") + ")" : "var(--color-surface-container-high, #e2e8f0)" }}>
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-surface"><span className="text-3xl font-semibold tabular-nums text-on-surface">{total}</span><span className="text-xs text-on-surface-variant">Total posts</span></div>
            </div>
            <ul className="min-w-36 flex-1 space-y-4">{types.map((item) => <li key={item.key} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} /><span className="text-on-surface-variant">{item.label}</span><strong className="ml-auto tabular-nums text-on-surface">{item.count}</strong><span className="w-12 text-right text-xs text-on-surface-variant">{total ? Math.round(item.count / total * 100) : 0}%</span></li>)}</ul>
          </div>
          {!total && <p className="mt-4 text-sm text-on-surface-variant">Your content mix will appear when posts are created.</p>}
        </div>
        <div className={card}>
          <h3 className="font-headline-md text-base text-on-surface">Editorial status</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Current stage of each post, including scheduled content.</p>
          <div className="mt-6 space-y-4">{statuses.map((item) => <div key={item.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-xs"><span className="text-on-surface-variant">{item.label}</span><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full" style={{ background: item.color, width: (total ? item.count / total * 100 : 0) + "%" }} /></div><strong className="text-right tabular-nums text-on-surface">{item.count}</strong></div>)}</div>
        </div>
      </div>
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-headline-md text-base text-on-surface">Content created</h3><p className="mt-1 text-xs text-on-surface-variant">{created} posts created in the last {period} days. Daily counts use India time (IST).</p></div><label className="flex items-center gap-2 text-xs text-on-surface-variant">Period<select value={period} onChange={(event) => setPeriod(Number(event.target.value))} className="rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
        {created ? <>
          <div aria-hidden="true" className="mt-6 flex h-40 items-end gap-0.5 border-b border-outline-variant/30">{days.map((day) => <div key={day.date} title={dateLabel(day.date) + ": " + day.count + " posts"} className="min-w-0 flex-1 rounded-t-sm bg-primary/80 hover:bg-primary" style={{ height: day.count / max * 100 + "%" }} />)}</div>
          <div aria-hidden="true" className="mt-2 flex justify-between text-xs text-on-surface-variant"><span>{dateLabel(days[0].date)}</span><span>Daily maximum: {max}</span><span>{dateLabel(today)}</span></div>
        </> : <p className="mt-5 rounded-lg bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant">No content was created during this period.</p>}
        <details className="mt-4 text-xs text-on-surface-variant"><summary className="w-fit cursor-pointer rounded py-2 font-medium text-primary">View daily counts</summary><div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Content created each day in IST</caption><thead><tr><th scope="col" className="py-2">Date</th><th scope="col" className="py-2 text-right">Posts created</th></tr></thead><tbody>{days.sort((a, b) => new Date(b.date) - new Date(a.date)).map((day) => <tr key={day.date} className="border-t border-outline-variant/20"><td className="py-2">{dateLabel(day.date)}</td><td className="py-2 text-right tabular-nums">{day.count}</td></tr>)}</tbody></table></div></details>
      </div>
    </section>
  );
}
