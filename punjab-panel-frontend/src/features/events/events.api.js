/**
 * Speeches and Rallies detail info — built on top of the SPEECHES/RALLIES
 * teaser lists in news.api.js (so every card here is a real /news/[slug]
 * page), shaped for the same CategoryDetailView used by /category/[slug]
 * and the Lok Sabha / Rajya Sabha / Elections pages.
 */
import { allTeasers, getSpeeches, getRallies, getPageProfiles } from "@/features/news/news.api";
import { getKeyFigures, findFigureByName } from "@/features/politicians/politician.api";
import { DEFAULT_PAGE_PROFILES } from "@/features/events/pageProfiles";
import { mediaUrl } from "@/lib/api";

function pageProfile(key, profiles) {
  const defaults = DEFAULT_PAGE_PROFILES[key];
  const saved = profiles?.[key] || {};
  return { ...defaults, ...saved, current: { ...defaults.current, ...saved.current }, opposition: { ...defaults.opposition, ...saved.opposition } };
}

export async function getSpeechesInfo() {
  const [relatedNews, profiles] = await Promise.all([getSpeeches(), getPageProfiles()]);
  const page = pageProfile("speeches", profiles);
  const relatedSlugSet = new Set(relatedNews.map((story) => story.slug));
  const recommendedNews = allTeasers()
    .filter((story) => story.slug && !relatedSlugSet.has(story.slug))
    .slice(0, 4);

  const keyFigures = await getKeyFigures();
  const modi = findFigureByName(keyFigures, "Narendra Modi");
  const rahulGandhi = findFigureByName(keyFigures, "Rahul Gandhi");

  return {
    label: "Speeches",
    type: "speech",
    description: page.description,
    current: { ...page.current, icon: "fa-solid fa-user-tie", photo: mediaUrl(page.current.photo) || modi?.photo, photoFallback: modi?.photoFallback },
    opposition: { ...page.opposition, icon: "fa-solid fa-user-tie", photo: mediaUrl(page.opposition.photo) || rahulGandhi?.photo, photoFallback: rahulGandhi?.photoFallback },
    currentLabel: page.currentLabel,
    oppositionLabel: page.oppositionLabel,
    bio: page.bio,
    facts: page.facts.map((label) => ({ icon: "fa-solid fa-microphone", label })),
    relatedNews,
    recommendedNews,
  };
}

export async function getRalliesInfo() {
  const [relatedNews, profiles] = await Promise.all([getRallies(), getPageProfiles()]);
  const page = pageProfile("rallies", profiles);
  const relatedSlugSet = new Set(relatedNews.map((story) => story.slug));
  const recommendedNews = allTeasers()
    .filter((story) => story.slug && !relatedSlugSet.has(story.slug))
    .slice(0, 4);

  return {
    label: "Rallies",
    type: "rally",
    description: page.description,
    current: { ...page.current, icon: "fa-solid fa-people-group", photo: mediaUrl(page.current.photo) },
    opposition: { ...page.opposition, icon: "fa-solid fa-people-group", photo: mediaUrl(page.opposition.photo) },
    currentLabel: page.currentLabel,
    oppositionLabel: page.oppositionLabel,
    bio: page.bio,
    facts: page.facts.map((label) => ({ icon: "fa-solid fa-bullhorn", label })),
    relatedNews,
    recommendedNews,
  };
}
