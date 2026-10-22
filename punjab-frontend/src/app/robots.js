import { getCurrentSite } from "@/lib/currentSite";

export const dynamic = "force-dynamic";

export default async function robots() {
  const site = await getCurrentSite().catch(() => ({ domain: "punjabpolitics.com" }));
  const siteUrl = `https://${site.domain}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/author/", "/login", "/register", "/forgot-password", "/reset-password", "/search"],
    },
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/news-sitemap.xml`],
    host: siteUrl,
  };
}
