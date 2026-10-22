import { createJsonResource } from "@/lib/jsonResource";
import { mediaUrl } from "@/lib/api";
import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

const readDistricts = createJsonResource(`${API_BASE_URL}/districts`, {
  ttl: 0,
  fetchOptions: () => withSiteHeaders({ cache: "no-store" }),
});

function toDistrict(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    headquarters: row.headquarters,
    division: row.division,
    image: mediaUrl(row.image_url),
    established: row.established,
    area: row.area,
    population: row.population,
    lokSabhaConstituencies: row.lok_sabha_constituencies,
    vidhanSabhaConstituencies: row.vidhan_sabha_constituencies,
    description: row.description,
    content: row.content,
  };
}

export async function getDistricts() {
  try {
    const data = await readDistricts();
    return Array.isArray(data.districts) ? data.districts.map(toDistrict) : [];
  } catch {
    return [];
  }
}

export async function getDistrictBySlug(slug) {
  try {
    const response = await fetch(`${API_BASE_URL}/districts/${encodeURIComponent(slug)}`, await withSiteHeaders({ cache: "no-store" }));
    if (!response.ok) return null;
    const data = await response.json();
    return toDistrict(data.district);
  } catch {
    return null;
  }
}
