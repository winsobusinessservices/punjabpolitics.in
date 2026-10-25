import { allTeasers, getPageProfiles } from "@/features/news/news.api";
import { getKeyFigures, findFigureByName } from "@/features/politicians/politician.api";
import { createJsonResource } from "@/lib/jsonResource";
import { mediaUrl } from "@/lib/api";
import { pageProfile } from "@/features/events/events.api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";
const readParliamentResource = createJsonResource(`${API_BASE_URL}/parliament`, {
  ttl: 0,
  fetchOptions: { cache: "no-store" },
});

async function getHouses() {
  try {
    const { parliament } = await readParliamentResource();
    return parliament && typeof parliament === "object" && !Array.isArray(parliament) ? parliament : {};
  } catch {
    return {};
  }
}

function majorityBloc(composition) {
  if (!Array.isArray(composition) || !composition.length) return null;
  return [...composition].sort((left, right) => Number(right.seats) - Number(left.seats))[0];
}

export async function getParliamentSummary() {
  const houses = await getHouses();
  return [houses.loksabha, houses.rajyasabha]
    .filter(Boolean)
    .map((house) => {
      const leading = majorityBloc(house.composition);
      if (!leading) return null;
      return {
        key: house.key,
        href: house.href,
        label: house.label,
        totalSeats: house.totalSeats,
        presidingOfficer: house.presidingOfficer,
        leadingParty: leading.party,
        leadingSeats: leading.seats,
      };
    })
    .filter(Boolean);
}

export async function getHouseInfo(houseKey) {
  const houses = await getHouses();
  const data = houses[houseKey];
  if (!data || !Array.isArray(data.composition) || !data.leaderOfHouse || !data.leaderOfOpposition) return null;

  const allPosts = await allTeasers();
  const relatedSlugs = Array.isArray(data.relatedSlugs) ? data.relatedSlugs : [];
  const relatedNews = allPosts.filter((story) => relatedSlugs.includes(story.slug));
  const relatedSlugSet = new Set(relatedNews.map((story) => story.slug));
  const recommendedNews = allPosts.filter((story) => story.slug && !relatedSlugSet.has(story.slug)).slice(0, 4);

  const keyFigures = await getKeyFigures();
  const leaderOfHouseMatch = findFigureByName(keyFigures, data.leaderOfHouse.name);
  const leaderOfOppositionMatch = findFigureByName(keyFigures, data.leaderOfOpposition.name);
  const savedLeaderPhoto = mediaUrl(data.leaderOfHouse.photo);
  const savedOppositionPhoto = mediaUrl(data.leaderOfOpposition.photo);

  return {
    label: data.label,
    type: "house",
    description: `The ${data.label} (${data.fullName}) is one of the two houses of the Indian Parliament, currently comprising ${data.totalSeats} seats.`,
    current: { ...data.leaderOfHouse, icon: "fa-solid fa-user-tie", photo: savedLeaderPhoto || leaderOfHouseMatch?.photo, photoFallback: savedLeaderPhoto ? leaderOfHouseMatch?.photo : leaderOfHouseMatch?.photoFallback },
    opposition: { ...data.leaderOfOpposition, icon: "fa-solid fa-user-tie", photo: savedOppositionPhoto || leaderOfOppositionMatch?.photo, photoFallback: savedOppositionPhoto ? leaderOfOppositionMatch?.photo : leaderOfOppositionMatch?.photoFallback },
    currentLabel: "Leader of the House",
    oppositionLabel: "Leader of Opposition",
    bio: [data.history, data.achievements].filter(Boolean),
    facts: [
      { icon: "fa-solid fa-chair", label: `${data.totalSeats} total seats` },
      { icon: "fa-solid fa-landmark", label: data.currentTerm },
      data.presidingOfficer ? { icon: "fa-solid fa-gavel", label: `${data.presidingOfficer.role}: ${data.presidingOfficer.name}` } : null,
      data.deputyPresidingOfficer ? { icon: "fa-solid fa-user-tie", label: `${data.deputyPresidingOfficer.role}: ${data.deputyPresidingOfficer.name}` } : null,
    ].filter(Boolean),
    composition: data.composition,
    relatedNews,
    recommendedNews,
  };
}

export async function getElectionInfo() {
  const [profiles, houses, allPosts] = await Promise.all([getPageProfiles(), getHouses(), allTeasers()]);
  const page = pageProfile("elections", profiles);

  const relatedNews = allPosts.filter((story) => String(story.category || story.tag || "").toLowerCase().includes("election"));
  const relatedSlugSet = new Set(relatedNews.map((story) => story.slug));
  const recommendedNews = allPosts.filter((story) => story.slug && !relatedSlugSet.has(story.slug)).slice(0, 4);

  return {
    label: "Elections",
    type: "election",
    description: page.description,
    current: { ...(page.current || {}), icon: "fa-solid fa-people-group", photo: mediaUrl(page.current?.photo) },
    opposition: { ...(page.opposition || {}), icon: "fa-solid fa-people-group", photo: mediaUrl(page.opposition?.photo) },
    currentLabel: page.currentLabel,
    oppositionLabel: page.oppositionLabel,
    bio: Array.isArray(page.bio) ? page.bio : [],
    facts: (Array.isArray(page.facts) ? page.facts : []).map((label) => ({ icon: "fa-solid fa-box-ballot", label })),
    composition: Array.isArray(houses.loksabha?.composition) ? houses.loksabha.composition : [],
    relatedNews,
    recommendedNews,
  };
}
