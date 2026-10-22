"use client";

import { PERMISSION_GROUPS } from "@/lib/permissions";

// Privileges grouped under collapsible dropdowns, one per section title
// (Content, Administration, Advertising…). The header shows how many of the
// group's privileges are selected, so nothing is hidden when a group is closed.
export default function PermissionGroupPicker({ selected, onToggle, disabled = false }) {
  return (
    <div className="space-y-2">
      {PERMISSION_GROUPS.map((group) => {
        const count = group.permissions.filter(([value]) => selected.includes(value)).length;
        return (
          <details key={group.label} className="group rounded-lg border border-outline-variant/25 bg-surface open:border-primary/30">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2.5 hover:bg-surface-container [&::-webkit-details-marker]:hidden">
              <span className="font-label-md text-sm font-semibold text-primary">{group.label}</span>
              <span className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 font-label-md text-[11px] ${count ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                  {count} / {group.permissions.length} selected
                </span>
                <i className="fa-solid fa-chevron-down text-xs text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="grid grid-cols-1 gap-1 border-t border-outline-variant/20 px-3 py-3 sm:grid-cols-2">
              {group.permissions.map(([value, label]) => (
                <label key={value} className="flex min-h-9 cursor-pointer items-start gap-2 rounded-md p-2 transition-colors hover:bg-surface-container">
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => onToggle(value)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 break-words font-body-md text-xs leading-5 text-on-surface-variant">{label}</span>
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
