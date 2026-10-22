import EmptyState from "@/components/common/EmptyState";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import PostBody from "@/components/common/PostBody";
import { mediaUrl } from "@/lib/api";

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-surface-container-low px-4 py-3">
      <dt className="font-label-sm text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="mt-1 font-body-md text-sm font-semibold text-on-surface">{value}</dd>
    </div>
  );
}

export default function VidhanSabhaGrid({ items = [] }) {
  if (!items.length) {
    return <EmptyState compact icon="fa-landmark-dome" title="No Vidhan Sabha data available" description="Assembly details added through Punjab Site Data will appear here." />;
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {items.map((assembly) => (
        <article key={assembly.id || `${assembly.state}-${assembly.name}`} className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-sm">
          <div className="flex flex-col gap-4 bg-primary px-5 py-5 text-on-primary sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div>
              <p className="font-label-sm text-[10px] font-bold uppercase tracking-[0.18em] text-on-primary/75">{assembly.state}</p>
              <h3 className="mt-1 font-display-lg text-xl md:text-2xl">{assembly.name}</h3>
              {assembly.currentTerm && <p className="mt-1 text-xs text-on-primary/80">{assembly.currentTerm}</p>}
            </div>
            <div className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-full border border-white/30 bg-white/10">
              <strong className="font-display-lg text-2xl">{assembly.totalSeats}</strong>
              <span className="text-[10px] font-bold uppercase tracking-wider">Seats</span>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:p-6">
            <Detail label="Chief Minister" value={assembly.chiefMinister} />
            <Detail label="Speaker" value={assembly.speaker} />
            <Detail label="Ruling party" value={assembly.rulingParty} />
            <Detail label="Leader of Opposition" value={assembly.oppositionLeader} />
            <Detail label="Opposition party" value={assembly.oppositionParty} />
            <Detail label="Next election" value={assembly.nextElection} />
          </dl>

          {assembly.content && (
            <details className="group border-t border-outline-variant/30 px-5 py-4 md:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-label-md text-sm font-semibold text-primary">
                Read full details
                <i className="fa-solid fa-chevron-down text-xs transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4"><PostBody content={assembly.content} /></div>
            </details>
          )}
        </article>
      ))}
    </div>
  );
}
