"use client";

import { useEffect, useState } from "react";
import { donationApi } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { SkeletonBlock } from "@/components/common/Skeleton";
import EmptyState from "@/components/common/EmptyState";

const PAGE_SIZE = 50;
const STORAGE_KEY = "panel-donations-columns";

const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-800",
  CREATED: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateText = (value) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const plain = (value) => value || "—";

// Every field an admin can show. "key" is also the field name used by the CSV export, so the table
// and the downloaded file always carry the same columns. "on" marks the default selection.
const COLUMNS = [
  { key: "receipt_number", label: "Receipt", on: true, cell: (row) => <span className="text-on-surface-variant">{plain(row.receipt_number)}</span> },
  { key: "created_at", label: "Created", cell: (row) => <span className="text-on-surface-variant">{dateText(row.created_at)}</span> },
  { key: "paid_at", label: "Paid on", on: true, cell: (row) => <span className="text-on-surface-variant">{dateText(row.paid_at)}</span> },
  { key: "donor_name", label: "Name", on: true, cell: (row) => <span className="font-semibold text-on-surface">{row.donor_name}</span> },
  { key: "donor_email", label: "Email", on: true, cell: (row) => <span className="text-on-surface-variant">{row.donor_email}</span> },
  { key: "donor_phone", label: "Phone", cell: (row) => <span className="text-on-surface-variant">{plain(row.donor_phone)}</span> },
  { key: "amount_rupees", label: "Amount", on: true, cell: (row) => <span className="font-semibold text-on-surface">{rupees(row.amount_paise)}</span> },
  {
    key: "kind",
    label: "Type",
    on: true,
    cell: (row) => (row.kind === "MONTHLY" ? (row.subscription_ended_at ? "Monthly (ended)" : "Monthly") : "One time"),
  },
  {
    key: "status",
    label: "Status",
    on: true,
    cell: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status] || ""}`}>{row.status}</span>,
  },
  { key: "message", label: "Message", wide: true, cell: (row) => (row.message ? <span className="italic text-on-surface-variant">“{row.message}”</span> : "—") },
  { key: "provider", label: "Gateway", cell: (row) => plain(row.provider) },
  { key: "provider_payment_id", label: "Payment id", cell: (row) => <span className="font-mono text-xs text-on-surface-variant">{plain(row.provider_payment_id)}</span> },
  { key: "provider_subscription_id", label: "Subscription id", cell: (row) => <span className="font-mono text-xs text-on-surface-variant">{plain(row.provider_subscription_id)}</span> },
  { key: "refunded_at", label: "Refunded on", cell: (row) => <span className="text-on-surface-variant">{dateText(row.refunded_at)}</span> },
  { key: "show_on_wall", label: "On supporters wall", cell: (row) => (row.show_on_wall ? "Yes" : "No") },
];
const DEFAULT_KEYS = COLUMNS.filter((column) => column.on).map((column) => column.key);
const ALL_KEYS = COLUMNS.map((column) => column.key);

function savedColumns() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    const valid = Array.isArray(saved) ? saved.filter((key) => ALL_KEYS.includes(key)) : [];
    return valid.length ? valid : DEFAULT_KEYS;
  } catch {
    return DEFAULT_KEYS;
  }
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface p-4">
      <p className="font-label-sm text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display-lg text-2xl text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/** Donation totals and a filterable table. The admin chooses which fields to show; the CSV export uses the same choice. */
export default function DonationsAdminClient() {
  const [filters, setFilters] = useState({ status: "", kind: "", q: "" });
  const [applied, setApplied] = useState({ status: "", kind: "", q: "" });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Only shown once the data has loaded (on the client), so reading localStorage here cannot cause a mismatch.
  const [selected, setSelected] = useState(savedColumns);

  useEffect(() => {
    let cancelled = false;
    donationApi
      .list({ ...applied, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null)) // the request helper already showed the error
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const goToPage = (next) => {
    setLoading(true);
    setPage(next);
  };

  const search = (event) => {
    event.preventDefault();
    setLoading(true);
    setPage(0);
    setApplied(filters);
  };

  const chooseColumns = (next) => {
    if (!next.length) return; // at least one column stays
    setSelected(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* the choice just is not remembered */
    }
  };
  const toggleColumn = (key) => chooseColumns(selected.includes(key) ? selected.filter((item) => item !== key) : ALL_KEYS.filter((item) => item === key || selected.includes(item)));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await donationApi.exportCsv({ ...applied, fields: selected.join(",") });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;
  const rows = data?.donations || [];
  const columns = COLUMNS.filter((column) => selected.includes(column.key));
  const field = "rounded-lg border border-outline-variant/50 bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Total raised" value={rupees(summary.raisedPaise)} hint={`${summary.paidCount} payments`} />
          <SummaryCard label="This month" value={rupees(summary.thisMonthPaise)} />
          <SummaryCard label="Supporters" value={summary.supporters} hint={`${summary.activeMonthlySupporters} giving monthly`} />
          <SummaryCard label="Refunded / pending" value={`${summary.refundedCount} / ${summary.pendingCount}`} hint="Pending = payment not completed" />
        </div>
      )}

      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-on-surface-variant">Search</span>
          <input type="search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Name, email or receipt" className={`${field} w-56`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-on-surface-variant">Status</span>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className={field}>
            <option value="">All</option>
            {["PAID", "CREATED", "FAILED", "REFUNDED", "CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-on-surface-variant">Type</span>
          <select value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })} className={field}>
            <option value="">All</option>
            <option value="ONE_TIME">One time</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Apply</button>

        {data && (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center rounded-lg border border-outline-variant/60 px-4 py-2 text-sm font-semibold text-primary hover:border-primary">
              <i className="fa-solid fa-table-columns mr-2" aria-hidden="true" />Fields ({selected.length})
            </summary>
            <div className="absolute left-0 z-30 mt-2 w-72 rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-xl">
              <p className="mb-2 text-xs text-on-surface-variant">Choose what to show in the table. The CSV export uses the same fields.</p>
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto">
                {COLUMNS.map((column) => (
                  <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-on-surface hover:bg-surface-container">
                    <input type="checkbox" checked={selected.includes(column.key)} onChange={() => toggleColumn(column.key)} disabled={selected.includes(column.key) && selected.length === 1} className="h-4 w-4 accent-primary" />
                    {column.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2 border-t border-outline-variant/30 pt-3 text-xs font-semibold">
                <button type="button" onClick={() => chooseColumns(ALL_KEYS)} className="text-primary hover:underline">Select all</button>
                <span className="text-outline-variant">|</span>
                <button type="button" onClick={() => chooseColumns(DEFAULT_KEYS)} className="text-primary hover:underline">Reset</button>
              </div>
            </div>
          </details>
        )}

        <button type="button" onClick={exportCsv} disabled={exporting} className="rounded-lg border border-outline-variant/60 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60">
          <i className="fa-solid fa-download mr-2" aria-hidden="true" />{exporting ? "Preparing…" : "Export CSV"}
        </button>
      </form>

      {loading ? (
        <SkeletonBlock className="h-64 w-full" />
      ) : !rows.length ? (
        <EmptyState icon="fa-hand-holding-heart" title="No donations found" description="Contributions made on the Support page will appear here." />
      ) : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-outline-variant/30 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  {columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low/60">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 ${column.wide ? "min-w-[14rem] max-w-xs" : "whitespace-nowrap"}`}>{column.cell(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" disabled={page === 0} onClick={() => goToPage(page - 1)} className="rounded-lg border border-outline-variant/60 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-40">Previous</button>
            <span className="text-sm text-on-surface-variant">Page {page + 1} · showing {rows.length} donation{rows.length === 1 ? "" : "s"}</span>
            <button type="button" disabled={rows.length < PAGE_SIZE} onClick={() => goToPage(page + 1)} className="rounded-lg border border-outline-variant/60 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-40">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
