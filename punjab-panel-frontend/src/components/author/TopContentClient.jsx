"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { investorApi, mediaUrl } from "@/lib/api";
import { formatViews } from "@/lib/formatViews";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import EmptyState from "@/components/common/EmptyState";

function RankedRow({ rank, item, href }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-lg border border-outline-variant/20 bg-surface p-3 transition hover:border-primary/40 hover:shadow-sm">
        <span className="w-8 shrink-0 text-center font-display-lg text-2xl text-primary">{rank}</span>
        <ImagePlaceholder icon="fa-solid fa-newspaper" image={mediaUrl(item.image)} alt={item.title} className="h-16 w-24 shrink-0 rounded-md" sizes="96px" />
        <span className="min-w-0 flex-1">
          {item.category && <span className="block text-[10px] font-bold uppercase tracking-wider text-surface-tint">{item.category}</span>}
          <span className="line-clamp-2 font-headline-md text-sm text-on-surface group-hover:text-primary md:text-base">{item.title}</span>
          <span className="mt-1 block text-[11px] text-outline">{item.time.split("T")[0]}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-on-surface-variant"><i className="fa-regular fa-eye" /> {formatViews(item.views)}</span>
      </a>
    </li>
  );
}

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");

const TABS = [["news", "Articles", 10], ["blogs", "Blogs", 3]];

export default function TopContentClient() {
  const { user, loading: authLoading } = useAuth();
  const allowed = hasPermission(user, PERMISSIONS.VIEW_TOP_CONTENT);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("news");

  useEffect(() => {
    if (authLoading || !allowed) return;
    let active = true;
    investorApi.topContent().then((result) => active && setData(result)).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [authLoading, allowed]);

  if (authLoading) return null;
  if (!user) return <div className="mx-auto max-w-lg px-4 py-24 text-center"><h1 className="mb-3 text-2xl text-primary">Sign in required</h1><Link href="/login" className="bg-primary px-5 py-2 text-on-primary">Sign in</Link></div>;
  if (!allowed) return <div className="mx-auto max-w-lg px-4 py-24 text-center"><h1 className="mb-3 text-2xl text-primary">Access restricted</h1><p className="mb-4 text-sm text-on-surface-variant">This page is available to investor and admin accounts.</p><Link href="/" className="text-primary underline">Back to website</Link></div>;

  return (
    <div className="mx-auto w-full max-w-full px-4 py-10 md:px-10">
      <h1 className="text-3xl text-primary">Top Content</h1>
      <p className="mb-8 mt-2 text-on-surface-variant">The most-viewed published stories and blogs, ranked by views.</p>
      {error && <p className="mb-6 text-error" role="alert">{error}</p>}
      {!data && !error && <DashboardRowsSkeleton count={4} />}
      {data && <div>
        <div role="tablist" aria-label="Content type" className="mb-6 inline-flex rounded-lg border border-outline-variant/30 bg-surface-container-low p-1">
          {TABS.map(([key, label, count]) => <button key={key} type="button" role="tab" id={`top-tab-${key}`} aria-selected={tab === key} aria-controls="top-panel" onClick={() => setTab(key)} className={`rounded-md px-5 py-2 font-label-md text-xs font-semibold uppercase tracking-wider transition-colors ${tab === key ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-primary"}`}>{label} <span className="opacity-70">({data[key].length}/{count})</span></button>)}
        </div>
        <section id="top-panel" role="tabpanel" aria-labelledby={`top-tab-${tab}`}>
          <h2 className="mb-4 border-b border-outline-variant/30 pb-2 font-display-lg text-xl text-primary md:text-2xl">{tab === "news" ? "Top 10 Articles" : "Top 3 Blogs"}</h2>
          {data[tab].length
            ? <ol className="space-y-3">{data[tab].map((item, index) => <RankedRow key={`${tab}-${item.id}`} rank={index + 1} item={item} href={`${PUBLIC_SITE_URL}/news/${item.slug}`} />)}</ol>
            : <EmptyState compact icon={tab === "news" ? "fa-newspaper" : "fa-pen-nib"} title={tab === "news" ? "No articles yet" : "No blogs yet"} description="Published content will be ranked here." />}
        </section>
      </div>}
    </div>
  );
}
