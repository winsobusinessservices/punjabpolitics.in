"use client";

import { useEffect, useState } from "react";
import { subscriptionAdminApi } from "@/lib/api";
import EmptyState from "@/components/common/EmptyState";
import { SkeletonBlock } from "@/components/common/Skeleton";

const PAGE_SIZE = 50;
const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-800",
  CREATED: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-slate-200 text-slate-700",
};

const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateText = (value) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface p-4">
      <p className="font-label-sm text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display-lg text-2xl text-primary">{value}</p>
    </div>
  );
}

/** Admin: who bought Premium, until when, and the money received. */
export default function SubscriptionsAdminClient() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    subscriptionAdminApi
      .list({ status, q: query, limit: PAGE_SIZE, offset: 0 })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setRows(result.subscriptions);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Subscriptions could not be loaded.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, query]);

  const loadMore = async () => {
    try {
      const result = await subscriptionAdminApi.list({ status, q: query, limit: PAGE_SIZE, offset: rows.length });
      setRows((current) => [...current, ...result.subscriptions]);
    } catch (err) {
      setError(err.message || "More subscriptions could not be loaded.");
    }
  };

  const changeFilter = (setter) => (event) => {
    setLoading(true);
    setter(event.target.value);
  };

  const summary = data?.summary;
  const select = "block min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm font-label-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Premium members now" value={summary ? summary.activeMembers : "—"} />
        <Stat label="Months sold" value={summary ? summary.paidTotal : "—"} />
        <Stat label="Money received" value={summary ? rupees(summary.paidPaise) : "—"} />
        <Stat label="Payments in progress" value={summary ? summary.pending : "—"} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setQuery(search.trim());
        }}
        className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <label className="block">
          <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Search name, email or receipt</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={select} />
        </label>
        <label className="block">
          <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Status</span>
          <select value={status} onChange={changeFilter(setStatus)} className={select}>
            <option value="">All</option>
            {Object.keys(STATUS_STYLES).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-5 py-2.5 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
          Search
        </button>
      </form>

      {loading ? (
        <SkeletonBlock className="h-64 w-full" />
      ) : error ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="fa-crown" title="No subscriptions yet" description="Premium purchases will appear here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-surface-container font-label-md text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  {["Receipt", "Name", "Email", "Phone", "Plan", "Amount", "Status", "Paid on", "Premium until"].map((heading) => (
                    <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {rows.map((row) => (
                  <tr key={row.public_id} className="bg-surface">
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{row.receipt_number || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-on-surface">{row.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{row.phone || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{row.plan_name || "Premium"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-on-surface">{rupees(row.amount_paise)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status] || ""}`}>{row.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{dateText(row.paid_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{dateText(row.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length % PAGE_SIZE === 0 && (
            <button type="button" onClick={loadMore} className="rounded-lg border border-outline-variant/60 px-5 py-2.5 font-label-md text-sm font-semibold text-primary hover:border-primary">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
