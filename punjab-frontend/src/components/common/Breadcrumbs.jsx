import Link from "next/link";
import { absoluteUrl, serializeJsonLd } from "@/lib/seo";

/**
 * Shared breadcrumb trail. `items` is the trail AFTER "Home"; the last item is the
 * current page (rendered as text, no link). Also emits BreadcrumbList JSON-LD.
 */
export default function Breadcrumbs({ items = [], className = "mb-6", withSchema = true }) {
  const trail = items.filter((item) => item?.label);
  const full = [{ label: "Home", href: "/" }, ...trail];
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: full.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={className}>
      {withSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-label-md text-on-surface-variant">
        {full.map((item, index) => {
          const last = index === full.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && <i className="fa-solid fa-chevron-right text-[9px]" aria-hidden="true" />}
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="max-w-[60vw] truncate text-primary md:max-w-md">{item.label}</span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-primary">{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
