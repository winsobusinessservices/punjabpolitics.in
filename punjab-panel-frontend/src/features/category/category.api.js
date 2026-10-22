import { slugify } from "@/lib/slugify";
import { allTeasers, getAllCategoryLabels, getCategoryDefinitions, getPostsForTopics } from "@/features/news/news.api";
import {
  getChiefMinisters,
  getParties,
  getFormerPMs,
  getKeyFigures,
} from "@/features/politicians/politician.api";
import { getAllStatesAndUTs, getStateProfile } from "@/features/geography/geography.api";

// Fallback figures used whenever a page needs to show "the PM" or "the
// Leader of Opposition" without a more specific match (party counterpart,
// key-figure's rival, etc). Built from the real keyFigures data (by role,
// not a hardcoded name) so they carry a real photo and stay correct if
// either office changes hands — rather than two static name/role strings
// with no photo field, which is what previously left these cards blank.
function findNationalFigure(keyFigures, roleKeyword, fallbackName) {
  const match = keyFigures.find((figure) => figure.position?.toLowerCase().includes(roleKeyword));
  if (match) {
    return { name: match.name, role: `${match.position} — ${match.party}`, icon: "fa-solid fa-user-tie", photo: match.photo, photoFallback: match.photoFallback };
  }
  return { name: fallbackName, role: roleKeyword, icon: "fa-solid fa-user-tie" };
}

function findPartyByReference(parties, reference) {
  const value = String(reference || "").trim().toLowerCase();
  if (!value) return null;
  return parties.find((party) =>
    party.name?.trim().toLowerCase() === value ||
    party.abbreviation?.trim().toLowerCase() === value
  ) || null;
}

async function buildRegistry() {
  const [labels, categories, chiefMinisters, parties, formerPMs, keyFigures, statesAndUTs] = await Promise.all([
    getAllCategoryLabels(),
    getCategoryDefinitions(),
    getChiefMinisters(),
    getParties(),
    getFormerPMs(),
    getKeyFigures(),
    getAllStatesAndUTs(),
  ]);

  const NATIONAL_RULING = findNationalFigure(keyFigures, "prime minister", "Prime Minister");
  const NATIONAL_OPPOSITION = findNationalFigure(keyFigures, "leader of the opposition", "Leader of the Opposition");

  const registry = new Map();
  const add = (label, type, data) => {
    if (!label) return;
    const slug = slugify(label);
    if (!registry.has(slug)) registry.set(slug, { label, type, data });
  };

  // Register the complete database State/UT record before politician/topic
  // aliases. Previously a minimal `{ name }` CM-derived entry claimed the
  // state slug first, which discarded capital, history and achievements.
  statesAndUTs.forEach((place) => {
    add(place.name, "state", place);
    add(`Election in ${place.name}`, "topic");
  });
  chiefMinisters.forEach((cm) => {
    add(cm.name, "politician", { subtype: "cm", ...cm });
  });
  formerPMs.forEach((pm) => add(pm.name, "politician", { subtype: "former-pm", ...pm }));
  keyFigures.forEach((figure) => add(figure.name, "politician", { subtype: "key-figure", ...figure }));
  parties.forEach((party) => {
    if (party.slug && !registry.has(party.slug)) registry.set(party.slug, { label: party.name, type: "party", data: party });
    add(party.abbreviation, "party", party);
    add(party.name, "party", party);
  });
  // Dedicated state, politician and party records are registered first, so
  // a generic category can never replace their richer existing route data.
  categories.forEach((category) => {
    if (category.route_owner) return;
    const entry = { label: category.name, type: "topic", data: { content: category.content || null, categorySlug: category.slug } };
    if (!registry.has(category.slug)) registry.set(category.slug, entry);
    add(category.name, "topic", entry.data);
  });
  labels.forEach((label) => add(label, "topic"));

  return { registry, chiefMinisters, parties, NATIONAL_RULING, NATIONAL_OPPOSITION };
}

// Flat, search-friendly view of the same registry /category/[slug] resolves
// against — states, parties, politicians, and topics, each with the slug
// that already resolves correctly.
export async function getAllCategoryEntries() {
  const { registry } = await buildRegistry();
  return Array.from(registry.entries()).map(([slug, entry]) => ({
    slug,
    label: entry.label,
    type: entry.type,
  }));
}

export async function getStandaloneCategoryInfo(slug) {
  const categories = await getCategoryDefinitions();
  const category = categories.find((item) => item.slug === slug && !item.route_owner);
  if (!category) return null;
  const info = await getCategoryInfo(slug);
  return info?.managedCategorySlug === category.slug ? info : null;
}

export async function getCategoryInfo(slug) {
  const { registry, chiefMinisters, parties, NATIONAL_RULING, NATIONAL_OPPOSITION } = await buildRegistry();
  const aliases = {
    westbangal: "west-bengal",
    "west-bangal": "west-bengal",
  };
  const entry = registry.get(aliases[slug] || slug);
  if (!entry) return null;

  const { label, type, data } = entry;

  let current = NATIONAL_RULING;
  let opposition = NATIONAL_OPPOSITION;
  let currentLabel = "Ruling / Current";
  let oppositionLabel = "Opposition";
  let description = `Comprehensive coverage of ${label} — the latest developments, analysis, and updates from across Indian politics.`;
  let bio = null;
  let profile = null;

  if (type === "topic" && data?.content) description = data.content;

  if (type === "state") {
    const cm = chiefMinisters.find((c) => c.state.toLowerCase() === label.toLowerCase());
    const stateProfile = await getStateProfile(label);
    const currentCmName = stateProfile?.currentCmName || cm?.name;
    const currentCmParty = cm?.party;
    const oppositionPartyName = stateProfile?.oppositionParty || cm?.oppositionParty;
    const oppositionParty = findPartyByReference(parties, oppositionPartyName);

    if (cm || currentCmName) {
      current = { name: currentCmName, role: `Chief Minister, ${label}${cm?.party ? ` — ${cm.party}` : ""}`, icon: "fa-solid fa-user-tie", photo: stateProfile?.cmImage || cm?.photo, photoFallback: cm?.photoFallback };
      opposition = {
        name: stateProfile?.oppositionLeaderName || stateProfile?.oppositionParty || cm?.oppositionParty || "Opposition",
        role: `${stateProfile?.oppositionLeaderName ? "Opposition Leader" : "Principal Opposition"}${stateProfile?.oppositionParty ? ` — ${stateProfile.oppositionParty}` : ""}, ${label} Assembly`,
        icon: "fa-solid fa-people-group",
        photo: stateProfile?.oppositionLeaderImage || oppositionParty?.photo,
        photoFallback: oppositionParty?.photoFallback,
      };
      description = `${label}${cm?.party ? ` is governed by the ${cm.party}` : ""}, led by Chief Minister ${currentCmName}. Track the latest political developments, policy decisions, and electoral dynamics shaping ${label}.`;
    }
    if (!currentCmName && (stateProfile?.oppositionLeaderName || stateProfile?.oppositionParty)) {
      opposition = {
        name: stateProfile.oppositionLeaderName || stateProfile.oppositionParty,
        role: stateProfile.oppositionParty ? `Opposition Leader — ${stateProfile.oppositionParty}, ${label} Assembly` : `Opposition Leader, ${label} Assembly`,
        icon: "fa-solid fa-people-group",
        photo: stateProfile.oppositionLeaderImage || oppositionParty?.photo,
        photoFallback: oppositionParty?.photoFallback,
      };
    }

    const yearsAsRuler = cm?.since ? new Date().getFullYear() - cm.since : null;
    profile = {
      image: stateProfile?.image ?? null,
      capital: stateProfile?.capital ?? null,
      kind: stateProfile?.kind ?? null,
      currentCmName: currentCmName ?? null,
      oppositionLeaderName: stateProfile?.oppositionLeaderName ?? null,
      founded: stateProfile?.formed ?? null,
      history: stateProfile?.history ?? null,
      achievements: stateProfile?.achievements ?? null,
      rulingParty: currentCmParty ?? null,
      oppositionParty: stateProfile?.oppositionParty || cm?.oppositionParty || null,
      yearsAsRuler,
      rulerSince: cm?.since ?? null,
    };
  } else if (type === "party") {
    const party = parties.find(
      (p) => p.name.toLowerCase() === label.toLowerCase() || p.abbreviation.toLowerCase() === label.toLowerCase()
    );
    if (party) {
      const isRuling = party.abbreviation === "BJP";
      const counterpart = parties.find((p) => p.abbreviation === (isRuling ? "INC" : "BJP"));
      const partyAsCard = {
        name: `${party.name} (${party.abbreviation})`,
        role: isRuling ? "Ruling Party (National)" : "Opposition Party",
        icon: "fa-solid fa-flag",
        photo: party.photo,
        photoFallback: party.photoFallback,
      };
      const counterpartAsCard = counterpart
        ? {
            name: `${counterpart.name} (${counterpart.abbreviation})`,
            role: isRuling ? "Principal Opposition" : "Ruling Party (National)",
            icon: "fa-solid fa-flag",
            photo: counterpart.photo,
            photoFallback: counterpart.photoFallback,
          }
        : isRuling
          ? NATIONAL_OPPOSITION
          : NATIONAL_RULING;

      current = isRuling ? partyAsCard : counterpartAsCard;
      opposition = isRuling ? counterpartAsCard : partyAsCard;
      currentLabel = isRuling ? "Ruling Party" : "National Counterpart";
      description = `${party.name} (${party.abbreviation}), founded in ${party.founded}, is a major political party in India. Explore its latest activities, statements, and role in the current political landscape.`;

      profile = {
        founded: party.founded,
        foundedPlace: party.foundedPlace,
        founders: party.founders,
        ideology: party.ideology,
        history: party.history,
        achievements: party.achievements,
        yearsInPower: party.yearsInPower,
      };
    }
  } else if (type === "politician") {
    bio = data.bio ?? null;

    if (data.subtype === "cm") {
      const oppositionParty = findPartyByReference(parties, data.oppositionParty);
      current = { name: data.name, role: `Chief Minister, ${data.state} — ${data.party}`, icon: "fa-solid fa-user-tie", photo: data.photo, photoFallback: data.photoFallback };
      opposition = {
        name: data.oppositionParty,
        role: `Principal Opposition, ${data.state} Assembly`,
        icon: "fa-solid fa-people-group",
        photo: oppositionParty?.photo,
        photoFallback: oppositionParty?.photoFallback,
      };
      currentLabel = "Chief Minister";
      oppositionLabel = "Principal Opposition";
      const yearsAsRuler = data.since ? new Date().getFullYear() - data.since : null;
      description = `${data.name} serves as the Chief Minister of ${data.state}, representing the ${data.party}${
        yearsAsRuler ? `, in office since ${data.since} (around ${yearsAsRuler} years)` : ""
      }.`;
    } else if (data.subtype === "former-pm") {
      current = { name: data.name, role: `Former Prime Minister of India (${data.tenure})`, icon: "fa-solid fa-user-tie", photo: data.photo, photoFallback: data.photoFallback };
      opposition = NATIONAL_RULING;
      currentLabel = "Former Prime Minister";
      oppositionLabel = "Current Prime Minister";
      description = `${data.name} served as the Prime Minister of India (${data.tenure}). Explore their legacy and lasting impact on Indian politics.`;
    } else {
      const isOppositionFigure = data.position.toLowerCase().includes("opposition");
      current = { name: data.name, role: data.position, icon: "fa-solid fa-user-tie", photo: data.photo, photoFallback: data.photoFallback };
      opposition = isOppositionFigure ? NATIONAL_RULING : NATIONAL_OPPOSITION;
      currentLabel = "Featured Leader";
      oppositionLabel = isOppositionFigure ? "Ruling Counterpart" : "Principal Opposition";
      description = `${data.name} currently serves as ${data.position}. Follow their statements, policy positions, and role in shaping national politics.`;
    }
  }

  const topicTerms = [label];
  if (type === "party" && data) topicTerms.push(data.name, data.abbreviation);
  if (type === "politician" && data) topicTerms.push(data.name);
  if (type === "state") topicTerms.push(data?.name);
  const relatedNews = (await getPostsForTopics([...new Set(topicTerms.filter(Boolean))])).slice(0, 12);

  const relatedSlugs = new Set(relatedNews.map((story) => story.slug));
  const recommendedNews = allTeasers()
    .filter((story) => story.slug && !relatedSlugs.has(story.slug))
    .slice(0, 4);

  // Personal/education/career-timeline detail only exists for the
  // "politician" type (real biographical data) — undefined for state/party/
  // topic pages, which CategoryDetailView already treats as "nothing to show".
  const isPolitician = type === "politician";

  return {
    label,
    type,
    subtype: data?.subtype ?? null,
    managedCategorySlug: type === "topic" ? data?.categorySlug ?? null : null,
    description,
    current,
    opposition,
    currentLabel,
    oppositionLabel,
    bio,
    born: isPolitician ? data.born : null,
    died: isPolitician ? data.died : null,
    birthPlace: isPolitician ? data.birthPlace : null,
    education: isPolitician ? data.education : null,
    careerTimeline: isPolitician ? data.careerTimeline : null,
    profile,
    relatedNews,
    recommendedNews,
  };
}
