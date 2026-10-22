"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { walletApi } from "@/lib/api";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";

const EMPTY_SUMMARY = {
  availablePoints: 0,
  availableValueInr: 0,
  pendingWithdrawalPoints: 0,
  pendingWithdrawalValueInr: 0,
  lifetimeEarnedPoints: 0,
  lifetimeEarnedValueInr: 0,
  lifetimeWithdrawnPoints: 0,
  lifetimeWithdrawnValueInr: 0,
  lifetimeBonusPoints: 0,
  lifetimeBonusValueInr: 0,
};

const SUMMARY_CARDS = [
  { key: "availablePoints", label: "Available points", icon: "fa-coins", accent: "text-primary bg-primary/10" },
  { key: "availableValueInr", label: "Available value", icon: "fa-indian-rupee-sign", accent: "text-emerald-700 bg-emerald-100", currency: true },
  { key: "lifetimeEarnedPoints", label: "Total earned points", icon: "fa-arrow-trend-up", accent: "text-green-700 bg-green-100" },
  { key: "lifetimeEarnedValueInr", label: "Total earned value", icon: "fa-sack-dollar", accent: "text-teal-700 bg-teal-100", currency: true },
  { key: "lifetimeBonusPoints", label: "Bonus points only", icon: "fa-gift", accent: "text-amber-700 bg-amber-100" },
  { key: "pendingWithdrawalPoints", label: "Pending withdrawal points", icon: "fa-clock", accent: "text-amber-700 bg-amber-100" },
  { key: "lifetimeWithdrawnPoints", label: "Total withdrawn points", icon: "fa-money-bill-transfer", accent: "text-blue-700 bg-blue-100" },
];

function formatCategory(category) {
  return String(category || "POINTS").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

export default function WalletClient() {
  const [wallet, setWallet] = useState({ summary: EMPTY_SUMMARY, transactions: [], bonuses: [], withdrawals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalPoints, setWithdrawalPoints] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [acknowledgingBonusId, setAcknowledgingBonusId] = useState(null);
  const [transactionFilter, setTransactionFilter] = useState("ALL");

  useEffect(() => {
    walletApi
      .getWallet()
      .then((data) => {
        setWallet(data.wallet);
        setWithdrawalPoints(String(data.wallet.withdrawalEligibility?.maximumWithdrawablePoints || ""));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setWithdrawing(true);
    try {
      const data = await walletApi.requestWithdrawal(Number(withdrawalPoints), upiId.trim());
      setWallet(data.wallet);
      setSuccess(data.message);
      setShowWithdrawalForm(false);
      setUpiId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const acknowledgeBonus = async (bonusId) => {
    setError("");
    setAcknowledgingBonusId(bonusId);
    try {
      const data = await walletApi.acknowledgeBonus(bonusId);
      setWallet((current) => ({
        ...current,
        bonuses: current.bonuses.map((bonus) => bonus.id === bonusId
          ? { ...bonus, acknowledgedAt: data.acknowledgedAt }
          : bonus),
      }));
    } catch (acknowledgeError) {
      setError(acknowledgeError.message);
    } finally {
      setAcknowledgingBonusId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-full px-4 py-10 md:px-16">
        <h1 className="mb-6 font-display-lg text-3xl text-primary">Wallet</h1>
        <DashboardRowsSkeleton />
      </div>
    );
  }

  const eligibility = wallet.withdrawalEligibility;
  const rupeesPerPoint = wallet.pointRate?.rupeesPerPoint || 1;
  const requestedValueInr = (Number(withdrawalPoints) || 0) * rupeesPerPoint;
  const bonusHistory = wallet.bonuses || [];
  const bonusNotifications = bonusHistory.filter((bonus) => !bonus.acknowledgedAt);
  const filteredTransactions = transactionFilter === "BONUS"
    ? wallet.transactions.filter((transaction) => transaction.category === "CONTENT_BONUS")
    : wallet.transactions;

  return (
    <div className="mx-auto max-w-full px-4 py-10 md:px-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 font-label-md text-xs uppercase tracking-[0.16em] text-on-surface-variant">Contributor rewards</p>
          <h1 className="font-display-lg text-3xl text-primary">Wallet</h1>
          <p className="mt-2 max-w-2xl font-body-md text-sm text-on-surface-variant">View your point balance, withdrawals, and wallet activity.</p>
          <p className="mt-1 font-label-md text-xs font-semibold text-primary">Your rate: 1 point = {formatInr(rupeesPerPoint)}</p>
        </div>
        <button
          type="button"
          disabled={!eligibility?.canWithdraw}
          title={eligibility?.blockedReason || "Request a points withdrawal"}
          onClick={() => setShowWithdrawalForm(true)}
          className={`min-h-11 rounded-lg px-5 font-label-md text-sm font-semibold transition-colors ${eligibility?.canWithdraw
            ? "bg-primary text-on-primary hover:bg-primary-container"
            : "cursor-not-allowed bg-outline-variant/35 text-on-surface-variant opacity-70"
          }`}
        >
          <i className="fa-solid fa-building-columns mr-2" aria-hidden="true" />
          Withdraw points
        </button>
      </div>

      {error && <p className="mb-5 rounded-lg border border-error/25 bg-error/5 p-4 font-body-md text-sm text-error" role="alert">{error}</p>}
      {success && <p className="mb-5 rounded-lg border border-green-600/25 bg-green-50 p-4 font-body-md text-sm text-green-700" role="status">{success}</p>}

      {eligibility && (
        <>
          <section className={`mb-6 rounded-xl border p-5 ${eligibility.canWithdraw ? "border-green-600/25 bg-green-50" : "border-outline-variant/25 bg-surface-container-low"}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${eligibility.canWithdraw ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}>
                <i className={`fa-solid ${eligibility.canWithdraw ? "fa-circle-check" : "fa-lock"}`} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-label-md text-sm font-semibold text-on-surface">
                  {eligibility.canWithdraw ? "Withdrawal is available" : "Withdrawal is currently unavailable"}
                </h2>
                <p className="mt-1 font-body-md text-xs text-on-surface-variant">{eligibility.blockedReason || "You can submit one withdrawal request for this month."}</p>
                <p className="mt-2 font-body-md text-xs text-on-surface-variant">
                  Rules: At least {formatInr(eligibility.minimumWithdrawalInr)} required to qualify · Keep {formatInr(eligibility.minimumRemainingInr)} in the wallet · One request per month · Any calendar date
                </p>
                {eligibility.alreadyRequested && eligibility.nextWithdrawalDate && (
                  <p className="mt-1 font-label-md text-xs font-semibold text-primary">Next eligible month begins: {eligibility.nextWithdrawalDate}</p>
                )}
              </div>
            </div>
          </section>

          {showWithdrawalForm && eligibility.canWithdraw && (
            <form onSubmit={submitWithdrawal} className="mb-8 rounded-xl border border-primary/25 bg-surface-container p-5">
              <h2 className="font-display-lg text-xl text-primary">Request withdrawal</h2>
              <p className="mt-1 font-body-md text-xs text-on-surface-variant">An administrator will pay the UPI ID below and email you the UTR once it is done.</p>
              <label className="mt-4 block max-w-sm">
                <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Points to withdraw</span>
                <input
                  type="number"
                  min="1"
                  max={eligibility.maximumWithdrawablePoints}
                  step="1"
                  required
                  value={withdrawalPoints}
                  onChange={(event) => setWithdrawalPoints(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                />
                <span className="mt-2 block font-label-md text-xs font-semibold text-primary">Estimated payout: {formatInr(requestedValueInr)} · {formatInr(eligibility.minimumRemainingInr)} will remain protected</span>
              </label>
              <label className="mt-4 block max-w-sm">
                <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Your UPI ID</span>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(event) => setUpiId(event.target.value)}
                  placeholder="name@okbank"
                  autoComplete="off"
                  maxLength={100}
                  pattern="[a-zA-Z0-9._\-]{2,100}@[a-zA-Z][a-zA-Z0-9.\-]{1,48}"
                  title="Enter a valid UPI ID, for example name@okbank"
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
                />
                <span className="mt-1 block font-body-md text-xs text-on-surface-variant">Double-check it — the payment goes exactly to this ID.</span>
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={withdrawing} className="min-h-11 rounded-lg bg-primary px-5 font-label-md text-sm font-semibold text-on-primary disabled:opacity-60">
                  {withdrawing ? "Submitting..." : "Submit request"}
                </button>
                <button type="button" onClick={() => setShowWithdrawalForm(false)} className="min-h-11 rounded-lg border border-outline-variant/40 px-5 font-label-md text-sm text-on-surface">Cancel</button>
              </div>
            </form>
          )}
        </>
      )}

      <section aria-label="Wallet summary" className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.key} className="rounded-xl flex flex-col md:flex-row md:justify-between md:items-center border border-outline-variant/20 bg-surface-container p-5">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full">
              <i className={`fa-solid ${card.icon} ${card.accent} p-3 rounded-xl`} aria-hidden="true" />
            </span>
            <div className="flex flex-col md:items-center gap-2">
              <p className="font-body-lg text-3xl font-bold tabular-nums text-on-surface">
                {card.currency
                  ? formatInr(wallet.summary?.[card.key])
                  : (wallet.summary?.[card.key] || 0).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 font-label-md text-xs text-on-surface-variant">{card.label}</p>
            </div>
          </div>
        ))}
      </section>

      {bonusNotifications.length > 0 && (
        <section className="mb-10" aria-labelledby="bonus-awards-heading">
          <div className="mb-4">
            <p className="font-label-md text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Notifications</p>
            <h2 id="bonus-awards-heading" className="mt-1 font-display-lg text-2xl text-primary">Recent bonus awards</h2>
          </div>
          <div className="space-y-3">
            {bonusNotifications.map((bonus) => (
              <article key={bonus.id} className="rounded-xl border border-amber-500/30 bg-amber-50 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <i className="fa-solid fa-gift" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-label-md text-sm font-bold text-on-surface">+{bonus.points.toLocaleString("en-IN")} bonus points</h3>
                      <time className="font-body-md text-xs text-on-surface-variant" dateTime={bonus.createdAt}>{formatDate(bonus.createdAt)}</time>
                    </div>
                    <p className="mt-1 font-body-md text-sm font-semibold text-on-surface">{bonus.contentTitle}</p>
                    <p className="mt-2 font-body-md text-sm text-on-surface-variant"><span className="font-semibold">Reason:</span> {bonus.reason}</p>
                    {bonus.contentSlug && (
                      <Link href={`/news/${bonus.contentSlug}`} className="mt-3 inline-flex items-center gap-1 font-label-md text-xs font-semibold text-primary hover:underline">
                        View related content <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden="true" />
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={acknowledgingBonusId === bonus.id}
                      onClick={() => acknowledgeBonus(bonus.id)}
                      className="mt-3 ml-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-amber-600 px-4 font-label-md text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      <i className="fa-solid fa-check" aria-hidden="true" />
                      {acknowledgingBonusId === bonus.id ? "Acknowledging..." : "Acknowledge"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {wallet.withdrawals?.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-display-lg text-2xl text-primary">Withdrawal requests</h2>
          <div className="space-y-3">
            {wallet.withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/20 bg-surface-container p-4">
                <div>
                  <p className="font-label-md text-sm font-semibold text-on-surface">{withdrawal.points.toLocaleString("en-IN")} points · {formatInr(withdrawal.amountInr)}</p>
                  <p className="mt-1 font-body-md text-xs text-on-surface-variant">Requested {formatDate(withdrawal.requestedAt)}</p>
                  {withdrawal.upiId && <p className="mt-1 font-body-md text-xs text-on-surface-variant">UPI ID: {withdrawal.upiId}</p>}
                  {withdrawal.status === "PAID" && withdrawal.utrNumber && <p className="mt-1 font-body-md text-xs text-green-700">Paid · UTR {withdrawal.utrNumber}</p>}
                  {withdrawal.status === "REJECTED" && withdrawal.adminNotes && <p className="mt-1 font-body-md text-xs text-error">Rejected: {withdrawal.adminNotes}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 font-label-md text-[10px] font-bold uppercase ${withdrawal.status === "PAID" ? "bg-green-100 text-green-700" : withdrawal.status === "REJECTED" ? "bg-error/10 text-error" : "bg-amber-100 text-amber-700"}`}>{withdrawal.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display-lg text-2xl text-primary">Points history</h2>
            <p className="mt-1 font-body-md text-xs text-on-surface-variant">Your 100 most recent wallet transactions</p>
          </div>
          <div className="inline-flex w-fit rounded-lg border border-outline-variant/30 bg-surface-container-low p-1" aria-label="Filter points history">
            <button
              type="button"
              aria-pressed={transactionFilter === "ALL"}
              onClick={() => setTransactionFilter("ALL")}
              className={`min-h-9 rounded-md px-3 font-label-md text-xs font-semibold transition-colors ${transactionFilter === "ALL" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              All activity
            </button>
            <button
              type="button"
              aria-pressed={transactionFilter === "BONUS"}
              onClick={() => setTransactionFilter("BONUS")}
              className={`min-h-9 rounded-md px-3 font-label-md text-xs font-semibold transition-colors ${transactionFilter === "BONUS" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              Bonus points
            </button>
          </div>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-5 py-12 text-center">
            <i className={`fa-solid ${transactionFilter === "BONUS" ? "fa-gift" : "fa-receipt"} mb-3 text-3xl text-outline`} aria-hidden="true" />
            <p className="font-label-md text-sm font-semibold text-on-surface">
              {transactionFilter === "BONUS" ? "No bonus points awarded yet" : "No points activity yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container">
            <ul className="divide-y divide-outline-variant/20">
              {filteredTransactions.map((transaction) => {
                const credit = transaction.direction === "CREDIT";
                return (
                  <li key={transaction.id} className="flex items-center gap-4 p-4 sm:p-5">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${credit ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      <i className={`fa-solid ${credit ? "fa-arrow-down" : "fa-arrow-up"}`} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-sm font-semibold text-on-surface">{transaction.description}</p>
                      <p className="mt-1 font-body-md text-xs text-on-surface-variant">{formatCategory(transaction.category)} · {formatDate(transaction.createdAt)}</p>
                      {transaction.category === "CONTENT_BONUS" && transaction.metadata?.reason && (
                        <p className="mt-1 font-body-md text-xs text-on-surface-variant">Reason: {transaction.metadata.reason}</p>
                      )}
                      {transaction.category === "CONTENT_BONUS" && transaction.metadata?.contentSlug && (
                        <Link href={`/news/${transaction.metadata.contentSlug}`} className="mt-2 inline-flex items-center gap-1 font-label-md text-xs font-semibold text-primary hover:underline">
                          View related content <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`font-body-md text-base font-bold tabular-nums ${credit ? "text-green-700" : "text-red-700"}`}>{credit ? "+" : "-"}{transaction.points.toLocaleString("en-IN")}</p>
                      <p className="font-label-md text-[10px] text-on-surface-variant">Balance {transaction.balanceAfter.toLocaleString("en-IN")}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
