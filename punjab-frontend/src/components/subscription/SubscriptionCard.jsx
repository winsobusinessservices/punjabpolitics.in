import Link from "next/link";

/**
 * One plan on the subscription page (Free or Premium).
 *   features      what the plan includes
 *   notIncluded   what it does not (shown crossed out, so the two plans are easy to compare)
 *   highlighted   the recommended plan gets a stronger border and a ribbon
 */
export default function SubscriptionCard({ name, price, period, tagline, features, notIncluded = [], cta, highlighted = false, icon }) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border bg-surface p-6 shadow-sm md:p-8 ${
        highlighted ? "border-2 border-primary shadow-md" : "border-outline-variant/40"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-label-sm text-[11px] font-bold uppercase tracking-wider text-on-secondary">
          <i className="fa-solid fa-crown text-[10px]" aria-hidden="true" /> Recommended
        </span>
      )}

      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${highlighted ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"}`}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </span>
        <h2 className="font-headline-md text-2xl text-primary">{name}</h2>
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display-lg text-4xl text-on-surface md:text-5xl">{price}</span>
        {period && <span className="font-body-md text-sm text-on-surface-variant">{period}</span>}
      </p>
      <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">{tagline}</p>

      <ul className="mt-6 flex-grow space-y-3 border-t border-outline-variant/30 pt-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 font-body-md text-sm text-on-surface">
            <i className="fa-solid fa-circle-check mt-0.5 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
        {notIncluded.map((feature) => (
          <li key={feature} className="flex items-start gap-3 font-body-md text-sm text-on-surface-variant/70">
            <i className="fa-solid fa-circle-xmark mt-0.5" aria-hidden="true" />
            <span className="line-through decoration-on-surface-variant/40">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className={`mt-8 block rounded-lg px-6 py-3.5 text-center font-label-md text-base font-semibold transition-opacity hover:opacity-90 ${
          highlighted ? "bg-primary text-on-primary" : "border border-outline-variant/60 text-primary hover:border-primary"
        }`}
      >
        {cta.label}
      </Link>
    </article>
  );
}
