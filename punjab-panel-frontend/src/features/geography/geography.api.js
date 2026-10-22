import { createJsonResource } from "@/lib/jsonResource";
import { mediaUrl } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

const readGeographyResource = createJsonResource(`${API_BASE_URL}/states`, {
  ttl: 0,
  fetchOptions: { cache: "no-store" },
});

async function getGeographyData() {
  const { states } = await readGeographyResource();
  return states;
}

function toPlace(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    capital: row.capital,
    image: mediaUrl(row.image_url),
    currentCmName: row.current_cm_name,
    cmImage: mediaUrl(row.cm_image_url),
    oppositionLeaderName: row.opposition_leader_name,
    oppositionParty: row.opposition_party,
    oppositionLeaderImage: mediaUrl(row.opposition_leader_image_url),
    kind: row.kind,
    formed: row.formed,
    history: row.history,
    achievements: row.achievements,
  };
}

export async function getStates() {
  return (await getGeographyData()).filter((row) => row.kind === "STATE").map(toPlace);
}

export async function getUnionTerritories() {
  return (await getGeographyData()).filter((row) => row.kind === "UNION_TERRITORY").map(toPlace);
}

export async function getAllStatesAndUTs() {
  return (await getGeographyData()).map(toPlace);
}

export async function getStateProfile(stateName) {
  const state = (await getGeographyData()).find((row) => row.name.toLowerCase() === stateName.toLowerCase());
  return state ? toPlace(state) : null;
}
