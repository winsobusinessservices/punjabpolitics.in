"use client";

import { useCallback, useEffect, useState } from "react";
import { walletApi } from "@/lib/api";
import ReasonModal from "@/components/common/ReasonModal";

const formatInr = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
const formatDate = (value) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const TABS = [["PENDING", "Pending"], ["PAID", "Paid"], ["REJECTED", "Rejected"], ["", "All"]];
const STATUS_TONE = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  REJECTED: "bg-error/10 text-error",
};

/**
 * Manual payout queue. Contributors ask for money with a UPI ID; an admin pays
 * it outside the system, then marks the request paid with the bank's UTR (or
 * rejects it with a reason). Both outcomes email the contributor.
 */
export default function WithdrawalRequestsAdmin() {
  const [tab, setTab] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [utr, setUtr] = useState("");
  const [utrError, setUtrError] = useState("");
  const [paying, setPaying] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async (status) => {
    const data = await walletApi.listWithdrawals(status);
    setItems(data.withdrawals || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load(tab).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [tab, load]);

  const openPay = (item) => { setPayTarget(item); setUtr(""); setUtrError(""); };

  const submitPay = async (event) => {
    event.preventDefault();
    const value = utr.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,30}$/.test(value)) return setUtrError("Enter the UTR / transaction reference (8–30 letters or digits).");
    setUtrError("");
    setPaying(true);
    try {
      const data = await walletApi.markWithdrawalPaid(payTarget.id, value);
      setSuccess(data.message);
      setPayTarget(null);
      await load(tab);
    } catch (err) {
      setUtrError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const submitReject = async (reason) => {
    const data = await walletApi.rejectWithdrawal(rejectTarget.id, reason);
    setSuccess(data.message);
    setRejectTarget(null);
    await load(tab);
  };

  const copyUpi = async (item) => {
    try {
      await navigator.clipboard.writeText(item.upiId);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard can be blocked; the UPI ID is still visible to copy by hand.
    }
  };

  return (
    <section aria-label="Withdrawal requests">

      <div className="mb-4 inline-flex rounded-lg border border-outline-variant/30 bg-surface-container-low p-1" role="tablist" aria-label="Request status">
        {TABS.map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => { setTab(value); setSuccess(""); setError(""); }}
            className={`min-h-9 rounded-md px-4 font-label-md text-xs font-semibold ${tab === value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-primary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg border border-error/25 bg-error/5 p-3 font-body-md text-sm text-error" role="alert">{error}</p>}
      {success && <p className="mb-4 rounded-lg border border-green-600/25 bg-green-50 p-3 font-body-md text-sm text-green-700" role="status">{success}</p>}

      {loading ? (
        <p className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 font-body-md text-sm text-on-surface-variant">Loading requests…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container p-6 text-center font-body-md text-sm text-on-surface-variant">
          {tab === "PENDING" ? "No pending withdrawal requests." : "Nothing to show here yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const open = ["PENDING", "PROCESSING"].includes(item.status);
            return (
              <article key={item.id} className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-label-md text-sm font-semibold text-on-surface">
                      {item.userName} <span className="font-normal text-on-surface-variant">· {item.userRole === "EDITOR" ? "Editor" : "Author"} · {item.userEmail}</span>
                    </p>
                    <p className="mt-1 font-headline-md text-lg text-primary">
                      {formatInr(item.amountInr)} <span className="font-body-md text-xs text-on-surface-variant">({item.points.toLocaleString("en-IN")} points)</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-body-md text-sm text-on-surface">
                      <span className="text-xs text-on-surface-variant">UPI ID</span>
                      {item.upiId ? (
                        <>
                          <strong className="break-all">{item.upiId}</strong>
                          <button type="button" onClick={() => copyUpi(item)} className="text-xs text-primary underline underline-offset-2">{copiedId === item.id ? "Copied" : "Copy"}</button>
                        </>
                      ) : (
                        <span className="text-xs text-on-surface-variant">Not provided (older request)</span>
                      )}
                    </p>
                    <p className="mt-1 font-body-md text-xs text-on-surface-variant">Requested {formatDate(item.requestedAt)}</p>
                    {item.status === "PAID" && <p className="mt-1 font-body-md text-xs text-green-700">Paid {formatDate(item.processedAt)} · UTR <strong>{item.utrNumber}</strong></p>}
                    {item.status === "REJECTED" && <p className="mt-1 font-body-md text-xs text-error">Rejected {formatDate(item.processedAt)}{item.adminNotes ? ` · ${item.adminNotes}` : ""}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 font-label-md text-[10px] font-bold uppercase ${STATUS_TONE[item.status] || "bg-surface-container-high text-on-surface-variant"}`}>{item.status}</span>
                    {open && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openPay(item)} className="min-h-9 rounded-lg bg-green-600 px-4 font-label-md text-xs font-semibold text-white hover:bg-green-700">
                          <i className="fa-solid fa-check mr-1.5" />Mark paid
                        </button>
                        <button type="button" onClick={() => setRejectTarget(item)} className="min-h-9 rounded-lg border border-error/40 px-4 font-label-md text-xs font-semibold text-error hover:bg-error hover:text-on-error">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="utr-title">
          <form onSubmit={submitPay} className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            <h2 id="utr-title" className="font-headline-lg text-xl text-primary">Mark withdrawal as paid</h2>
            <p className="mt-2 font-body-md text-sm text-on-surface-variant">
              Confirm you sent <strong>{formatInr(payTarget.amountInr)}</strong> to <strong className="break-all">{payTarget.upiId || "the contributor"}</strong>. {payTarget.userName} will be emailed this UTR.
            </p>
            <label htmlFor="utr-number" className="mt-5 block font-label-md text-xs text-on-surface-variant">UTR / transaction reference number</label>
            <input
              id="utr-number"
              autoFocus
              value={utr}
              onChange={(event) => setUtr(event.target.value)}
              placeholder="e.g. 412345678901"
              maxLength={30}
              className="mt-1.5 w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md uppercase tracking-wide text-on-surface outline-none focus:border-primary"
            />
            {utrError && <p className="mt-2 font-body-md text-xs text-error" role="alert">{utrError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPayTarget(null)} className="rounded border border-outline-variant/40 px-4 py-2 font-label-md text-sm">Cancel</button>
              <button type="submit" disabled={paying || !utr.trim()} className="rounded bg-green-600 px-4 py-2 font-label-md text-sm font-semibold text-white disabled:opacity-50">
                {paying ? "Saving…" : "Confirm paid"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ReasonModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={submitReject}
        title="Reject withdrawal request"
        description={rejectTarget ? `The ${formatInr(rejectTarget.amountInr)} request from ${rejectTarget.userName} will be rejected, their points returned, and this reason emailed to them.` : ""}
        confirmLabel="Reject request"
        placeholder="Why is this request being rejected? (e.g. UPI ID is wrong)"
        required="true"
        danger
      />
    </section>
  );
}
