"use client";

import { useCallback, useEffect, useState } from "react";
import { applicationsApi, mediaUrl } from "@/lib/api";

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function InvestorApplicationsAdminClient() {
  const [status, setStatus] = useState("PENDING");
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await applicationsApi.list({ role: "INVESTOR", status: status || undefined });
      setApplications(data.applications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(application, action) {
    setReviewingId(application.id);
    setError("");
    try {
      await applicationsApi.review(application.id, { action, notes: notes[application.id]?.trim() || undefined });
      setNotes((current) => ({ ...current, [application.id]: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface p-4">
        <div>
          <h2 className="font-headline-lg text-xl text-primary">Investor application inbox</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Review applications submitted through /investors. Approval creates the applicant&apos;s Investor account.</p>
        </div>
        <label className="text-xs font-semibold text-on-surface-variant">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="ml-2 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface">
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
      {loading ? (
        <p className="py-16 text-center text-sm text-on-surface-variant">Loading investor applications…</p>
      ) : applications.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-outline-variant/40 bg-surface px-6 py-14 text-center">
          <i className="fa-solid fa-inbox text-3xl text-outline" aria-hidden="true" />
          <p className="mt-3 text-sm text-on-surface-variant">No {status ? status.toLowerCase() : ""} investor applications found.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {applications.map((application) => (
            <article key={application.id} className="rounded-xl border border-outline-variant/30 bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-headline-lg text-xl text-on-surface">{application.name}</h3>
                  <a href={`mailto:${application.email}`} className="mt-1 block break-all text-sm font-semibold text-primary hover:underline">{application.email}</a>
                  {application.applicant_account_email && application.applicant_account_email !== application.email && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Requested a separate investor account. Current account: {application.applicant_account_email}</p>}
                  {application.applicant_account_email === application.email && <p className="mt-1 text-xs text-on-surface-variant">Approval upgrades the existing account.</p>}
                  {application.phone && <a href={`tel:${application.phone}`} className="mt-1 block text-sm text-on-surface-variant hover:text-primary">{application.phone}</a>}
                  {application.location && <p className="mt-1 text-sm text-on-surface-variant">{application.location}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[application.status] || "bg-surface-container text-on-surface"}`}>{application.status}</span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-surface-container p-4 text-xs">
                <div><dt className="text-on-surface-variant">Submitted</dt><dd className="mt-1 font-semibold text-on-surface">{formatDate(application.created_at)}</dd></div>
                <div><dt className="text-on-surface-variant">Reviewed</dt><dd className="mt-1 font-semibold text-on-surface">{formatDate(application.reviewed_at)}</dd></div>
                {application.pan_number && <div><dt className="text-on-surface-variant">PAN number</dt><dd className="mt-1 font-mono font-semibold uppercase text-on-surface">{application.pan_number}</dd></div>}
                {application.aadhar_number && <div><dt className="text-on-surface-variant">Aadhaar number</dt><dd className="mt-1 font-mono font-semibold text-on-surface">{String(application.aadhar_number).replace(/(\d{4})(?=\d)/g, "$1 ")}</dd></div>}
              </dl>

              {application.message && <div className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Application details</h4><p className="mt-2 whitespace-pre-wrap rounded-lg border border-outline-variant/25 p-4 text-sm leading-6 text-on-surface">{application.message}</p></div>}

              <div className="mt-4 flex flex-wrap gap-2">
                {application.resume && <a href={mediaUrl(application.resume)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-primary/35 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"><i className="fa-solid fa-file-arrow-down" />Open investor document</a>}
              </div>

              {application.status === "PENDING" ? <div className="mt-5 border-t border-outline-variant/25 pt-5">
                <label className="block text-xs font-semibold text-on-surface-variant">Review notes<textarea value={notes[application.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} rows={3} maxLength={2000} className="mt-2 w-full resize-y rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" placeholder="Optional internal decision notes" /></label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={reviewingId === application.id} onClick={() => review(application, "APPROVE")} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"><i className="fa-solid fa-check mr-2" />Approve application</button>
                  <button type="button" disabled={reviewingId === application.id} onClick={() => review(application, "REJECT")} className="rounded-lg border border-error/40 px-4 py-2.5 text-sm font-semibold text-error disabled:opacity-60"><i className="fa-solid fa-xmark mr-2" />Reject</button>
                </div>
              </div> : application.review_notes && <div className="mt-4 rounded-lg bg-surface-container p-4 text-sm"><span className="font-semibold text-on-surface">Review notes:</span> <span className="text-on-surface-variant">{application.review_notes}</span></div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
