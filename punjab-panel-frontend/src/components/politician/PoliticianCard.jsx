import Link from "next/link";
import Avatar from "@/components/common/Avatar";

function initials(name) {
  return name
    .replace(/^(Dr\.|Prof\.|I\.\s?K\.|H\.\s?D\.|P\.\s?V\.|M\.\s?K\.)\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function PoliticianCard({ name, subtitle, href, photo, photoFallback }) {
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex flex-col items-center text-center group cursor-pointer bg-surface p-4 rounded-lg border border-outline-variant/20 hover:shadow-md transition-all"
    >
      <Avatar
        photo={photo}
        fallbackPhoto={photoFallback}
        alt={name}
        fallbackText={initials(name)}
        gradient="from-primary to-primary-container"
        className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-surface group-hover:border-primary transition-all duration-300"
      />
      <h3 className="font-headline-md text-base text-on-surface group-hover:text-primary transition-colors">
        {name}
      </h3>
      <p className="font-body-md text-xs text-on-surface-variant">{subtitle}</p>
    </Wrapper>
  );
}
