import { getCurrentSite } from "@/lib/currentSite";
import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const site = await getCurrentSite().catch(() => ({ name: "Punjab Politics", domain: "punjabpolitics.com" }));
  const siteUrl = `https://${site.domain}`;
  let posts = [];
  try {
    const response = await fetch(`${API_BASE_URL}/news/home`, await withSiteHeaders({ cache: "no-store" }));
    if (response.ok) posts = (await response.json()).posts || [];
  } catch {
    // Return a valid empty news sitemap if the content API is temporarily unavailable.
  }

  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const recentPosts = posts.filter((post) => {
    const published = new Date(post.time);
    return post.slug && post.title && !post.syndicated && !Number.isNaN(published.getTime()) && published.getTime() >= cutoff;
  }).slice(0, 1000);

  const urls = recentPosts.map((post) => `
  <url>
    <loc>${escapeXml(`${siteUrl}/news/${post.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(site.name)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(new Date(post.time).toISOString())}</news:publication_date>
      <news:title>${escapeXml(post.title)}</news:title>
    </news:news>
  </url>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
