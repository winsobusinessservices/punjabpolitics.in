"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthReturnLink from "@/components/auth/AuthReturnLink";
import { historyApi, supportApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";

const ROWS_AT_A_TIME = 10;

const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateText = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

const BADGE = {
  PAID: ["Paid", "bg-green-100 text-green-800"],
  REFUNDED: ["Refunded", "bg-slate-200 text-slate-700"],
  FAILED: ["Failed", "bg-red-100 text-red-800"],
  CANCELLED: ["Cancelled", "bg-slate-200 text-slate-700"],
  CREATED: ["Pending", "bg-amber-100 text-amber-800"],
  PENDING: ["Under review", "bg-amber-100 text-amber-800"],
  APPROVED: ["Approved", "bg-green-100 text-green-800"],
  REJECTED: ["Not accepted", "bg-red-100 text-red-800"],
};
const ROLE_NAME = { INVESTOR: "Investor", AUTHOR: "Author", EDITOR: "Editor" };

function Badge({ status }) {
  const [label, style] = BADGE[status] || [status, "bg-slate-200 text-slate-700"];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

// ---- the three tables: which fields exist, and which are shown at first ----------------------

const DONATION_COLUMNS = [
  { key: "date", label: "Date", on: true, cell: (row) => dateText(row.date) },
  { key: "amount", label: "Amount", on: true, cell: (row) => <span className="font-semibold text-on-surface">{rupees(row.amountPaise)}</span> },
  {
    key: "type",
    label: "Type",
    on: true,
    cell: (row) => (
      <>
        {row.kind === "MONTHLY" ? "Monthly" : "One time"}
        {row.monthlyActive && <span className="ml-2 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary">Active</span>}
        {row.monthlyStopped && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">Stopped</span>}
      </>
    ),
  },
  { key: "status", label: "Status", on: true, cell: (row) => <Badge status={row.status} /> },
  { key: "receipt", label: "Receipt", on: true, cell: (row) => row.receiptNumber || "—" },
  {
    key: "manage",
    label: "Manage",
    on: true,
    // Only the current payment of a running monthly contribution has the button.
    cell: (row) =>
      row.monthlyActive ? (
        <button
          type="button"
          onClick={() => row.onStop(row)}
          disabled={row.stopping}
          className="whitespace-nowrap rounded-md border border-error/40 px-3 py-1 text-xs font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {row.stopping ? "Stopping…" : "Stop monthly"}
        </button>
      ) : null,
  },
];

const MESSAGE_COLUMNS = [
  { key: "date", label: "Date", on: true, cell: (row) => dateText(row.date) },
  { key: "subject", label: "Subject", on: true, cell: (row) => <span className="font-semibold text-on-surface">{row.subject}</span> },
  {
    key: "message",
    label: "Message",
    on: true,
    wide: true,
    cell: (row) => <span title={row.message} className="line-clamp-2 whitespace-pre-line break-words">{row.message}</span>,
  },
];

const APPLICATION_COLUMNS = [
  { key: "date", label: "Sent", on: true, cell: (row) => dateText(row.date) },
  { key: "kind", label: "Type", on: true, cell: (row) => row.kind },
  {
    key: "name",
    label: "For",
    on: true,
    wide: true,
    cell: (row) => (row.href ? <Link href={row.href} className="font-semibold text-primary hover:underline">{row.name}</Link> : <span className="font-semibold text-on-surface">{row.name}</span>),
  },
  { key: "status", label: "Status", on: true, cell: (row) => <Badge status={row.status} /> },
  { key: "reviewedAt", label: "Reviewed on", cell: (row) => dateText(row.reviewedAt) },
];

const SUBSCRIPTION_STATE = {
  ACTIVE: ["Active", "bg-green-100 text-green-800"],
  UPCOMING: ["Starts after the current month", "bg-amber-100 text-amber-800"],
  EXPIRED: ["Ended", "bg-slate-200 text-slate-700"],
  REFUNDED: ["Refunded", "bg-slate-200 text-slate-700"],
};

const SUBSCRIPTION_COLUMNS = [
  { key: "date", label: "Paid on", on: true, cell: (row) => dateText(row.date) },
  { key: "plan", label: "Plan", on: true, cell: (row) => <span className="font-semibold text-on-surface">{row.planName}</span> },
  { key: "amount", label: "Amount", on: true, cell: (row) => <span className="font-semibold text-on-surface">{rupees(row.amountPaise)}</span> },
  { key: "from", label: "Valid from", on: true, cell: (row) => dateText(row.startsAt) },
  { key: "until", label: "Valid until", on: true, cell: (row) => <span className="font-semibold text-on-surface">{dateText(row.endsAt)}</span> },
  {
    key: "state",
    label: "Status",
    on: true,
    cell: (row) => {
      const [label, tone] = SUBSCRIPTION_STATE[row.state] || SUBSCRIPTION_STATE.EXPIRED;
      return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
    },
  },
  { key: "days", label: "Length", cell: (row) => `${row.days} days` },
  { key: "receipt", label: "Receipt", on: true, cell: (row) => row.receiptNumber || "—" },
];

// The page can show every section, or just the one picked in the tab bar (remembered in this browser).
const SECTIONS = [
  { key: "donations", label: "Donations", icon: "fa-hand-holding-heart" },
  { key: "subscription", label: "Subscription", icon: "fa-crown" },
  { key: "messages", label: "Messages", icon: "fa-envelope" },
  { key: "applications", label: "Applications", icon: "fa-file-signature" },
  { key: "interests", label: "Interests survey", icon: "fa-sliders" },
];
const FILTER_KEY = "my-activity-section";

function savedFilter() {
  try {
    const saved = window.localStorage.getItem(FILTER_KEY);
    return SECTIONS.some((section) => section.key === saved) ? saved : "all";
  } catch {
    return "all";
  }
}

const storageKey = (id) => `my-activity-fields-${id}`;

function savedFields(id, columns) {
  const defaults = columns.filter((column) => column.on).map((column) => column.key);
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(id)) || "null");
    const valid = Array.isArray(saved) ? saved.filter((key) => columns.some((column) => column.key === key)) : [];
    return valid.length ? valid : defaults;
  } catch {
    return defaults;
  }
}

/**
 * A table with a "Fields" menu: the person picks which columns to see (remembered in this browser),
 * and long lists show ten rows at a time. It only renders once the data has loaded, on the client.
 */
function DataTable({ id, columns, rows }) {
  const [selected, setSelected] = useState(() => savedFields(id, columns));
  const [shown, setShown] = useState(ROWS_AT_A_TIME);
  const allKeys = columns.map((column) => column.key);
  const defaultKeys = columns.filter((column) => column.on).map((column) => column.key);

  const choose = (next) => {
    if (!next.length) return; // at least one field stays
    setSelected(next);
    try {
      window.localStorage.setItem(storageKey(id), JSON.stringify(next));
    } catch {
      /* the choice just is not remembered */
    }
  };
  const toggle = (key) => choose(selected.includes(key) ? selected.filter((item) => item !== key) : allKeys.filter((item) => item === key || selected.includes(item)));

  const visibleColumns = columns.filter((column) => selected.includes(column.key));
  const visibleRows = rows.slice(0, shown);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">Showing {visibleRows.length} of {rows.length}</p>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center rounded-lg border border-outline-variant/60 px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary">
            <i className="fa-solid fa-table-columns mr-2" aria-hidden="true" />Fields ({selected.length})
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-outline-variant/40 bg-surface p-3 shadow-xl">
            <p className="mb-2 text-xs text-on-surface-variant">Choose what to show in the table.</p>
            <div className="grid gap-1">
              {columns.map((column) => (
                <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-on-surface hover:bg-surface-container">
                  <input type="checkbox" checked={selected.includes(column.key)} onChange={() => toggle(column.key)} disabled={selected.includes(column.key) && selected.length === 1} className="h-4 w-4 accent-primary" />
                  {column.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2 border-t border-outline-variant/30 pt-2 text-xs font-semibold">
              <button type="button" onClick={() => choose(allKeys)} className="text-primary hover:underline">Select all</button>
              <span className="text-outline-variant">|</span>
              <button type="button" onClick={() => choose(defaultKeys)} className="text-primary hover:underline">Reset</button>
            </div>
          </div>
        </details>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
            <tr>
              {visibleColumns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {visibleRows.map((row) => (
              <tr key={row.id} className="hover:bg-surface-container-low/60">
                {visibleColumns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-on-surface-variant ${column.wide ? "min-w-[12rem] max-w-md" : "whitespace-nowrap"}`}>{column.cell(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > shown && (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setShown(shown + ROWS_AT_A_TIME)} className="rounded-lg border border-outline-variant/60 px-4 py-2 text-sm font-semibold text-primary hover:border-primary">
            Show {Math.min(ROWS_AT_A_TIME, rows.length - shown)} more
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, count, action, children }) {
  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-headline-md text-lg text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>
          {title}
          {count > 0 && <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-md text-xs text-on-surface-variant">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text, href, label }) {
  return (
    <p className="font-body-md text-sm text-on-surface-variant">
      {text}{" "}
      {href && <Link href={href} className="font-semibold text-primary hover:underline">{label}</Link>}
    </p>
  );
}

/** What a signed-in person has donated, sent and applied for, on one page. */
export default function MyActivityClient() {
  const { user, loading } = useAuth();
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  // Only drawn once the data has loaded (on the client), so reading localStorage here cannot cause a mismatch.
  const [active, setActive] = useState(savedFilter);
  const userId = user?.id ?? null;
  const confirm = useConfirmDialog();
  const [stoppingId, setStoppingId] = useState(null);

  // Stop a running monthly contribution, then reload the list so it shows as stopped.
  const stopMonthly = async (donation) => {
    const confirmed = await confirm({
      title: "Stop your monthly contribution?",
      description: `No further payments of ${rupees(donation.amountPaise)} will be taken. Payments you have already made stay as they are. You can start a new monthly contribution any time.`,
      icon: "fa-circle-pause",
      confirmIcon: "fa-circle-stop",
      confirmLabel: "Stop monthly",
    });
    if (!confirmed) return;
    setStoppingId(donation.id);
    try {
      await supportApi.stopMonthly(donation.id);
      setHistory((await historyApi.mine()).history);
    } catch {
      // the request helper already showed the reason
    } finally {
      setStoppingId(null);
    }
  };

  const chooseFilter = (key) => {
    setActive(key);
    try {
      window.localStorage.setItem(FILTER_KEY, key);
    } catch {
      /* the choice just is not remembered */
    }
  };
  const show = (key) => active === "all" || active === key;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    historyApi
      .mine()
      .then((data) => !cancelled && setHistory(data.history))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <div className="mx-auto my-10 h-96 w-full max-w-full animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />;

  if (!user) {
    return (
      <div className="mx-auto my-14 max-w-lg rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm">
        <i className="fa-solid fa-user-lock text-3xl text-primary" aria-hidden="true" />
        <h1 className="mt-4 font-headline-md text-xl text-primary">Sign in to see your activity</h1>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">Your donations, messages and applications are saved under your account.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <AuthReturnLink authPath="/login" returnTo="/my-activity" className="rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">Sign in</AuthReturnLink>
          <AuthReturnLink authPath="/register" returnTo="/my-activity" className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">Create account</AuthReturnLink>
        </div>
      </div>
    );
  }

  // Role applications and job applications share one table.
  const applications = history
    ? [
        ...history.applications.map((item) => ({ id: `role-${item.id}`, date: item.date, kind: "Join as a team member", name: ROLE_NAME[item.role] || item.role, status: item.status, reviewedAt: item.reviewedAt })),
        ...history.careerApplications.map((item) => ({ id: `career-${item.id}`, date: item.date, kind: "Job application", name: item.jobTitle || "Position no longer listed", href: item.jobSlug ? `/careers/${item.jobSlug}` : null, status: item.status, reviewedAt: item.reviewedAt })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  return (
    <div className="mx-auto w-full max-w-full px-4 py-10 md:px-16">
      <div className="mb-8 border-b border-outline-variant/30 pb-6">
        <p className="mb-1 font-label-md text-xs uppercase tracking-[0.16em] text-on-surface-variant">Account</p>
        <h1 className="font-display-lg text-3xl text-primary">My activity</h1>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">Everything you have donated, sent or applied for through this website.</p>
      </div>

      {failed && <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 font-body-md text-sm text-error">Your activity could not be loaded. Please refresh the page.</p>}
      {!failed && !history && <div className="h-72 animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />}

      {history && (
        <div className="mb-6 overflow-x-auto border-b border-outline-variant/30" role="tablist" aria-label="Filter your activity">
          <div className="flex min-w-max gap-1">
            {[{ key: "all", label: "All", icon: "fa-layer-group" }, ...SECTIONS].map((tab) => {
              const count = { donations: history.donations.length, subscription: history.subscriptions.length, messages: history.contactMessages.length, applications: applications.length }[tab.key];
              const on = active === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => chooseFilter(tab.key)}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 font-label-md text-sm font-semibold transition-colors ${on ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-primary"}`}
                >
                  <i className={`fa-solid ${tab.icon}`} aria-hidden="true" />
                  {tab.label}
                  {count !== undefined && <span className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {history && (
        <div className="space-y-6">
          {show("donations") && <Section icon="fa-hand-holding-heart" title="Donations" count={history.donations.length} action={<Link href="/support" className="font-label-md text-sm font-semibold text-primary hover:underline">Support us</Link>}>
            {history.donations.length === 0 ? (
              <Empty text="You have not made a donation yet." href="/support" label="Support independent journalism" />
            ) : (
              <>
                <DataTable id="donations" columns={DONATION_COLUMNS} rows={history.donations.map((donation) => ({ ...donation, stopping: stoppingId === donation.id, onStop: stopMonthly }))} />
                {history.donations.some((donation) => donation.monthlyActive) && (
                  <p className="mt-3 text-xs text-on-surface-variant">You can stop a monthly contribution any time with <strong className="font-semibold text-on-surface">Stop monthly</strong> in the table (switch on the Manage field if it is hidden). Questions? <Link href="/contact" className="font-semibold text-primary hover:underline">Write to us</Link>.</p>
                )}
              </>
            )}
          </Section>}

          {show("subscription") && <Section icon="fa-crown" title="Subscription" count={history.subscriptions.length} action={<Link href="/subscription" className="font-label-md text-sm font-semibold text-primary hover:underline">{history.subscription.active ? "Extend Premium" : "Get Premium"}</Link>}>
            <div className={`mb-4 flex flex-wrap items-center gap-4 rounded-xl border p-4 ${history.subscription.active ? "border-primary/30 bg-primary/5" : "border-outline-variant/40 bg-surface-container"}`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${history.subscription.active ? "bg-secondary/15 text-secondary" : "bg-surface text-on-surface-variant"}`}>
                <i className="fa-solid fa-crown" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-headline-md text-base text-on-surface">
                  {history.subscription.active ? "You are a Premium member" : history.subscription.endedOn ? "Your Premium has ended" : "You are on the Free plan"}
                  <span className={`ml-2 rounded-full px-2.5 py-0.5 align-middle text-xs font-semibold ${history.subscription.active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>{history.subscription.active ? "Active" : history.subscription.endedOn ? "Ended" : "Free"}</span>
                </p>
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  {history.subscription.active
                    ? `Valid until ${dateText(history.subscription.validUntil)} (${history.subscription.daysLeft} ${history.subscription.daysLeft === 1 ? "day" : "days"} left). Ads are switched off and premium stories are open to you.`
                    : history.subscription.endedOn
                      ? `It ended on ${dateText(history.subscription.endedOn)}. Subscribe again to read premium stories in full without ads.`
                      : "Premium gives you an ad-free experience, exclusive political analysis and reports, and premium election analysis."}
                </p>
              </div>
            </div>
            {history.subscriptions.length === 0 ? (
              <Empty text="You have not subscribed yet." href="/subscription" label="See Premium plans" />
            ) : (
              <DataTable id="subscription" columns={SUBSCRIPTION_COLUMNS} rows={history.subscriptions} />
            )}
          </Section>}

          {show("messages") && <Section icon="fa-envelope" title="Messages you sent" count={history.contactMessages.length} action={<Link href="/contact" className="font-label-md text-sm font-semibold text-primary hover:underline">New message</Link>}>
            {history.contactMessages.length === 0 ? (
              <Empty text="No messages yet. Messages sent from the Contact page will appear here." href="/contact" label="Contact us" />
            ) : (
              <DataTable id="messages" columns={MESSAGE_COLUMNS} rows={history.contactMessages} />
            )}
          </Section>}

          {show("applications") && <Section icon="fa-file-signature" title="Applications" count={applications.length}>
            {applications.length === 0 ? (
              <Empty text="You have not applied for anything yet." href="/careers" label="See open positions" />
            ) : (
              <DataTable id="applications" columns={APPLICATION_COLUMNS} rows={applications} />
            )}
          </Section>}

          {show("interests") && <Section icon="fa-sliders" title="Interests survey" action={<Link href="/my-interests" className="font-label-md text-sm font-semibold text-primary hover:underline">{history.interests ? "Update answers" : "Answer now"}</Link>}>
            {history.interests ? (
              <p className="font-body-md text-sm text-on-surface-variant">You answered the survey on {dateText(history.interests.submittedAt)}{history.interests.updatedAt && dateText(history.interests.updatedAt) !== dateText(history.interests.submittedAt) ? `, and last updated it on ${dateText(history.interests.updatedAt)}` : ""}.</p>
            ) : (
              <Empty text="You have not answered the interests survey yet." href="/my-interests" label="Tell us what you follow" />
            )}
          </Section>}
        </div>
      )}
    </div>
  );
}
