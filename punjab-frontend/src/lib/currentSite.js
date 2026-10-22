import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

export async function getCurrentSite() {
  const response = await fetch(`${API_BASE_URL}/sites/current`, await withSiteHeaders({ cache: "no-store" }));
  if (!response.ok) throw new Error("Website configuration is unavailable");
  const data = await response.json();
  return data.site;
}
