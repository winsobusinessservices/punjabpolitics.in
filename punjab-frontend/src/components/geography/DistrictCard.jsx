import Link from "next/link";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";

export default function DistrictCard({ district }) {
  return (
    <Link href={`/district/${district.slug}`} className="group overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <ImagePlaceholder
        image={district.image}
        alt={`${district.name} district`}
        icon="fa-solid fa-map-location-dot"
        className="aspect-[16/10] w-full"
      />
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline-lg text-xl text-on-surface transition group-hover:text-primary">{district.name}</h2>
            <p className="mt-1 text-xs font-label-md uppercase tracking-wider text-secondary">{district.state}</p>
          </div>
          <i className="fa-solid fa-arrow-right mt-1 text-sm text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
        {district.description && <p className="line-clamp-3 text-sm leading-6 text-on-surface-variant">{district.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-on-surface-variant">
          {district.headquarters && <span className="rounded-full bg-surface-container px-2.5 py-1"><i className="fa-solid fa-building mr-1.5 text-primary" />{district.headquarters}</span>}
          {district.population && <span className="rounded-full bg-surface-container px-2.5 py-1"><i className="fa-solid fa-users mr-1.5 text-primary" />{district.population}</span>}
        </div>
      </div>
    </Link>
  );
}
