const Politician = require("../../models/politician.model");
const Party = require("../../models/party.model");
const State = require("../../models/state.model");
const District = require("../../models/district.model");
const HomeWidget = require("../../models/homeWidget.model");
const UiSection = require("../../models/uiSection.model");
const DeletionAudit = require("../../models/deletionAudit.model");
const { sanitizeRichText } = require("../../utils/richText");

const POLITICIAN_CATEGORIES = ["KEY_FIGURE", "FORMER_PM", "CHIEF_MINISTER", "PARTY_LEADER"];
const STATE_KINDS = ["STATE", "UNION_TERRITORY"];

function managedSiteId(req) {
  return Number(
    (req.user?.role === "ADMIN" && (req.get("x-management-site-id") || req.query?.siteId || req.body?.siteId))
    || req.user?.siteId
    || req.site?.id
    || 1
  );
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function text(value, max = 10000) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function integer(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function array(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split("\n").map((item) => item.trim()).filter(Boolean);
  }
}

function careerTimeline(value) {
  return array(value).map((entry) => {
    if (typeof entry === "string") {
      const [role = "", organization = "", fromYear = "", toYear = ""] = entry
        .split("|")
        .map((item) => item.trim());
      return { role, organization, fromYear, toYear };
    }
    if (!entry || typeof entry !== "object") return null;
    return {
      role: text(entry.role ?? entry.title, 500) || "",
      organization: text(entry.organization, 500) || "",
      fromYear: text(entry.fromYear ?? entry.from ?? entry.startYear, 50) || "",
      toYear: text(entry.toYear ?? entry.to ?? entry.endYear, 50) || "",
    };
  }).filter((entry) => entry?.role);
}

function politicianInput(body, existing) {
  const name = text(body.name, 150);
  const category = String(body.category || "").toUpperCase();
  if (!name || !POLITICIAN_CATEGORIES.includes(category)) throw new Error("Name and a valid politician category are required");
  return {
    slug: existing?.slug || slugify(body.slug || name),
    name,
    photoUrl: text(body.photoUrl ?? body.photo_url, 2000),
    replacePhoto: true,
    bornYear: integer(body.bornYear ?? body.born_year),
    diedYear: integer(body.diedYear ?? body.died_year),
    birthPlace: text(body.birthPlace ?? body.birth_place, 250),
    party: text(body.party, 250),
    state: text(body.state, 150),
    category,
    currentPosition: text(body.currentPosition ?? body.current_position, 500),
    stillInOffice: bool(body.stillInOffice ?? body.still_in_office) ? 1 : 0,
    oppositionParty: text(body.oppositionParty ?? body.opposition_party, 250),
    sinceYear: integer(body.sinceYear ?? body.since_year),
    education: array(body.education),
    careerTimeline: careerTimeline(body.careerTimeline ?? body.career_timeline),
    summary: text(body.summary, 2000),
    bio: array(body.bio),
    sortOrder: integer(body.sortOrder ?? body.sort_order, existing?.sort_order || 0),
  };
}

function partyInput(body, existing) {
  const name = text(body.name, 200);
  const abbreviation = text(body.abbreviation, 30);
  if (!name || !abbreviation) throw new Error("Party name and abbreviation are required");
  return {
    slug: existing?.slug || slugify(body.slug || abbreviation), name, abbreviation,
    photoUrl: text(body.photoUrl ?? body.photo_url, 2000),
    replacePhoto: true,
    foundedYear: integer(body.foundedYear ?? body.founded_year),
    foundedPlace: text(body.foundedPlace ?? body.founded_place, 250),
    founders: array(body.founders), ideology: text(body.ideology, 2000),
    history: text(body.history), achievements: text(body.achievements),
    currentStatus: text(body.currentStatus ?? body.current_status, 3000),
    yearsInPower: text(body.yearsInPower ?? body.years_in_power, 1000),
    sortOrder: integer(body.sortOrder ?? body.sort_order, existing?.sort_order || 0),
  };
}

function stateInput(body, existing) {
  const name = text(body.name, 150);
  const kind = String(body.kind || "STATE").toUpperCase();
  if (!name || !STATE_KINDS.includes(kind)) throw new Error("State name and a valid kind are required");
  return {
    slug: existing?.slug || slugify(body.slug || name), name,
    capital: text(body.capital, 150),
    imageUrl: text(body.imageUrl ?? body.image_url, 2000),
    currentCmName: text(body.currentCmName ?? body.current_cm_name, 200),
    cmImageUrl: text(body.cmImageUrl ?? body.cm_image_url, 2000),
    oppositionLeaderName: text(body.oppositionLeaderName ?? body.opposition_leader_name, 200),
    oppositionParty: text(body.oppositionParty ?? body.opposition_party, 250),
    oppositionLeaderImageUrl: text(body.oppositionLeaderImageUrl ?? body.opposition_leader_image_url, 2000),
    kind, formed: text(body.formed, 150),
    history: text(body.history), achievements: text(body.achievements),
    sortOrder: integer(body.sortOrder ?? body.sort_order, existing?.sort_order || 0),
  };
}

function districtInput(body, existing) {
  const name = text(body.name, 150);
  const state = text(body.state, 150);
  if (!name || !state) throw new Error("District name and state are required");
  return {
    slug: existing?.slug || slugify(body.slug || name), name, state,
    headquarters: text(body.headquarters, 150),
    division: text(body.division, 150),
    imageUrl: text(body.imageUrl ?? body.image_url, 2000),
    established: text(body.established, 150),
    area: text(body.area, 100),
    population: text(body.population, 100),
    lokSabhaConstituencies: text(body.lokSabhaConstituencies ?? body.lok_sabha_constituencies, 500),
    vidhanSabhaConstituencies: text(body.vidhanSabhaConstituencies ?? body.vidhan_sabha_constituencies, 1000),
    description: text(body.description, 3000),
    content: text(body.content, 1000000),
    sortOrder: integer(body.sortOrder ?? body.sort_order, existing?.sort_order || 0),
  };
}

async function listReferenceData(req, res) {
  const [politicians, parties, states, districts, widgets] = await Promise.all([
    Politician.findAll({ siteId: managedSiteId(req) }), Party.findAll({ siteId: managedSiteId(req) }), State.findAll({ siteId: managedSiteId(req) }), District.findAll({ siteId: managedSiteId(req) }),
    HomeWidget.getAll(managedSiteId(req)),
  ]);
  const parliament = widgets.parliament_data || null;
  const pageProfiles = widgets.page_profiles || null;
  return res.json({
    success: true,
    politicians,
    parties,
    states,
    districts,
    parliament,
    loksabha: parliament?.loksabha || null,
    rajyasabha: parliament?.rajyasabha || null,
    elections: pageProfiles?.elections || null,
    events: widgets.political_calendar || [],
    rallies: widgets.political_rallys || [],
    upcomingElections: widgets.upcoming_elections || [],
    vidhanSabhas: widgets.vidhan_sabhas || [],
    homeWidgets: widgets,
    pageProfiles,
  });
}

function crudHandlers(model, input, label, entityType) {
  return {
    create: async (req, res) => {
      try {
        const siteId = managedSiteId(req);
        const data = { ...input(req.body), siteId };
        await model.upsert(data);
        return res.status(201).json({ success: true, message: `${label} created`, item: await model.findBySlug(data.slug, siteId) });
      } catch (error) {
        const duplicate = error.code === "ER_DUP_ENTRY";
        return res.status(duplicate ? 409 : 400).json({ success: false, message: duplicate ? `${label} already exists` : error.message });
      }
    },
    update: async (req, res) => {
      try {
        const siteId = managedSiteId(req);
        const existing = await model.findById(req.params.id, siteId);
        if (!existing) return res.status(404).json({ success: false, message: `${label} not found` });
        const data = { ...input(req.body, existing), siteId };
        await model.upsert(data);
        return res.json({ success: true, message: `${label} updated`, item: await model.findBySlug(data.slug, siteId) });
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    },
    remove: async (req, res) => {
      if (!(await model.findById(req.params.id, managedSiteId(req)))) return res.status(404).json({ success: false, message: `${label} not found for this website` });
      const deleted = await DeletionAudit.softDelete({ entityType, entityId: req.params.id, deletedBy: req.user.userId, reason: req.body?.reason });
      if (!deleted) return res.status(404).json({ success: false, message: `${label} not found` });
      return res.json({ success: true, message: `${label} moved to deleted items` });
    },
  };
}

const politicianCrud = crudHandlers(Politician, politicianInput, "Politician", "POLITICIAN");
const partyCrud = crudHandlers(Party, partyInput, "Party", "PARTY");
const stateCrud = crudHandlers(State, stateInput, "State/UT", "STATE");
const districtCrud = crudHandlers(District, districtInput, "District", "DISTRICT");

async function updateParliament(req, res) {
  const parliament = req.body.parliament;
  if (!parliament || typeof parliament !== "object" || Array.isArray(parliament)) {
    return res.status(400).json({ success: false, message: "Parliament details are required" });
  }
  await HomeWidget.upsert("parliament_data", parliament, managedSiteId(req));
  return res.json({ success: true, message: "Parliament data updated", parliament });
}

const SCHEDULE_WIDGETS = { events: "political_calendar", rallies: "political_rallys", upcomingElections: "upcoming_elections" };
const SCHEDULE_LABELS = { events: "Events", rallies: "Rallies", upcomingElections: "Upcoming elections" };

async function updateSchedule(req, res) {
  const widgetKey = SCHEDULE_WIDGETS[req.params.type];
  if (!widgetKey) return res.status(404).json({ success: false, message: "Schedule type not found" });
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ success: false, message: "Schedule items are required" });
  }
  const items = req.body.items.map((item, index) => ({
    id: text(item.id, 100) || `${Date.now()}-${index}`,
    date: text(item.date, 100),
    title: text(item.title, 500),
  }));
  if (items.some((item) => !item.date || !item.title)) {
    return res.status(400).json({ success: false, message: "Date and title are required for every item" });
  }
  await HomeWidget.upsert(widgetKey, items, managedSiteId(req));
  return res.json({ success: true, message: `${SCHEDULE_LABELS[req.params.type]} updated`, items });
}

async function updateVidhanSabhas(req, res) {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ success: false, message: "Vidhan Sabha records are required" });
  }
  const items = req.body.items.map((item, index) => ({
    id: text(item.id, 100) || `${Date.now()}-${index}`,
    state: text(item.state, 150),
    name: text(item.name, 200),
    totalSeats: integer(item.totalSeats ?? item.total_seats, 0),
    chiefMinister: text(item.chiefMinister ?? item.chief_minister, 200),
    rulingParty: text(item.rulingParty ?? item.ruling_party, 150),
    speaker: text(item.speaker, 200),
    oppositionLeader: text(item.oppositionLeader ?? item.opposition_leader, 200),
    oppositionParty: text(item.oppositionParty ?? item.opposition_party, 150),
    currentTerm: text(item.currentTerm ?? item.current_term, 250),
    nextElection: text(item.nextElection ?? item.next_election, 150),
    imageUrl: text(item.imageUrl ?? item.image_url, 2000),
    content: text(sanitizeRichText(item.content), 1000000),
  }));
  if (items.some((item) => !item.state || !item.name || item.totalSeats < 1)) {
    return res.status(400).json({ success: false, message: "State, assembly name and total seats are required" });
  }
  // Each website covers one state, and a state has exactly one Vidhan Sabha.
  if (items.length > 1) {
    return res.status(400).json({ success: false, message: "A website can have only one Vidhan Sabha. Edit the existing record instead of adding another." });
  }
  await HomeWidget.upsert("vidhan_sabhas", items, managedSiteId(req));
  return res.json({ success: true, message: "Vidhan Sabha data updated", items });
}

async function getVidhanSabhas(req, res) {
  const widgets = await HomeWidget.getAll(managedSiteId(req));
  return res.json({ success: true, vidhanSabhas: widgets.vidhan_sabhas || [] });
}

async function updateHomeWidget(req, res) {
  const widgetKey = String(req.params.key || "").trim();
  const siteId = req.user.role === "ADMIN" ? Number(req.body.siteId || req.get("x-management-site-id") || req.user.siteId) : req.user.siteId;
  const widgets = await HomeWidget.getAll(siteId);
  if (!Object.prototype.hasOwnProperty.call(widgets, widgetKey)) {
    return res.status(404).json({ success: false, message: "Home widget not found" });
  }
  if (req.body.data === undefined) {
    return res.status(400).json({ success: false, message: "Widget data is required" });
  }
  let data = req.body.data;
  if (widgetKey === "poll_of_the_day") {
    const question = text(data?.question, 500);
    const options = Array.isArray(data?.options) ? data.options.slice(0, 2).map((option) => ({ label: text(option.label, 250), votes: 0, pct: 0 })) : [];
    if (!question || options.length !== 2 || options.some((option) => !option.label)) {
      return res.status(400).json({ success: false, message: "A poll question and exactly two options are required" });
    }
    data = { question, options, totalVotes: 0 };
  }
  if (widgetKey === "homepage_labels") {
    if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ success: false, message: "Homepage labels must be an object" });
    const cleaned = {};
    for (const [key, value] of Object.entries(data).slice(0, 100)) {
      const title = text(value?.title, 150);
      if (!title) return res.status(400).json({ success: false, message: "Every homepage section title is required" });
      cleaned[text(key, 100)] = { ...value, title };
    }
    data = cleaned;
  }
  if (widgetKey === "home_video") {
    const isPath = (value) => !value || value.startsWith("/uploads/") || /^https?:///i.test(value);
    const videoUrl = text(data?.videoUrl, 500);
    const posterUrl = text(data?.posterUrl, 500);
    if (!isPath(videoUrl) || !isPath(posterUrl)) {
      return res.status(400).json({ success: false, message: "Video and poster must be uploaded files or http(s) links" });
    }
    const enabled = data?.enabled === true;
    if (enabled && !videoUrl) return res.status(400).json({ success: false, message: "Upload a video before showing it on the homepage" });
    data = {
      enabled,
      title: text(data?.title, 150) || "Watch",
      videoUrl,
      posterUrl,
      placement: ["after_hero", "main_content", "above_footer"].includes(data?.placement) ? data.placement : "above_footer",
    };
  }
  if (widgetKey === "homepage_sections") {
    const allowedTypes = new Set(["builtin", "top_news", "latest_news", "leaders", "services", "blogs", "videos", "parties"]);
    const allowedBuiltinSections = new Set(["top_stories", "vidhan_sabha", "editorial_opinion", "latest_blogs", "regional_focus", "in_depth_analysis", "multimedia_hub", "main_ad", "key_figures", "former_prime_ministers", "voices_of_nation", "state_leadership", "political_parties", "parliament", "digital_dispatches", "cm_corner", "pm_corner", "press_conferences"]);
    if (!Array.isArray(data)) return res.status(400).json({ success: false, message: "Homepage sections must be a list" });
    data = data.slice(0, 30).map((section, index) => ({
      id: text(section?.id, 100) || `section-${index + 1}`,
      type: text(section?.type, 50),
      title: text(section?.title, 150),
      enabled: section?.enabled !== false,
      limit: Math.min(12, Math.max(1, integer(section?.limit, 3))),
      viewAllHref: text(section?.viewAllHref, 500),
      placement: section?.placement === "after_hero" ? "after_hero" : "main_content",
      sectionKey: text(section?.sectionKey, 100),
    }));
    if (data.some((section) => !allowedTypes.has(section.type) || !section.title)) {
      return res.status(400).json({ success: false, message: "Every homepage section needs a valid type and title" });
    }
    if (data.some((section) => section.type === "builtin" && !allowedBuiltinSections.has(section.sectionKey))) {
      return res.status(400).json({ success: false, message: "Homepage layout contains an unknown existing section" });
    }
    if (data.some((section) => section.viewAllHref && !section.viewAllHref.startsWith("/") && !/^https?:\/\//i.test(section.viewAllHref))) {
      return res.status(400).json({ success: false, message: "Section links must begin with / or http" });
    }
  }
  await HomeWidget.upsert(widgetKey, data, siteId);
  if (widgetKey === "homepage_labels") {
    await Promise.all(Object.entries(data).filter(([key, value]) => value.title !== widgets.homepage_labels?.[key]?.title).map(([key, value]) => UiSection.setLabel(key, value.title, siteId)));
  }
  return res.json({ success: true, message: "Home widget updated", key: widgetKey, data });
}

async function getSiteManagement(req, res) {
  const siteId = req.user.role === "ADMIN" ? Number(req.query.siteId || req.get("x-management-site-id") || req.user.siteId) : req.user.siteId;
  const [widgets, sections] = await Promise.all([HomeWidget.getAll(siteId), UiSection.findAll(siteId)]);
  return res.json({ success: true, widgets, sections });
}

async function updateSiteHeader(req, res) {
  const input = req.body?.header;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return res.status(400).json({ success: false, message: "Header settings are required" });
  }
  const targetAt = text(input.countdown?.targetAt, 100) || "";
  if (input.countdown?.enabled && (!targetAt || Number.isNaN(new Date(targetAt).getTime()))) {
    return res.status(400).json({ success: false, message: "Choose a valid countdown date and time" });
  }
  const validHref = (href) => href && (href.startsWith("/") || /^https?:\/\//i.test(href));
  const menuItems = Array.isArray(input.menuItems) ? input.menuItems.slice(0, 50).map((item) => {
    const children = Array.isArray(item?.children) ? item.children.slice(0, 20).map((child) => ({
      label: text(child?.label, 80),
      href: text(child?.href, 500),
      enabled: child?.enabled !== false,
    })) : [];
    return {
      label: text(item?.label, 80),
      href: text(item?.href, 500),
      enabled: item?.enabled !== false,
      ...(text(item?.feature, 100) ? { feature: text(item.feature, 100) } : {}),
      ...(item?.requiresServices ? { requiresServices: true } : {}),
      ...(children.length ? { children } : {}),
    };
  }) : [];
  if (menuItems.some((item) => !item.label || !validHref(item.href))) {
    return res.status(400).json({ success: false, message: "Every menu item needs a label and a destination beginning with / or http." });
  }
  if (menuItems.some((item) => (item.children || []).some((child) => !child.label || !validHref(child.href)))) {
    return res.status(400).json({ success: false, message: "Every dropdown item needs a label and a destination beginning with / or http." });
  }
  if (new Set(menuItems.map((item) => item.href)).size !== menuItems.length) {
    return res.status(400).json({ success: false, message: "Header menu destinations must be unique." });
  }
  // Items beside the logo: each appears once, on the left or the right.
  const LOGO_ITEMS = ["rallies", "weather", "elections", "events"];
  const seenLogoItems = new Set();
  const logoSide = (side) => (Array.isArray(input.logoLayout?.[side]) ? input.logoLayout[side] : [])
    .filter((key) => LOGO_ITEMS.includes(key) && !seenLogoItems.has(key) && seenLogoItems.add(key));
  const logoLayout = { left: logoSide("left"), right: logoSide("right") };
  for (const key of LOGO_ITEMS) if (!seenLogoItems.has(key)) logoLayout[["rallies", "weather"].includes(key) ? "left" : "right"].push(key);
  const mobileDefaults = { rallies: true, weather: false, elections: false, events: false };
  const showOnMobile = Object.fromEntries(LOGO_ITEMS.map((key) => [key, typeof input.showOnMobile?.[key] === "boolean" ? input.showOnMobile[key] : mobileDefaults[key]]));
  const header = {
    // show* flags control desktop and tablet; showOnMobile controls phones.
    showUpcomingRallies: input.showUpcomingRallies !== false,
    showWeather: input.showWeather !== false,
    showUpcomingEvents: input.showUpcomingEvents !== false,
    showUpcomingElections: input.showUpcomingElections !== false,
    logoLayout,
    showOnMobile,
    menuItems,
    countdown: {
      enabled: Boolean(input.countdown?.enabled),
      title: text(input.countdown?.title, 150) || "Election Results",
      targetAt,
      link: text(input.countdown?.link, 500) || "/elections",
      buttonLabel: text(input.countdown?.buttonLabel, 100) || "View results",
    },
  };
  const siteId = req.user.role === "ADMIN" ? Number(req.body.siteId || req.get("x-management-site-id") || req.user.siteId) : req.user.siteId;
  await HomeWidget.upsert("site_header", header, siteId);
  return res.json({ success: true, message: "Header settings updated", header });
}

async function updatePageProfiles(req, res) {
  const profiles = req.body.profiles;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) {
    return res.status(400).json({ success: false, message: "Page profile details are required" });
  }
  const allowed = ["speeches", "rallies", "elections"];
  const normalized = {};
  for (const key of allowed) {
    const profile = profiles[key] || {};
    normalized[key] = {
      description: text(profile.description, 3000),
      currentLabel: text(profile.currentLabel, 150),
      oppositionLabel: text(profile.oppositionLabel, 150),
      current: {
        name: text(profile.current?.name, 200),
        role: text(profile.current?.role, 500),
        photo: text(profile.current?.photo, 2000),
      },
      opposition: {
        name: text(profile.opposition?.name, 200),
        role: text(profile.opposition?.role, 500),
        photo: text(profile.opposition?.photo, 2000),
      },
      bio: array(profile.bio).slice(0, 10),
      facts: array(profile.facts).slice(0, 12).map((fact) => typeof fact === "string" ? fact : text(fact?.label, 500)).filter(Boolean),
    };
    if (!normalized[key].description) return res.status(400).json({ success: false, message: `${key} description is required` });
  }
  await HomeWidget.upsert("page_profiles", normalized, managedSiteId(req));
  return res.json({ success: true, message: "Page information updated", profiles: normalized });
}

async function getPageProfiles(req, res) {
  const widgets = await HomeWidget.getAll(managedSiteId(req));
  return res.json({ success: true, profiles: widgets.page_profiles || null });
}

async function votePoll(req, res) {
  try {
    const optionIndex = integer(req.body.optionIndex, -1);
    const poll = await HomeWidget.votePoll(optionIndex, req.site.id);
    return res.json({ success: true, message: "Vote recorded", poll });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function getParliament(req, res) {
  const widgets = await HomeWidget.getAll(req.site?.id || 1);
  return res.json({ success: true, parliament: widgets.parliament_data || null });
}

module.exports = { listReferenceData, politicianCrud, partyCrud, stateCrud, districtCrud, updateParliament, updateSchedule, updateVidhanSabhas, updateHomeWidget, getSiteManagement, updateSiteHeader, updatePageProfiles, votePoll, getParliament, getVidhanSabhas, getPageProfiles };
