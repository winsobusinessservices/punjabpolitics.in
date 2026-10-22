"use client";

import { useCallback, useEffect, useState } from "react";
import { deletionsApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import { useAdminSite } from "@/context/AdminSiteContext";

const FILTERS = [
  ["ACTIVE", "Deleted"],
  ["RESTORED", "Restored"],
  ["PERMANENT", "Permanently deleted"],
  ["ALL", "All history"],
];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function friendlyType(value) {
  return String(value || "Item").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DeletedItemsClient() {
  const confirm = useConfirmDialog();
  const { activeSite, activeSiteId } = useAdminSite();
  const [state, setState] = useState("ACTIVE");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await deletionsApi.list(state, activeSiteId);
      setItems(data.deletions || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [state, activeSiteId]);

  useEffect(() => {
    let current = true;
    if (!activeSiteId) return undefined;
    deletionsApi.list(state, activeSiteId)
      .then((data) => {
        if (current) setItems(data.deletions || []);
      })
      .catch((loadError) => {
        if (current) setError(loadError.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [state, activeSiteId]);

  const restore = async (item) => {
    const approved = await confirm({
      title: "Restore deleted item?",
      description: `${item.entityLabel} will become available again.`,
      confirmLabel: "Restore",
      icon: "fa-trash-can-arrow-up",
      danger: false,
    });
    if (!approved) return;
    setBusyId(item.id);
    try {
      await deletionsApi.restore(item.id, activeSiteId);
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (item) => {
    const approved = await confirm({
      title: "Permanently delete this item?",
      description: `${item.entityLabel} will be removed from the database and cannot be restored. Its audit history will remain.`,
      confirmLabel: "Delete permanently",
    });
    if (!approved) return;
    setBusyId(item.id);
    try {
      await deletionsApi.permanentlyDelete(item.id, activeSiteId);
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div><div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Deletion history for</p><p className="mt-1 font-headline-md text-lg text-on-surface">{activeSite?.name || "Select a website"}</p><p className="text-xs text-on-surface-variant">Restore and permanent-delete actions are limited to this website.</p></div>
      <div className="mb-6 flex flex-wrap gap-2" aria-label="Deletion history filter">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setState(key);
            }}
            aria-pressed={state === key}
            className={`min-h-10 rounded-lg px-4 font-label-md text-xs font-semibold ${state === key ? "bg-primary text-on-primary" : "border border-outline-variant/40 bg-surface text-on-surface-variant hover:border-primary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-5 rounded-lg border border-error/25 bg-error/5 p-4 text-sm text-error" role="alert">{error}</p>}

      {loading ? (
        <p className="rounded-xl border border-outline-variant/20 bg-surface p-8 text-center text-sm text-on-surface-variant">Loading deletion history…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low p-10 text-center">
          <i className="fa-solid fa-trash-can text-3xl text-outline" aria-hidden="true" />
          <p className="mt-3 font-label-md text-sm font-semibold text-on-surface">No records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-surface-container-high text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider">Deleted by</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.map((item) => {
                const active = !item.restoredAt && !item.permanentlyDeletedAt;
                return (
                  <tr key={item.id} className="align-top">
                    <td className="max-w-64 px-4 py-4">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{friendlyType(item.entityType)}</span>
                      <p className="mt-2 break-words text-sm font-semibold text-on-surface">{item.entityLabel}</p>
                      <p className="mt-1 text-[10px] text-outline">ID: {item.entityId}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{item.ownerName || "—"}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-on-surface">{item.deletedByName}</p>
                      <p className="text-xs text-on-surface-variant">{item.deletedByEmail || "No email"}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-secondary">{item.deletedByRole}</p>
                    </td>
                    <td className="max-w-64 px-4 py-4 text-sm text-on-surface-variant">{item.reason || "No reason provided"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-on-surface-variant">
                      <p>Deleted {formatDate(item.deletedAt)}</p>
                      {item.restoredAt && <p className="mt-1 text-green-700">Restored {formatDate(item.restoredAt)} by {item.restoredByName || "Admin"}</p>}
                      {item.permanentlyDeletedAt && <p className="mt-1 text-error">Permanent {formatDate(item.permanentlyDeletedAt)} by {item.permanentlyDeletedByName || "Admin"}</p>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {active ? (
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={busyId === item.id} onClick={() => restore(item)} className="rounded-lg border border-green-600/30 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">Restore</button>
                          <button type="button" disabled={busyId === item.id} onClick={() => permanentlyDelete(item)} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error hover:bg-error/5 disabled:opacity-50">Permanent delete</button>
                        </div>
                      ) : <span className="text-xs text-outline">History only</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
