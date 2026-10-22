"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { mediaUrl } from "@/lib/api";
import { PERMISSION_GROUPS } from "@/lib/permissions";

const ROLE_LABEL = {
  ADMIN: "Administrator",
  SUBADMIN: "Subadmin",
  EDITOR: "Editor",
  AUTHOR: "Author",
  INVESTOR: "Investor",
};

const permissionLabels = new Map(PERMISSION_GROUPS.flatMap((group) => group.permissions));

function formatDate(value, includeTime = false) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3.5">
      <dt className="font-label-md text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="mt-1 break-words font-body-md text-sm text-on-surface">{children || "Not available"}</dd>
    </div>
  );
}

export default function MemberDetailsModal({ member, onClose }) {
  const mounted = useIsClient();

  useEffect(() => {
    if (!member) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [member, onClose]);

  if (!mounted || !member) return null;

  const permissions = member.permissions || [];
  const documents = [
    ["PAN document", member.pan_document],
    ["Aadhaar document", member.aadhar_document],
    ["Graduation certificate", member.graduation_certificate],
  ].filter(([, path]) => path);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-label="Close member details" />
      <section className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-outline-variant/25 bg-surface-container-lowest shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="member-details-title">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-outline-variant/20 bg-surface-container-lowest px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="font-label-md text-xs font-semibold uppercase tracking-widest text-secondary">Team member</p>
            <h2 id="member-details-title" className="mt-1 truncate font-display-lg text-2xl text-primary">{member.name}</h2>
          </div>
          <button type="button" onClick={onClose} autoFocus className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container" aria-label="Close member details">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Full name">{member.name}</Detail>
            <Detail label="Email address">{member.email}</Detail>
            <Detail label="Role">{ROLE_LABEL[member.role] || member.role}</Detail>
            <Detail label="Status">{member.status}</Detail>
            <Detail label="Website">{member.site?.name || member.site_name || "Punjab Politics"}</Detail>
            <Detail label="Website domain">{member.site?.domain || member.site_domain}</Detail>
            <Detail label="Assigned reviewer">{["AUTHOR", "EDITOR"].includes(member.role) ? member.assigned_editor_name || "Unassigned" : "Not applicable"}</Detail>
            <Detail label="Joined">{formatDate(member.created_at, true)}</Detail>
            <Detail label="Terms accepted">{member.terms_accepted ? "Yes" : "No"}</Detail>
            <Detail label="Terms accepted on">{formatDate(member.terms_accepted_at, true)}</Detail>
          </dl>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-headline-md text-base text-primary">Privileges</h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{permissions.length} assigned</span>
            </div>
            {member.role === "ADMIN" ? (
              <p className="mt-3 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">Administrators have every privilege.</p>
            ) : permissions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {permissions.map((permission) => (
                  <span key={permission} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant">{permissionLabels.get(permission) || permission}</span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">No additional privileges assigned.</p>
            )}
          </section>

          <section>
            <h3 className="font-headline-md text-base text-primary">Verification documents</h3>
            {documents.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {documents.map(([label, path]) => (
                  <a key={label} href={mediaUrl(path)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5">
                    <span><i className="fa-solid fa-file-shield mr-2" aria-hidden="true" />{label}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">No verification documents are attached.</p>
            )}
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
