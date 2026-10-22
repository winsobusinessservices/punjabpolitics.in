"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supportApi } from "@/lib/api";
import { showToast } from "@/lib/toast";

const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString("en-IN")}`;
const dateText = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** The signed-in reader's Support contributions, with the way to stop a monthly one. Renders nothing when there are none. */
export default function MySupport() {
  const [rows, setRows] = useState(null);
  const [stopping, setStopping] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await supportApi.mine();
      setRows(data.donations || []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // Loads once on mount; the answer arrives asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const stop = async (publicId) => {
    if (!window.confirm("Stop this monthly contribution? You will not be charged again.")) return;
    setStopping(publicId);
    try {
      const result = await supportApi.stopMonthly(publicId);
      showToast(result.message || "Your monthly contribution has been stopped.", "success");
      await load();
    } catch {
      // the request helper already showed the reason
    } finally {
      setStopping("");
    }
  };

  if (!rows || rows.length === 0) return null;
  const monthly = rows.filter((row) => row.monthlyActive);

  return (
    <section className="grid gap-8 border-t border-outline-variant/30 py-8 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)]">
      <div>
        <h2 className="font-label-md text-base font-semibold text-on-surface">My support</h2>
        <p className="mt-1 font-body-md text-sm text-on-surface-variant">Your contributions to our journalism.{" "}
          <Link href="/support" className="font-semibold text-primary hover:underline">Contribute again</Link>
        </p>
      </div>
      <div className="space-y-5">
        {monthly.length > 0 && (
          <ul className="space-y-3">
            {monthly.map((row) => (
              <li key={row.publicId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/40 bg-secondary/5 p-4">
                <span className="font-body-md text-sm text-on-surface">
                  <strong>{rupees(row.amountPaise)} every month</strong>
                  <span className="block text-xs text-on-surface-variant">Started {dateText(row.paidAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => stop(row.publicId)}
                  disabled={stopping === row.publicId}
                  className="rounded-lg border border-error/40 px-4 py-2 font-label-md text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-60"
                >
                  {stopping === row.publicId ? "Stopping..." : "Stop monthly"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ul className="divide-y divide-outline-variant/20 rounded-xl border border-outline-variant/25">
          {rows.map((row) => (
            <li key={`${row.publicId}-${row.paidAt}`} className="flex items-center justify-between gap-3 px-4 py-3 font-body-md text-sm">
              <span className="text-on-surface">{rupees(row.amountPaise)} <span className="text-on-surface-variant">· {row.kind === "MONTHLY" ? "monthly" : "one time"}{row.status === "REFUNDED" ? " · refunded" : ""}</span></span>
              <span className="text-xs text-on-surface-variant">{dateText(row.paidAt)}{row.receiptNumber ? ` · ${row.receiptNumber}` : ""}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
