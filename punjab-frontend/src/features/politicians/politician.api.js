/**
 * Politicians & parties API — backed by the backend's GET /politicians and
 * GET /parties (see indian-rajniti-backend/src/controllers/politicians/
 * politicians.controller.js). Real, WebSearch-verified biographical data
 * (education, career timeline, current status) and real photos, not the
 * dummy data this file used to return. Every exported function keeps its
 * original name/shape so no consuming component needed to change.
 */
import { mediaUrl } from "@/lib/api";
import { createJsonResource } from "@/lib/jsonResource";
import { withSiteHeaders } from "@/lib/siteRequest";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

const POLITICIAN_UPLOAD_ALIASES = {
  "c-p-radhakrishnan": "cp-radhakrishnan",
  "dr-manmohan-singh": "manmohan-singh",
  "i-k-gujral": "ik-gujral",
  "h-d-deve-gowda": "hd-deve-gowda",
  "p-v-narasimha-rao": "pv-narasimha-rao",
  "v-p-singh": "vp-singh",
};

const PARTY_UPLOAD_ALIASES = { "jd-u": "jdu", "cpi-m": "cpim" };

const getPoliticiansData = createJsonResource(`${API_BASE_URL}/politicians`, {
  ttl: 30_000,
  fetchOptions: () => withSiteHeaders({ next: { revalidate: 30 } }),
});

const getPartiesData = createJsonResource(`${API_BASE_URL}/parties`, {
  ttl: 0,
  fetchOptions: () => withSiteHeaders({ cache: "no-store" }),
});

async function readPoliticiansData() {
  try {
    return await getPoliticiansData();
  } catch {
    return { keyFigures: [], formerPMs: [], chiefMinisters: [] };
  }
}

async function readPartiesData() {
  try {
    return await getPartiesData();
  } catch {
    return { parties: [] };
  }
}

function normalizeCareerTimeline(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const [role = "", organization = "", fromYear = "", toYear = ""] = entry
          .split("|")
          .map((item) => item.trim());
        return { role, organization, fromYear, toYear };
      }
      if (!entry || typeof entry !== "object") return null;
      return {
        role: entry.role || entry.title || "",
        organization: entry.organization || "",
        fromYear: entry.fromYear || entry.from || entry.startYear || "",
        toYear: entry.toYear || entry.to || entry.endYear || "",
      };
    })
    .filter((entry) => entry?.role);
}

function toPoliticianShape(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    photo: mediaUrl(row.photo_url),
    photoFallback: mediaUrl(`/uploads/seed/politicians/${POLITICIAN_UPLOAD_ALIASES[row.slug] || row.slug}.jpg`),
    born: row.born_year,
    died: row.died_year,
    birthPlace: row.birth_place,
    party: row.party,
    state: row.state,
    currentPosition: row.current_position,
    stillInOffice: !!row.still_in_office,
    education: row.education || [],
    careerTimeline: normalizeCareerTimeline(row.career_timeline),
    summary: row.summary,
    bio: row.bio || [],
  };
}

export async function getKeyFigures() {
  const { keyFigures } = await readPoliticiansData();
  return (Array.isArray(keyFigures) ? keyFigures : []).map((row) => ({ ...toPoliticianShape(row), position: row.current_position }));
}

// Looks up a figure by exact name (case-insensitive) among key figures, so
// pages built from data that predates photo wiring (Parliament, Speeches)
// can still surface a real photo when the name matches a seeded key figure.
export function findFigureByName(keyFigures, name) {
  return keyFigures.find((figure) => figure.name.toLowerCase() === name.toLowerCase());
}

export async function getFormerPMs() {
  const { formerPMs } = await readPoliticiansData();
  return (Array.isArray(formerPMs) ? formerPMs : []).map((row) => ({
    ...toPoliticianShape(row),
    tenure: (row.current_position || "").replace(/^Former Prime Minister of India \(|\)$/g, ""),
  }));
}

export async function getChiefMinisters() {
  const { chiefMinisters } = await readPoliticiansData();
  return (Array.isArray(chiefMinisters) ? chiefMinisters : []).map((row) => ({
    ...toPoliticianShape(row),
    oppositionParty: row.opposition_party,
    since: row.since_year,
  }));
}

export async function getParties() {
  const { parties } = await readPartiesData();
  return (Array.isArray(parties) ? parties : []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    abbreviation: row.abbreviation,
    photo: mediaUrl(row.photo_url),
    photoFallback: mediaUrl(`/uploads/seed/parties/${PARTY_UPLOAD_ALIASES[row.slug] || row.slug}.jpg`),
    founded: row.founded_year ? String(row.founded_year) : null,
    foundedPlace: row.founded_place,
    founders: row.founders || [],
    ideology: row.ideology,
    yearsInPower: row.years_in_power,
    history: row.history,
    achievements: row.achievements,
    currentStatus: row.current_status,
  }));
}
