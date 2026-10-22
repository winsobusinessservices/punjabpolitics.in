"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import EmptyState from "@/components/common/EmptyState";
import ReasonModal from "@/components/common/ReasonModal";

const PAGE_SIZE = 10;

const ROLE_BADGE = {
  ADMIN: "bg-error/10 text-error",
  SUBADMIN: "bg-primary/10 text-primary",
  EDITOR: "bg-secondary-fixed text-on-secondary-fixed",
  AUTHOR: "bg-primary-fixed text-on-primary-fixed",
  INVESTOR: "bg-tertiary-fixed text-on-tertiary-fixed",
  USER: "bg-surface-container-high text-on-surface",
};

export default function UsersAdminClient() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let active = true;
    authApi.listUsers()
      .then((data) => {
        if (active) setUsers((data.users || []).filter((account) => account.role === "USER"));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load users");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = useMemo(
    () => users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, users]
  );

  const [statusBusyId, setStatusBusyId] = useState(null);
  const toggleStatus = async (account) => {
    const next = account.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
    setStatusBusyId(account.id);
    setError("");
    try {
      const data = await authApi.updateUserStatus(account.id, { status: next });
      setUsers((current) => current.map((item) => (item.id === account.id ? { ...item, status: data.user.status } : item)));
      setNotice(`${account.name} is now ${next === "ACTIVE" ? "active" : "inactive and cannot sign in"}.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to update status");
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleDelete = async (reason) => {
    if (!deleteTarget) return;
    await authApi.deleteUser(deleteTarget.id, reason);
    setUsers((current) => current.filter((item) => item.id !== deleteTarget.id));
    setNotice(`${deleteTarget.name} was moved to Deleted Items.`);
    setDeleteTarget(null);
  };

  return (
    <section className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline-lg text-xl text-primary">Registered Users</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{users.length} active account{users.length === 1 ? "" : "s"} on this website</p>
        </div>
        {!loading && users.length > 0 && <p className="text-xs text-on-surface-variant">Page {currentPage} of {totalPages}</p>}
      </div>

      {error && <p className="mb-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container" role="alert">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-primary-fixed p-3 text-sm text-on-primary-fixed" role="status">{notice}</p>}

      {loading ? (
        <DashboardRowsSkeleton count={6} />
      ) : users.length === 0 ? (
        <EmptyState icon="fa-users" title="No users found" description="Registered users for this website will appear here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-outline-variant/25">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-xs uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {visibleUsers.map((account) => {
                  const isSelf = Number(account.id) === Number(user?.id);
                  const protectedAccount = user?.role !== "ADMIN" && ["ADMIN", "SUBADMIN"].includes(account.role);
                  const deleteDisabled = isSelf || protectedAccount;
                  const disabledReason = isSelf ? "You cannot delete your own account" : "Only an Admin can delete this account";
                  return (
                    <tr key={account.id} className="bg-surface hover:bg-surface-container-low/70">
                      <td className="px-4 py-3 font-semibold text-on-surface">{account.name}{isSelf && <span className="font-normal text-on-surface-variant"> (you)</span>}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{account.email}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${ROLE_BADGE[account.role] || ROLE_BADGE.USER}`}>{account.role}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${account.status === "INACTIVE" ? "bg-surface-container-high text-on-surface-variant" : "bg-green-100 text-green-700"}`}>{account.status || "ACTIVE"}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{account.created_at ? new Date(account.created_at).toLocaleDateString("en-IN") : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => toggleStatus(account)} disabled={isSelf || statusBusyId === account.id || !["ACTIVE", "INACTIVE"].includes(account.status || "ACTIVE")} title={isSelf ? "You cannot change your own account" : undefined} className="mr-2 inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                          <i className={`fa-solid ${account.status === "INACTIVE" ? "fa-user-check" : "fa-user-slash"}`} aria-hidden="true" /> {account.status === "INACTIVE" ? "Activate" : "Deactivate"}
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(account)} disabled={deleteDisabled} title={deleteDisabled ? disabledReason : `Delete ${account.name}`} className="inline-flex items-center gap-2 rounded-lg border border-error/35 px-3 py-2 text-xs font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40">
                          <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Users pagination">
              <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-lg border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <div className="flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={pageNumber === currentPage ? "page" : undefined} className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${pageNumber === currentPage ? "bg-primary text-on-primary" : "border border-outline-variant/35 text-on-surface hover:border-primary hover:text-primary"}`}>{pageNumber}</button>
                ))}
              </div>
              <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </nav>
          )}
        </>
      )}

      <ReasonModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete user?" description={deleteTarget ? `${deleteTarget.name} (${deleteTarget.email}) will be moved to Deleted Items and can be restored later.` : undefined} confirmLabel="Delete" danger />
    </section>
  );
}
