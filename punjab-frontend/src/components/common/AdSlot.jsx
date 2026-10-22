import { mediaUrl } from "@/lib/api";
import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

// When several ads share a placement, one is picked per page request.
async function getLiveAd(placement) {
  try {
    const response = await fetch(`${API_BASE_URL}/ads?placement=${encodeURIComponent(placement)}`, await withSiteHeaders({ cache: "no-store" }));
    if (!response.ok) return null;
    const ads = (await response.json()).ads || [];
    return ads.length ? ads[Math.floor(Math.random() * ads.length)] : null;
  } catch {
    return null;
  }
}

// Maximum rendered size per placement (standard IAB ad sizes). Images are fitted
// inside the box and centered, never stretched to the column width.
const SIZES = {
  home_banner: { maxWidth: 728, maxHeight: 90 },
  article_inline: { maxWidth: 728, maxHeight: 90 },
  sidebar_left: { maxWidth: 300, maxHeight: 250 },
  sidebar_right: { maxWidth: 300, maxHeight: 250 },
};

// Server component. Renders a real, advertiser-supplied ad for the placement
// (managed under Advertisements in the panel) or nothing at all when no ad is
// live — so empty slots never leave a blank box on the page.
export default async function AdSlot({ placement, className = "" }) {
  const ad = await getLiveAd(placement);
  if (!ad) return null;
  const size = SIZES[placement] || SIZES.sidebar_left;

  const href = `${API_BASE_URL}/ads/${ad.id}/click`;
  const linkProps = { href, target: "_blank", rel: "sponsored noopener noreferrer" };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span className="font-label-sm text-outline-variant uppercase tracking-widest mb-1 text-[8px]">ADVERTISEMENT</span>
      {ad.headline ? (
        // Text ad: logo + site name, headline, description and a button. The whole card is one link.
        <a {...linkProps} className="flex gap-4 group block w-full rounded-lg border border-outline-variant/40 bg-surface p-4 transition-shadow hover:shadow-md" style={{ maxWidth: size.maxWidth }}>
          {(ad.logo_url || ad.display_url) && (
            <div className="mb-3 flex items-center gap-2">
              {ad.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(ad.logo_url)} alt={ad.advertiser} loading="lazy" className="h-30 w-30 w-auto  object-contain" />
              )}
            </div>
          )}
          <div className="flex flex-col items-start gap-1 p-4">
            {ad.display_url && <span className="truncate text-xs text-on-surface-variant">{ad.display_url}</span>}

           <p className="font-headline-md text-base leading-snug text-primary">{ad.headline}</p>
          {ad.description && <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{ad.description}</p>}
          <span className="mt-3 inline-block rounded bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary group-hover:opacity-90">{ad.cta_label || "Learn more"}</span>

          </div>
     
        </a>
      ) : (
        <a {...linkProps} className="flex items-center justify-center overflow-hidden rounded-sm" style={{ maxWidth: size.maxWidth, minHeight: size.maxHeight }}>
          {/* Advertiser images come from uploads or arbitrary hosts, so a plain <img> avoids next/image host allowlisting. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(ad.image_url)} alt={ad.alt_text || ad.title} loading="lazy" className="block h-auto w-auto max-w-full object-contain" style={{ maxHeight: size.maxHeight }} />
        </a>
      )}
    </div>
  );
}
