import Link from "next/link";
import Avatar from "@/components/common/Avatar";
import { slugify } from "@/lib/slugify";

export default function PartyCard({ name, abbreviation, founded, photo, photoFallback, href }) {
  const partyHref = href || `/category/${slugify(abbreviation || name)}`;

  return (
    <Link
      href={partyHref}
      className="flex flex-col items-center text-center group cursor-pointer bg-surface p-4 rounded-lg border border-outline-variant/20 hover:shadow-md transition-all"
    >
      <Avatar
        photo={photo}
        fallbackPhoto={photoFallback}
        alt={name}
        fallbackText={abbreviation}
        gradient="from-secondary to-secondary-container"
        className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-surface group-hover:border-secondary transition-all duration-300"
      />
      <h3 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors leading-tight">
        {name}
      </h3>
      {founded && <p className="font-body-md text-xs text-on-surface-variant mt-1">Founded {founded}</p>}
    </Link>
  );
}
