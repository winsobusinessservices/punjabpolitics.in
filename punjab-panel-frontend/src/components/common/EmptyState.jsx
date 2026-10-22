import Link from "next/link";

export default function EmptyState({ icon = "fa-inbox", title = "Nothing available", description, actionHref, actionLabel, compact = false }) {
  return (
    <div className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 text-center ${compact ? "p-5" : "p-8 md:p-10"}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>
      <h3 className="mt-3 font-headline-md text-base text-on-surface">{title}</h3>
      {description && <p className="mt-1 max-w-xl font-body-md text-sm leading-6 text-on-surface-variant">{description}</p>}
      {actionHref && actionLabel && <Link href={actionHref} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">{actionLabel}</Link>}
    </div>
  );
}
