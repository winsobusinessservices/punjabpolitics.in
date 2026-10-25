"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { referenceAdminApi } from "@/lib/api";
import { DEFAULT_PARLIAMENT } from "@/features/parliament/parliament.api";
import { DEFAULT_PAGE_PROFILES } from "@/features/events/pageProfiles";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import { useAdminSite } from "@/context/AdminSiteContext";
import RichTextEditor from "@/components/common/RichTextEditor";
import ImageUploadField from "@/components/common/ImageUploadField";

const HOME_WIDGET_PERMISSIONS = [
  PERMISSIONS.SITE_HOME_WIDGETS,
  PERMISSIONS.SITE_WIDGET_BREAKING_NEWS,
  PERMISSIONS.SITE_WIDGET_POLL,
  PERMISSIONS.SITE_WIDGET_ELECTION_RESULTS,
  PERMISSIONS.SITE_WIDGET_OTHER,
];

function canManageWidget(user, key) {
  if (hasPermission(user, PERMISSIONS.SITE_HOME_WIDGETS)) return true;
  const permission = {
    breaking_news: PERMISSIONS.SITE_WIDGET_BREAKING_NEWS,
    poll_of_the_day: PERMISSIONS.SITE_WIDGET_POLL,
    election_results: PERMISSIONS.SITE_WIDGET_ELECTION_RESULTS,
  }[key] || PERMISSIONS.SITE_WIDGET_OTHER;
  return hasPermission(user, permission);
}

const PAGE_SIZE = 7;
const TABS = [
  ["politicians", "Politicians", "fa-user-tie", PERMISSIONS.SITE_POLITICIANS],
  ["parties", "Parties", "fa-flag", PERMISSIONS.SITE_PARTIES],
  ["states", "States & Assemblies", "fa-landmark", PERMISSIONS.SITE_STATES],
  ["districts", "Districts", "fa-map-location-dot", PERMISSIONS.SITE_DISTRICTS],
  ["parliament", "Parliament", "fa-building-columns", PERMISSIONS.SITE_PARLIAMENT],
  ["vidhanSabhas", "Vidhan Sabha", "fa-gavel", PERMISSIONS.SITE_VIDHAN_SABHAS],
  ["events", "Upcoming Events", "fa-calendar-days", PERMISSIONS.SITE_SCHEDULES],
  ["rallies", "Upcoming Rallies", "fa-bullhorn", PERMISSIONS.SITE_SCHEDULES],
  ["upcomingElections", "Upcoming Elections", "fa-check-to-slot", PERMISSIONS.SITE_SCHEDULES],
  ["homeWidgets", "Home Page Widgets", "fa-table-cells-large", PERMISSIONS.SITE_HOME_WIDGETS],
  ["websitePages", "Website Pages", "fa-file-lines", PERMISSIONS.SITE_PAGE_PROFILES],
  ["pageContent", "Speeches, Rallies & Elections", "fa-newspaper", PERMISSIONS.SITE_PAGE_PROFILES],
].map(([key, label, icon, permission]) => ({ key, label, icon, permission }));

const EMPTY = {
  politicians: {
    name: "",
    category: "KEY_FIGURE",
    photo_url: "",
    born_year: "",
    died_year: "",
    birth_place: "",
    party: "",
    state: "",
    current_position: "",
    still_in_office: false,
    opposition_party: "",
    since_year: "",
    education: "",
    career_timeline: "",
    summary: "",
    bio: "",
    sort_order: 0,
  },
  parties: {
    name: "",
    abbreviation: "",
    photo_url: "",
    founded_year: "",
    founded_place: "",
    founders: "",
    ideology: "",
    history: "",
    achievements: "",
    current_status: "",
    years_in_power: "",
    sort_order: 0,
  },
  states: {
    name: "",
    capital: "",
    image_url: "",
    current_cm_name: "",
    cm_image_url: "",
    opposition_leader_name: "",
    opposition_party: "",
    opposition_leader_image_url: "",
    kind: "STATE",
    formed: "",
    history: "",
    achievements: "",
    sort_order: 0,
  },
  districts: {
    name: "",
    state: "Punjab",
    headquarters: "",
    division: "",
    image_url: "",
    established: "",
    area: "",
    population: "",
    lok_sabha_constituencies: "",
    vidhan_sabha_constituencies: "",
    description: "",
    content: "",
    sort_order: 0,
  },
  events: { date: "", title: "" },
  rallies: { date: "", title: "" },
  upcomingElections: { date: "", title: "" },
  vidhanSabhas: {
    state: "",
    name: "",
    totalSeats: "",
    chiefMinister: "",
    rulingParty: "",
    speaker: "",
    oppositionLeader: "",
    oppositionParty: "",
    currentTerm: "",
    nextElection: "",
    imageUrl: "",
    content: "",
  },
};

const FIELDS = {
  politicians: [
    ["name", "Name", "text", true],
    ["category", "Category", "politician-category", true],
    ["photo_url", "Photo", "image"],
    ["current_position", "Current position", "text"],
    ["party", "Party", "text"],
    ["state", "State", "text"],
    ["birth_place", "Birth place", "text"],
    ["born_year", "Born year", "number"],
    ["died_year", "Died year", "number"],
    ["since_year", "In office since", "number"],
    ["opposition_party", "Opposition party", "text"],
    ["still_in_office", "Still in office", "checkbox"],
    ["education", "Education (one entry per line)", "textarea"],
    ["career_timeline", "Career history (one per line: role | organization | from year | to year)", "textarea", false, "Chief Minister | Government of Punjab | 2022 | 2027\nMP | Lok Sabha | 2014 | 2022"],
    ["summary", "Short summary", "textarea"],
    ["bio", "Biography (one paragraph per line)", "textarea", false, "First paragraph about early life.\nSecond paragraph about political career."],
    ["sort_order", "Display order", "number"],
  ],
  parties: [
    ["name", "Party name", "text", true],
    ["abbreviation", "Abbreviation", "text", true],
    ["photo_url", "Logo", "image"],
    ["founded_year", "Founded year", "number"],
    ["founded_place", "Founded place", "text"],
    ["founders", "Founders (one per line)", "textarea"],
    ["ideology", "Ideology", "textarea"],
    ["history", "History", "textarea"],
    ["achievements", "Achievements", "textarea"],
    ["current_status", "Current status", "textarea"],
    ["years_in_power", "Years in power", "textarea"],
    ["sort_order", "Display order", "number"],
  ],
  states: [
    ["name", "State / UT name", "text", true],
    ["kind", "Type", "state-kind", true],
    ["capital", "Capital", "text"],
    ["image_url", "State image", "image"],
    ["current_cm_name", "Current Chief Minister name", "text"],
    ["cm_image_url", "Chief Minister photo", "image"],
    ["opposition_leader_name", "Opposition Leader name", "text"],
    ["opposition_party", "Principal opposition party", "text"],
    ["opposition_leader_image_url", "Opposition Leader photo", "image"],
    ["formed", "Formation", "text"],
    ["history", "Political and assembly history", "textarea"],
    ["achievements", "Achievements", "textarea"],
    ["sort_order", "Display order", "number"],
  ],
  districts: [
    ["name", "District name", "text", true],
    ["state", "State", "text", true],
    ["headquarters", "Headquarters", "text"],
    ["division", "Division", "text"],
    ["image_url", "District image", "image"],
    ["established", "Established", "text"],
    ["area", "Area", "text"],
    ["population", "Population", "text"],
    ["lok_sabha_constituencies", "Lok Sabha constituencies", "text"],
    ["vidhan_sabha_constituencies", "Vidhan Sabha constituencies", "textarea"],
    ["description", "Card summary", "textarea"],
    ["content", "Full district content", "textarea"],
    ["sort_order", "Display order", "number"],
  ],
  events: [
    ["date", "Date", "text", true],
    ["title", "Event title", "text", true],
  ],
  rallies: [
    ["date", "Date", "text", true],
    ["title", "Rally title", "text", true],
  ],
  upcomingElections: [
    ["date", "Date", "text", true],
    ["title", "Election", "text", true],
  ],
  vidhanSabhas: [
    ["state", "State", "text", true],
    ["name", "Assembly name", "text", true],
    ["totalSeats", "Total seats", "number", true],
    ["currentTerm", "Current term", "text"],
    ["chiefMinister", "Chief Minister", "text"],
    ["rulingParty", "Ruling party", "text"],
    ["speaker", "Speaker", "text"],
    ["oppositionLeader", "Leader of Opposition", "text"],
    ["oppositionParty", "Opposition party", "text"],
    ["nextElection", "Next election", "text"],
    ["imageUrl", "Vidhan Sabha image", "image"],
    ["content", "Full Vidhan Sabha content", "richtext"],
  ],
};

const HOUSE_FIELDS = [
  ["label", "House name", "text"],
  ["fullName", "Full name", "text"],
  ["totalSeats", "Total seats", "number"],
  ["formed", "Formation", "text"],
  ["currentTerm", "Current term", "text"],
  ["leaderOfHouse.name", "Leader of House", "text"],
  ["leaderOfHouse.role", "Leader role", "text"],
  ["leaderOfHouse.party", "Leader party", "text"],
  ["leaderOfHouse.photo", "Leader photo", "image"],
  ["leaderOfOpposition.name", "Opposition leader", "text"],
  ["leaderOfOpposition.role", "Opposition role", "text"],
  ["leaderOfOpposition.party", "Opposition party", "text"],
  ["leaderOfOpposition.photo", "Opposition photo", "image"],
  ["presidingOfficer.name", "Presiding officer", "text"],
  ["presidingOfficer.role", "Presiding officer role", "text"],
  ["deputyPresidingOfficer.name", "Deputy presiding officer", "text"],
  ["deputyPresidingOfficer.role", "Deputy role", "text"],
  [
    "compositionText",
    "Party seats (one per line: party | seats)",
    "textarea",
  ],
  ["history", "History", "textarea"],
  ["achievements", "Achievements", "textarea"],
];

const inputClass =
  "w-full rounded-md border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary";
const lines = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const careerEntries = (value) =>
  lines(value).map((line) => {
    const [role = "", organization = "", fromYear = "", toYear = ""] = line
      .split("|")
      .map((item) => item.trim());
    return { role, organization, fromYear, toYear };
  });
const careerText = (value) =>
  (value || [])
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : [
            entry.role || entry.title,
            entry.organization,
            entry.fromYear || entry.from || entry.startYear,
            entry.toYear || entry.to || entry.endYear,
          ]
            .filter(Boolean)
            .join(" | "),
    )
    .join("\n");

function toForm(type, item) {
  const form = { ...EMPTY[type], ...item };
  if (type === "politicians")
    Object.assign(form, {
      education: (item.education || []).join("\n"),
      bio: (item.bio || []).join("\n"),
      career_timeline: careerText(item.career_timeline),
      still_in_office: Boolean(item.still_in_office),
    });
  if (type === "parties") form.founders = (item.founders || []).join("\n");
  return form;
}

function payloadOf(type, form) {
  const payload = { ...form };
  if (type === "politicians")
    Object.assign(payload, {
      education: lines(form.education),
      bio: lines(form.bio),
      career_timeline: careerEntries(form.career_timeline),
    });
  if (type === "parties") payload.founders = lines(form.founders);
  return payload;
}

// Format hints (shown in brackets after the field title) and example placeholders for the
// Site Data forms, keyed by field name. A label that already contains "(" keeps its own hint.
const FIELD_HINTS = {
  born_year: { hint: "year, 4 digits", placeholder: "1951" },
  died_year: { hint: "year, leave empty if living", placeholder: "2020" },
  since_year: { hint: "year, 4 digits", placeholder: "2005" },
  founded_year: { hint: "year, 4 digits", placeholder: "1997" },
  sort_order: { hint: "number, 1 shows first", placeholder: "1" },
  totalSeats: { hint: "number", placeholder: "117" },
  current_position: { placeholder: "Chief Minister of Punjab" },
  party: { placeholder: "AAP" },
  state: { placeholder: "Punjab" },
  birth_place: { hint: "town, district", placeholder: "Satoj, Sangrur" },
  opposition_party: { placeholder: "INC" },
  abbreviation: { hint: "short form", placeholder: "AAP" },
  founded_place: { hint: "city, state", placeholder: "New Delhi, Delhi" },
  ideology: { placeholder: "Social justice, secularism" },
  current_cm_name: { placeholder: "Bhagwant Mann" },
  opposition_leader_name: { placeholder: "Partap Singh Bajwa" },
  capital: { placeholder: "Chandigarh" },
  formed: { hint: "date or year", placeholder: "1 November 1966" },
  headquarters: { placeholder: "Ludhiana" },
  division: { placeholder: "Patiala Division" },
  established: { hint: "date or year", placeholder: "1972" },
  area: { hint: "number and unit", placeholder: "3,767 sq km" },
  population: { hint: "number, census year", placeholder: "3,498,739 (2011)" },
  lok_sabha_constituencies: { hint: "names separated by commas", placeholder: "Amritsar, Ludhiana" },
  vidhan_sabha_constituencies: { hint: "one per line", placeholder: "Amritsar North\nAmritsar West\nAmritsar Central" },
  date: { hint: "day month year", placeholder: "15 Oct 2026" },
  currentTerm: { hint: "years", placeholder: "2022 – 2027" },
  nextElection: { hint: "year or month year", placeholder: "2027" },
  chiefMinister: { placeholder: "Bhagwant Mann" },
  rulingParty: { placeholder: "AAP" },
  speaker: { placeholder: "Kultar Singh Sandhwan" },
  oppositionLeader: { placeholder: "Partap Singh Bajwa" },
  oppositionParty: { placeholder: "INC" },
  founders: { placeholder: "Arvind Kejriwal" },
  education: { placeholder: "B.A., Punjabi University\nLL.B, Panjab University" },
  summary: { placeholder: "Two or three lines about this person." },
  years_in_power: { hint: "years or ranges", placeholder: "2022 – present" },
  "leaderOfHouse.name": { placeholder: "Narendra Modi" },
  "leaderOfHouse.role": { placeholder: "Prime Minister" },
  "leaderOfHouse.party": { placeholder: "BJP" },
  "leaderOfOpposition.name": { placeholder: "Rahul Gandhi" },
  "leaderOfOpposition.role": { placeholder: "Leader of Opposition" },
  "leaderOfOpposition.party": { placeholder: "INC" },
  "presidingOfficer.name": { placeholder: "Om Birla" },
  "presidingOfficer.role": { placeholder: "Speaker" },
  compositionText: { placeholder: "BJP | 240\nINC | 99" },
};

function Field({ definition, value, onChange }) {
  const [name, rawLabel, type, required, ownPlaceholder] = definition;
  const fieldHint = FIELD_HINTS[name];
  const label = fieldHint?.hint && !rawLabel.includes("(") ? `${rawLabel} (${fieldHint.hint})` : rawLabel;
  const placeholder = ownPlaceholder ?? fieldHint?.placeholder;
  if (type === "image")
    return <ImageUploadField label={label} value={value ?? ""} onChange={(url) => onChange(name, url)} required={required} />;
  if (type === "richtext")
    return (
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-xs font-label-md text-on-surface-variant">{label}</p>
        <RichTextEditor value={value ?? ""} onChange={(html) => onChange(name, html)} placeholder="Write the full details: history, composition, key sessions…" minHeight="12rem" maxHeight="32rem" />
      </div>
    );
  if (type === "checkbox")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(name, event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {label}
      </label>
    );
  if (type === "politician-category" || type === "state-kind") {
    const options =
      type === "politician-category"
        ? [
            ["KEY_FIGURE", "Key figure"],
            ["FORMER_PM", "Former Prime Minister"],
            ["CHIEF_MINISTER", "Chief Minister"],
            ["PARTY_LEADER", "Party leader"],
          ]
        : [
            ["STATE", "State"],
            ["UNION_TERRITORY", "Union Territory"],
          ];
    return (
      <label className="text-xs font-label-md text-on-surface-variant">
        {label}
        <select
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          className={`${inputClass} mt-1.5`}
        >
          {options.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const textarea = type === "textarea";
  return (
    <label
      className={`text-xs font-label-md text-on-surface-variant ${textarea ? "sm:col-span-2" : ""}`}
    >
      {label}
      {required && <span className="text-error"> *</span>}
      {textarea ? (
        <textarea
          rows={4}
          required={required}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(event) => onChange(name, event.target.value)}
          className={`${inputClass} mt-1.5`}
        />
      ) : (
        <input
          type={type}
          required={required}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(event) => onChange(name, event.target.value)}
          className={`${inputClass} mt-1.5`}
        />
      )}
    </label>
  );
}

function DataTable({ rows, columns, onEdit, onDelete, page, setPage }) {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visible = rows.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );
  return (
    <>
      <div className="overflow-x-auto rounded-md border border-outline-variant/30">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id || row.key}
                className="border-t border-outline-variant/25"
              >
                {columns.map((column) => (
                  <td key={column.key} className="max-w-64 truncate px-4 py-3">
                    {row[column.key] || "—"}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded border border-primary/40 px-2.5 py-1 text-xs text-primary"
                    >
                      Edit
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="rounded border border-error/40 px-2.5 py-1 text-xs text-error"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="p-6 text-center text-sm text-on-surface-variant">
            No matching records found.
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
        <span>
          Showing {visible.length} of {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
            className="rounded border px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {activePage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={activePage === pageCount}
            onClick={() => setPage(activePage + 1)}
            className="rounded border px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}

function houseToForm(house) {
  return {
    ...structuredClone(house),
    compositionText: (house.composition || [])
      .map((item) => `${item.party} | ${item.seats}`)
      .join("\n"),
  };
}
function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}
function setPath(object, path, value) {
  const keys = path.split(".");
  const copy = structuredClone(object);
  let cursor = copy;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] ||= {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return copy;
}

function friendlyLabel(value) {
  if (["url", "postUrl", "post_url", "link"].includes(String(value)))
    return "Post URL / Link";
  const labels = {
    hasImage: "Show image",
    verified: "Show verified badge",
    excerpt: "Description",
    image: "Image",
    change: "Seat change",
    stats: "Post statistics",
    tag: "Badge label",
  };
  if (labels[value]) return labels[value];
  return String(value)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const TECHNICAL_WIDGET_FIELDS = new Set([
  "id",
  "icon",
  "tagClass",
  "statusClass",
  "verdictClass",
  "colorClass",
]);
const STRUCTURED_WIDGET_TEMPLATES = {
  digital_pulse: { id: "", tag: "", text: "", tagClass: "" },
  election_results: { id: "", state: "", party: "", seats: 0, change: "" },
  political_calendar: { id: "", date: "", title: "" },
  political_rallys: { id: "", date: "", title: "" },
  rti_corner: { id: "", title: "", date: "" },
  voices_of_nation: { id: "", quote: "", attribution: "" },
  opinion_leaders: { id: "", quote: "" },
  legislative_tracker: { id: "", title: "", status: "", stage: "", statusClass: "" },
};
const STRUCTURED_WIDGET_REQUIRED_FIELDS = {
  digital_pulse: ["tag", "text"],
  election_results: ["state", "party", "seats", "change"],
  political_calendar: ["date", "title"],
  political_rallys: ["date", "title"],
  rti_corner: ["title", "date"],
  voices_of_nation: ["quote", "attribution"],
  opinion_leaders: ["quote"],
  legislative_tracker: ["title", "status", "stage"],
};

function legacyStructuredWidgetItem(key, item) {
  const template = STRUCTURED_WIDGET_TEMPLATES[key];
  if (item && typeof item === "object" && !Array.isArray(item)) return { ...template, ...item };
  const raw = String(item || "").trim();
  const parts = raw.split("|").map((part) => part.trim());
  if (key === "rti_corner") {
    return { ...template, title: parts[0] || "", date: parts[1] || "" };
  }
  if (["political_calendar", "political_rallys"].includes(key)) {
    return { ...template, date: parts[0] || "", title: parts[1] || "" };
  }
  if (key === "digital_pulse") return { ...template, tag: parts[0] || "Update", text: parts.slice(1).join(" | ") || raw };
  if (key === "election_results") return { ...template, state: parts[0] || "", party: parts[1] || "", seats: Number(parts[2]) || 0, change: parts[3] || "" };
  if (key === "voices_of_nation") return { ...template, quote: parts[0] || "", attribution: parts[1] || "" };
  if (key === "legislative_tracker") return { ...template, title: parts[0] || "", status: parts[1] || "", stage: parts[2] || "" };
  return { ...template, quote: raw };
}
const SOCIAL_PLATFORMS = {
  x: { label: "X (Twitter)", icon: "fa-brands fa-x-twitter" },
  facebook: { label: "Facebook", icon: "fa-brands fa-facebook" },
  instagram: { label: "Instagram", icon: "fa-brands fa-instagram" },
  youtube: { label: "YouTube", icon: "fa-brands fa-youtube" },
  linkedin: { label: "LinkedIn", icon: "fa-brands fa-linkedin" },
  website: { label: "Website", icon: "fa-solid fa-globe" },
};

function socialPlatform(item) {
  const source = `${item.label || ""} ${item.icon || ""}`.toLowerCase();
  const platform = Object.keys(SOCIAL_PLATFORMS).find((key) =>
    source.includes(key === "x" ? "twitter" : key),
  );
  if (platform) return platform;
  if (source.includes("globe") || source.includes("external-link")) return "website";
  return "facebook";
}

function prepareWidget(key, data) {
  const copy = structuredClone(data);
  if (STRUCTURED_WIDGET_TEMPLATES[key]) {
    const items = (Array.isArray(copy) ? copy : []).map((item) => legacyStructuredWidgetItem(key, item));
    return items.length ? items : [structuredClone(STRUCTURED_WIDGET_TEMPLATES[key])];
  }
  if (["x_feed", "facebook_updates"].includes(key) && Array.isArray(copy)) {
    return copy.map((item) => {
      const rawUrl = String(item.url || item.link || "");
      const postUrl = rawUrl.match(
        /https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s"'<>]+\/status\/\d+[^\s"'<>]*/i,
      )?.[0];
      return { id: item.id, url: (postUrl || rawUrl).replace(/&amp;/g, "&") };
    });
  }
  if (key === "follow_us" && Array.isArray(copy))
    return copy.map((item) => {
      const platform = socialPlatform(item);
      return {
        id: item.id,
        platform,
        name: platform === "website" && item.label !== "Website" ? item.label || "" : "",
        url: item.url || item.link || "",
      };
    });
  return copy;
}

function SocialPostLinksEditor({ platform, value, onChange }) {
  const confirmDelete = useConfirmDialog();
  const label = platform === "x_feed" ? "X post" : "Facebook post";
  return (
    <fieldset className="space-y-3 rounded-md border border-outline-variant/30 p-4">
      <legend className="px-1 text-sm font-label-md text-primary">
        {friendlyLabel(platform)}
      </legend>
      <p className="text-sm text-on-surface-variant">
        Paste the public URL of each {label}. The original post will be embedded
        automatically.
      </p>
      {value.map((item, index) => (
        <div
          key={item.id || index}
          className="flex flex-col gap-2 rounded-md bg-surface-container-low p-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-xs font-label-md text-on-surface-variant">
            {label} URL
            <input
              type="url"
              required
              placeholder={
                platform === "x_feed"
                  ? "https://x.com/account/status/..."
                  : "https://www.facebook.com/.../posts/..."
              }
              value={item.url || ""}
              onChange={(event) =>
                onChange(
                  value.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, url: event.target.value }
                      : entry,
                  ),
                )
              }
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <button
            type="button"
            onClick={async () => {
              const confirmed = await confirmDelete({ title: `Delete ${label}?`, description: `This ${label.toLowerCase()} URL will be removed from the list.` });
              if (confirmed) onChange(value.filter((_, itemIndex) => itemIndex !== index));
            }}
            className="rounded-md border border-error/40 px-3 py-2.5 text-xs text-error"
          >
            Delete
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { id: `${Date.now()}`, url: "" }])}
        className="rounded-md border border-primary/40 px-3 py-2 text-xs text-primary"
      >
        Add {label} URL
      </button>
    </fieldset>
  );
}

function FollowUsEditor({ value, onChange }) {
  const confirmDelete = useConfirmDialog();
  return (
    <fieldset className="space-y-3 rounded-md border border-outline-variant/30 p-4">
      <legend className="px-1 text-sm font-label-md text-primary">
        Follow Us Links
      </legend>
      <p className="text-sm text-on-surface-variant">
        Choose a social platform and paste your website profile or channel URL.
        The correct icon is selected automatically.
      </p>
      {value.map((item, index) => (
        <div
          key={item.id || index}
          className={`grid gap-3 rounded-md bg-surface-container-low p-3 sm:items-end ${item.platform === "website" ? "sm:grid-cols-[160px_180px_1fr_auto]" : "sm:grid-cols-[180px_1fr_auto]"}`}
        >
          <label className="text-xs font-label-md text-on-surface-variant">
            Platform
            <select
              value={item.platform}
              onChange={(event) =>
                onChange(
                  value.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, platform: event.target.value }
                      : entry,
                  ),
                )
              }
              className={`${inputClass} mt-1.5`}
            >
              {Object.entries(SOCIAL_PLATFORMS).map(([key, platform]) => (
                <option key={key} value={key}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
          {item.platform === "website" && (
            <label className="text-xs font-label-md text-on-surface-variant">
              Website name
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Example News"
                value={item.name || ""}
                onChange={(event) =>
                  onChange(
                    value.map((entry, itemIndex) =>
                      itemIndex === index
                        ? { ...entry, name: event.target.value }
                        : entry,
                    ),
                  )
                }
                className={`${inputClass} mt-1.5`}
              />
            </label>
          )}
          <label className="text-xs font-label-md text-on-surface-variant">
            {item.platform === "website" ? "Website URL" : "Profile or channel URL"}
            <input
              type="url"
              required
              placeholder="https://..."
              value={item.url || ""}
              onChange={(event) =>
                onChange(
                  value.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, url: event.target.value }
                      : entry,
                  ),
                )
              }
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <button
            type="button"
            onClick={async () => {
              const confirmed = await confirmDelete({ title: "Delete social link?", description: "This social profile or channel link will be removed from the list." });
              if (confirmed) onChange(value.filter((_, itemIndex) => itemIndex !== index));
            }}
            className="rounded-md border border-error/40 px-3 py-2.5 text-xs text-error"
          >
            Delete
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { id: `${Date.now()}`, platform: "facebook", url: "" },
          ])
        }
        className="rounded-md border border-primary/40 px-3 py-2 text-xs text-primary"
      >
        Add social link
      </button>
    </fieldset>
  );
}

function PollEditor({ value, onChange }) {
  const options = [
    value.options?.[0] || { label: "" },
    value.options?.[1] || { label: "" },
  ];
  return (
    <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-outline-variant/30 p-4">
      <legend className="px-1 text-sm font-label-md text-primary">
        Poll of the Day
      </legend>
      <p className="text-sm text-on-surface-variant">
        Enter one question and two choices. Votes and percentages are calculated
        automatically from user selections.
      </p>
      <label className="text-xs font-label-md text-on-surface-variant">
        Question
        <textarea
          rows={3}
          value={value.question || ""}
          onChange={(event) =>
            onChange({ ...value, question: event.target.value })
          }
          className={`${inputClass} mt-1.5`}
        />
      </label>
      {options.map((option, index) => (
        <label
          key={index}
          className="text-xs font-label-md text-on-surface-variant"
        >
          Option {index + 1}
          <input
            type="text"
            value={option.label || ""}
            onChange={(event) =>
              onChange({
                ...value,
                options: options.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, label: event.target.value }
                    : item,
                ),
              })
            }
            className={`${inputClass} mt-1.5`}
          />
        </label>
      ))}
      <p className="text-xs text-on-surface-variant">
        Saving creates a fresh poll and resets its generated vote count to zero.
      </p>
    </fieldset>
  );
}

function FooterLinksEditor({ value, onChange }) {
  const footer = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sections = Array.isArray(footer.sections) ? footer.sections : [];
  const coverageLinks = Array.isArray(footer.coverageLinks) ? footer.coverageLinks : [];
  const changeFooter = (changes) => onChange({ ...footer, ...changes });
  const changeSection = (sectionIndex, changes) => changeFooter({
    sections: sections.map((section, index) => index === sectionIndex ? { ...section, ...changes } : section),
  });
  const changeLink = (sectionIndex, linkIndex, changes) => {
    const links = Array.isArray(sections[sectionIndex]?.links) ? sections[sectionIndex].links : [];
    changeSection(sectionIndex, { links: links.map((link, index) => index === linkIndex ? { ...link, ...changes } : link) });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-outline-variant/30 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h4 className="font-headline-md text-base text-primary">Footer sections</h4><p className="mt-1 text-xs text-on-surface-variant">Add at least four sections if needed. Each section becomes one footer column.</p></div>
          <button type="button" onClick={() => changeFooter({ sections: [...sections, { title: "", links: [] }] })} className="rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"><i className="fa-solid fa-plus mr-1.5" />Add section</button>
        </div>
        <div className="mt-4 space-y-4">
          {sections.map((section, sectionIndex) => {
            const links = Array.isArray(section.links) ? section.links : [];
            return <fieldset key={sectionIndex} className="rounded-lg border border-outline-variant/30 bg-surface-container-low/40 p-4">
              <legend className="px-1 text-xs font-semibold text-primary">Section {sectionIndex + 1}</legend>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs font-semibold text-on-surface-variant">Section heading<input value={section.title || ""} onChange={(event) => changeSection(sectionIndex, { title: event.target.value })} placeholder="For example: About" className={inputClass} /></label>
                <button type="button" onClick={() => changeFooter({ sections: sections.filter((_, index) => index !== sectionIndex) })} className="min-h-10 rounded-md border border-error/40 px-3 py-2 text-xs font-semibold text-error"><i className="fa-solid fa-trash-can mr-1.5" />Remove</button>
              </div>
              <div className="mt-4 space-y-3">
                {links.map((link, linkIndex) => <div key={linkIndex} className="grid gap-2 rounded-md border border-outline-variant/20 bg-surface p-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                  <label className="text-xs text-on-surface-variant">Link label<input value={link.label || ""} onChange={(event) => changeLink(sectionIndex, linkIndex, { label: event.target.value })} placeholder="Careers" className={inputClass} /></label>
                  <label className="text-xs text-on-surface-variant">Destination<input value={link.href || ""} onChange={(event) => changeLink(sectionIndex, linkIndex, { href: event.target.value })} placeholder="/careers" className={inputClass} /></label>
                  <button type="button" onClick={() => changeSection(sectionIndex, { links: links.filter((_, index) => index !== linkIndex) })} aria-label={`Remove ${link.label || "link"}`} className="min-h-10 rounded-md border border-error/30 px-3 text-error"><i className="fa-solid fa-xmark" /></button>
                </div>)}
                {!links.length && <p className="rounded-md border border-dashed border-outline-variant/30 p-3 text-center text-xs text-on-surface-variant">No links yet.</p>}
              </div>
              <button type="button" onClick={() => changeSection(sectionIndex, { links: [...links, { label: "", href: "" }] })} className="mt-3 rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"><i className="fa-solid fa-plus mr-1.5" />Add link</button>
            </fieldset>;
          })}
          {!sections.length && <p className="rounded-md border border-dashed border-outline-variant/30 p-5 text-center text-sm text-on-surface-variant">No footer sections yet. Select Add section to create one.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant/30 bg-surface p-4">
        <h4 className="font-headline-md text-base text-primary">Keyword directory</h4>
        <p className="mt-1 text-xs text-on-surface-variant">Manage the first link column under Explore by Keyword.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-on-surface-variant">Directory heading<input value={footer.directoryTitle || ""} onChange={(event) => changeFooter({ directoryTitle: event.target.value })} placeholder="Explore by Keyword" className={inputClass} /></label>
          <label className="text-xs font-semibold text-on-surface-variant">Column heading<input value={footer.coverageTitle || ""} onChange={(event) => changeFooter({ coverageTitle: event.target.value })} placeholder="Coverage" className={inputClass} /></label>
        </div>
        <div className="mt-4 space-y-3">
          {coverageLinks.map((link, linkIndex) => <div key={linkIndex} className="grid gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low/40 p-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
            <label className="text-xs text-on-surface-variant">Link label<input value={link.label || ""} onChange={(event) => changeFooter({ coverageLinks: coverageLinks.map((item, index) => index === linkIndex ? { ...item, label: event.target.value } : item) })} placeholder="Elections" className={inputClass} /></label>
            <label className="text-xs text-on-surface-variant">Destination<input value={link.href || ""} onChange={(event) => changeFooter({ coverageLinks: coverageLinks.map((item, index) => index === linkIndex ? { ...item, href: event.target.value } : item) })} placeholder="/elections" className={inputClass} /></label>
            <button type="button" onClick={() => changeFooter({ coverageLinks: coverageLinks.filter((_, index) => index !== linkIndex) })} aria-label={`Remove ${link.label || "directory link"}`} className="min-h-10 rounded-md border border-error/30 px-3 text-error"><i className="fa-solid fa-xmark" /></button>
          </div>)}
        </div>
        <button type="button" onClick={() => changeFooter({ coverageLinks: [...coverageLinks, { label: "", href: "" }] })} className="mt-3 rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"><i className="fa-solid fa-plus mr-1.5" />Add directory link</button>
      </section>
    </div>
  );
}

function emptyLike(value) {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, emptyLike(child)]),
    );
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return "";
}

// Example text for common widget fields (shown greyed out until you type).
const WIDGET_PLACEHOLDERS = { date: "15 Oct 2026", time: "10:30 AM", location: "Ranjit Avenue, Amritsar", venue: "Ranjit Avenue, Amritsar", handle: "@punjabpolitics" };

const IMAGE_KEYS = new Set(["image", "imageUrl", "image_url", "photo", "photoUrl", "photo_url", "thumbnail", "logo", "logoUrl", "avatar"]);
// Image-like widget fields (cmImage, leader_photo, bannerImageUrl…) get an uploader, not a URL box.
const isImageField = (label) => IMAGE_KEYS.has(String(label)) || /(image|photo|thumbnail|logo|avatar)(_?url)?$/i.test(String(label));

function WidgetValueEditor({ label, value, onChange, depth = 0 }) {
  const confirmDelete = useConfirmDialog();
  if (Array.isArray(value)) {
    const objects =
      value.length > 0 &&
      value.every(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      );
    if (!objects)
      return (
        <label className="block text-xs font-label-md text-on-surface-variant">
          {friendlyLabel(label)}{" "}
          <span className="font-normal">(one item per line)</span>
          <textarea
            rows={Math.min(10, Math.max(4, value.length))}
            value={value.join("\n")}
            onChange={(event) => onChange(lines(event.target.value))}
            className={`${inputClass} mt-1.5`}
          />
        </label>
      );
    return (
      <fieldset className="space-y-3 rounded-md border border-outline-variant/30 p-3">
        <legend className="px-1 text-sm font-label-md text-primary">
          {friendlyLabel(label)}
        </legend>
        {value.map((item, index) => (
          <div
            key={`${label}-${index}`}
            className="rounded-md bg-surface-container-low p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-label-md text-on-surface-variant">
                Item {index + 1}
              </span>
              <button
                type="button"
                onClick={async () => {
                  const confirmed = await confirmDelete({ title: `Delete item ${index + 1}?`, description: "This widget item will be removed. This action cannot be undone after saving." });
                  if (confirmed) onChange(value.filter((_, itemIndex) => itemIndex !== index));
                }}
                className="text-xs text-error"
              >
                Delete item
              </button>
            </div>
            <WidgetValueEditor
              label="Details"
              value={item}
              depth={depth + 1}
              onChange={(next) =>
                onChange(
                  value.map((entry, itemIndex) =>
                    itemIndex === index ? next : entry,
                  ),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, emptyLike(value[0])])}
          className="rounded-md border border-primary/40 px-3 py-2 text-xs text-primary"
        >
          Add item
        </button>
      </fieldset>
    );
  }
  if (value && typeof value === "object")
    return (
      <fieldset
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${depth ? "" : "rounded-md border border-outline-variant/30 p-4"}`}
      >
        <legend className="px-1 text-sm font-label-md text-primary">
          {friendlyLabel(label)}
        </legend>
        {Object.entries(value)
          .filter(([key]) => !TECHNICAL_WIDGET_FIELDS.has(key))
          .map(([key, child]) => (
            <div
              key={key}
              className={
                child && typeof child === "object" ? "sm:col-span-2" : ""
              }
            >
              <WidgetValueEditor
                label={key}
                value={child}
                depth={depth + 1}
                onChange={(next) => onChange({ ...value, [key]: next })}
              />
            </div>
          ))}
      </fieldset>
    );
  if (typeof value === "boolean")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {friendlyLabel(label)}
      </label>
    );
  if (typeof value === "number")
    return (
      <label className="text-xs font-label-md text-on-surface-variant">
        {friendlyLabel(label)}
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${inputClass} mt-1.5`}
        />
      </label>
    );
  if (isImageField(label))
    return <ImageUploadField label={friendlyLabel(label)} value={value ?? ""} onChange={onChange} />;
  if (["url", "postUrl", "post_url", "link"].includes(String(label)))
    return (
      <label className="text-xs font-label-md text-on-surface-variant">
        {friendlyLabel(label)}
        <input
          type="url"
          placeholder="https://..."
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} mt-1.5`}
        />
      </label>
    );
  return (
    <label className="text-xs font-label-md text-on-surface-variant">
      {friendlyLabel(label)}
      <textarea
        rows={String(value).length > 120 ? 4 : 2}
        placeholder={WIDGET_PLACEHOLDERS[label]}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-1.5`}
      />
    </label>
  );
}

export function HomeWidgetsAdmin({ widgets, onReload, user, siteId }) {
  const keys = Object.keys(widgets || {})
    .filter((key) => !["site_header", "managed_pages"].includes(key) && canManageWidget(user, key))
    .sort();
  const [selected, setSelected] = useState(keys[0] || "");
  const [value, setValue] = useState(() =>
    prepareWidget(keys[0], widgets?.[keys[0]] ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const widgetIcon = (key) => ({
    breaking_news: "fa-bolt",
    poll_of_the_day: "fa-square-poll-vertical",
    election_results: "fa-check-to-slot",
    political_calendar: "fa-calendar-days",
    political_rallys: "fa-bullhorn",
    x_feed: "fa-x-twitter",
    facebook_updates: "fa-facebook-f",
    follow_us: "fa-share-nodes",
    site_footer: "fa-link",
    cm_corner: "fa-user-tie",
    pm_corner: "fa-user-tie",
    parliament_data: "fa-landmark",
  }[key] || "fa-table-cells-large");
  const choose = (key) => {
    setSelected(key);
    setValue(prepareWidget(key, widgets[key]));
    setError("");
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const social = ["x_feed", "facebook_updates"].includes(selected);
      let payload = social
        ? value
            .filter((item) => item.url?.trim())
            .map((item) => ({
              id: item.id || `${Date.now()}`,
              url: item.url.trim(),
            }))
        : value;
      if (STRUCTURED_WIDGET_TEMPLATES[selected]) {
        const template = STRUCTURED_WIDGET_TEMPLATES[selected];
        const editableFields = Object.keys(template).filter((key) => !TECHNICAL_WIDGET_FIELDS.has(key));
        const entries = value.filter((item) => editableFields.some((key) => {
          const current = item[key];
          return typeof current === "number"
            ? current !== template[key]
            : String(current ?? "").trim() !== "";
        }));
        const requiredFields = STRUCTURED_WIDGET_REQUIRED_FIELDS[selected] || [];
        if (entries.some((item) => requiredFields.some((key) => String(item[key] ?? "").trim() === ""))) {
          throw new Error(`Every ${friendlyLabel(selected)} item needs ${requiredFields.map(friendlyLabel).join(", ")}.`);
        }
        payload = entries.map((item, index) => ({
          ...item,
          id: item.id || `${selected}-${Date.now()}-${index + 1}`,
          ...(selected === "digital_pulse" && !item.tagClass ? { tagClass: "bg-primary text-on-primary" } : {}),
          ...(selected === "legislative_tracker" && !item.statusClass ? { statusClass: "bg-secondary text-on-secondary" } : {}),
        }));
      }
      if (selected === "follow_us")
        payload = value
          .filter((item) => item.url?.trim())
          .map((item) => {
            const platform = SOCIAL_PLATFORMS[item.platform] || SOCIAL_PLATFORMS.website;
            return {
              id: item.id || `${Date.now()}`,
              label: item.platform === "website" ? item.name?.trim() || "Website" : platform.label,
              icon: platform.icon,
              url: item.url.trim(),
            };
          });
      if (selected === "poll_of_the_day")
        payload = {
          question: value.question?.trim(),
          options: (value.options || [])
            .slice(0, 2)
            .map((option) => ({
              label: option.label?.trim(),
              votes: 0,
              pct: 0,
            })),
          totalVotes: 0,
        };
      if (selected === "site_footer") {
        const validHref = (href) => String(href || "").startsWith("/") || /^https?:\/\//i.test(String(href || ""));
        const sections = (value.sections || []).filter((section) => section.title?.trim()).map((section) => ({
          ...section,
          title: section.title.trim(),
          links: (section.links || []).filter((link) => link.label?.trim() || link.href?.trim()).map((link) => ({ ...link, label: link.label?.trim(), href: link.href?.trim() })),
        }));
        const coverageLinks = (value.coverageLinks || []).filter((link) => link.label?.trim() || link.href?.trim()).map((link) => ({ ...link, label: link.label?.trim(), href: link.href?.trim() }));
        const allLinks = [...sections.flatMap((section) => section.links), ...coverageLinks];
        if (allLinks.some((link) => !link.label || !validHref(link.href))) throw new Error("Every footer link needs a label and a destination beginning with / or http.");
        payload = { ...value, directoryTitle: String(value.directoryTitle || "").trim(), coverageTitle: String(value.coverageTitle || "").trim(), sections, coverageLinks };
      }
      await referenceAdminApi.updateHomeWidget(selected, payload, siteId);
      setValue(prepareWidget(selected, payload));
      await onReload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  if (!keys.length)
    return (
      <p className="rounded-lg bg-surface p-6 text-sm text-on-surface-variant">
        No home widgets are available.
      </p>
    );
  return (
    <section
      inert={saving}
      aria-busy={saving}
      className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6"
    >
      <h2 className="font-headline-lg text-xl text-primary">
        Manage Site Content &amp; Home Page Widgets
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Choose a page or section and edit its normal fields. No JSON or coding is needed.
      </p>
      <p className="mt-2 text-xs text-on-surface-variant">
        To show or hide a complete homepage section, use <Link href="/author/site-management" className="font-semibold text-primary hover:underline">Site Management</Link>. Changes here edit the section content for the active website only.
      </p>
      {error && (
        <p className="mt-4 rounded-md bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-5 flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-outline-variant/25 bg-surface-container-low p-3" role="tablist" aria-label="Home widgets">
        {keys.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={selected === key} onClick={() => choose(key)} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-label-md transition-colors ${selected === key ? "border-primary bg-primary text-on-primary" : "border-outline-variant/30 bg-surface text-on-surface-variant hover:border-primary hover:text-primary"}`}>
            <i className={`fa-solid ${widgetIcon(key)}`} aria-hidden="true" />
            <span>{friendlyLabel(key)}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container-low/40 p-4 sm:p-5">
        <div className="mb-5 flex items-center gap-3 border-b border-outline-variant/20 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary"><i className={`fa-solid ${widgetIcon(selected)}`} aria-hidden="true" /></span>
          <div><h3 className="font-headline-md text-base text-primary">{friendlyLabel(selected)}</h3><p className="text-xs text-on-surface-variant">Edit the content displayed in this widget.</p></div>
        </div>
        {["x_feed", "facebook_updates"].includes(selected) ? (
          <SocialPostLinksEditor
            platform={selected}
            value={value}
            onChange={setValue}
          />
        ) : selected === "follow_us" ? (
          <FollowUsEditor value={value} onChange={setValue} />
        ) : selected === "poll_of_the_day" ? (
          <PollEditor value={value} onChange={setValue} />
        ) : selected === "site_footer" ? (
          <FooterLinksEditor value={value} onChange={setValue} />
        ) : (
          <WidgetValueEditor
            label={selected}
            value={value}
            onChange={setValue}
          />
        )}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-label-md text-on-primary disabled:opacity-60"
      >
        {saving
          ? "Saving…"
          : selected === "poll_of_the_day"
            ? "Save New Poll"
            : "Save Home Widget"}
      </button>
    </section>
  );
}

const MANAGED_PAGES = [
  ["about", "About Us"], ["contact", "Contact Us"], ["editorial-team", "Editorial Team"],
  ["advertise-with-us", "Advertise With Us"],
  ["connect-as-a-sponsor", "Connect as a Sponsor"], ["investors", "Investor Relations"], ["more", "More Page"],
];

const INVESTOR_FORM_DEFAULTS = {
  formEnabled: true,
  formEyebrow: "Investor application",
  formTitle: "Start an investment conversation",
  formDescription: "Share your profile and investment interest. Our administration team will review your application and contact you.",
  companyLabel: "Company or organisation",
  phoneLabel: "Phone number",
  investmentRangeLabel: "Investment interest",
  documentLabel: "Investor profile or pitch document",
  messageLabel: "Tell us about your interest",
  submitLabel: "Submit investor application",
  successMessage: "Your investor application has been submitted for admin review.",
};

function WebsitePagesAdmin({ pages = {}, onReload, siteId }) {
  const [slug, setSlug] = useState(MANAGED_PAGES[0][0]);
  const selectedLabel = MANAGED_PAGES.find(([key]) => key === slug)?.[1] || slug;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const page = pages?.[slug] || {};
    const cards = Array.isArray(page.cards) ? page.cards : [];
    const timer = window.setTimeout(() => setForm({
      ...(slug === "investors" ? INVESTOR_FORM_DEFAULTS : {}),
      enabled: page.enabled !== false,
      eyebrow: page.eyebrow || "",
      title: page.title || selectedLabel,
      description: page.description || "",
      cardsTitle: page.cardsTitle || "",
      email: page.email || "",
      phone: page.phone || "",
      location: page.location || "",
      detailsTitle: page.detailsTitle || "",
      detailsDescription: page.detailsDescription || "",
      formEyebrow: page.formEyebrow || "",
      formTitle: page.formTitle || "",
      formDescription: page.formDescription || "",
      formEnabled: page.formEnabled !== false,
      companyLabel: page.companyLabel || INVESTOR_FORM_DEFAULTS.companyLabel,
      phoneLabel: page.phoneLabel || INVESTOR_FORM_DEFAULTS.phoneLabel,
      investmentRangeLabel: page.investmentRangeLabel || INVESTOR_FORM_DEFAULTS.investmentRangeLabel,
      documentLabel: page.documentLabel || INVESTOR_FORM_DEFAULTS.documentLabel,
      messageLabel: page.messageLabel || INVESTOR_FORM_DEFAULTS.messageLabel,
      submitLabel: page.submitLabel || INVESTOR_FORM_DEFAULTS.submitLabel,
      successMessage: page.successMessage || INVESTOR_FORM_DEFAULTS.successMessage,
      cards: cards.length ? cards.map((card) => ({ title: card.title || "", text: card.text || "", href: card.href || "" })) : [{ title: "", text: "", href: "" }],
    }), 0);
    return () => window.clearTimeout(timer);
  }, [pages, selectedLabel, slug]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateCard = (index, key, value) => update("cards", (form.cards || []).map((card, cardIndex) => cardIndex === index ? { ...card, [key]: value } : card));
  const addCard = () => update("cards", [...(form.cards || []), { title: "", text: "", href: "" }]);
  const removeCard = (index) => update("cards", (form.cards || []).filter((_, cardIndex) => cardIndex !== index));
  const save = async () => {
    if (!form.title?.trim() || !form.description?.trim()) { setError("Page title and introduction are required."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await referenceAdminApi.updateHomeWidget("managed_pages", { ...pages, [slug]: { ...form, title: form.title.trim(), description: form.description.trim(), cards: form.cards.filter((card) => card.title || card.text) } }, siteId);
      await onReload(); setNotice(`${selectedLabel} was updated for this website.`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <section className="rounded-xl border border-outline-variant/30 bg-surface p-4 sm:p-6">
    <h2 className="font-headline-lg text-xl text-primary">Manage Website Pages</h2>
    <p className="mt-1 text-sm text-on-surface-variant">Choose a page and edit what visitors see on the active website. Other websites keep their own page content.</p>
    <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-2">{MANAGED_PAGES.map(([key, label]) => <button key={key} type="button" onClick={() => { setSlug(key); setNotice(""); setError(""); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${slug === key ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-primary/10"}`}>{label}</button>)}</div>
      <div className="space-y-4 rounded-xl border border-outline-variant/25 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.enabled ?? true} onChange={(event) => update("enabled", event.target.checked)} className="h-4 w-4 accent-primary" /> Show this page on the website</label>
        {["eyebrow", "title"].map((key) => <label key={key} className="block text-xs font-semibold text-on-surface-variant">{key === "eyebrow" ? "Small heading" : "Page title"}<input value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className={`${inputClass} mt-1.5`} /></label>)}
        <div><p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Introduction</p><RichTextEditor value={form.description || ""} onChange={(value) => update("description", value)} placeholder="Write the page introduction…" minHeight="10rem" maxHeight="24rem" disabled={saving} /></div>
        {slug === "contact" && <div className="space-y-3 rounded-lg border border-outline-variant/25 p-3">
          <div className="grid gap-3 sm:grid-cols-3">{["email", "phone", "location"].map((key) => <label key={key} className="text-xs font-semibold capitalize text-on-surface-variant">{key}<input value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className={`${inputClass} mt-1.5`} /></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-on-surface-variant">Contact details heading<input value={form.detailsTitle || ""} onChange={(event) => update("detailsTitle", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
            <label className="text-xs font-semibold text-on-surface-variant">Message form small heading<input value={form.formEyebrow || ""} onChange={(event) => update("formEyebrow", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
          </div>
          <div><p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Contact details description</p><RichTextEditor value={form.detailsDescription || ""} onChange={(value) => update("detailsDescription", value)} placeholder="Explain how visitors can contact the team…" minHeight="8rem" maxHeight="20rem" disabled={saving} /></div>
          <label className="block text-xs font-semibold text-on-surface-variant">Message form title<input value={form.formTitle || ""} onChange={(event) => update("formTitle", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
          <div><p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Message form description</p><RichTextEditor value={form.formDescription || ""} onChange={(value) => update("formDescription", value)} placeholder="Explain what visitors can send…" minHeight="8rem" maxHeight="20rem" disabled={saving} /></div>
        </div>}
        {slug === "investors" && <div className="space-y-4 rounded-lg border border-outline-variant/25 p-4">
          <div><h3 className="font-headline-md text-primary">Investor application form</h3><p className="mt-1 text-xs text-on-surface-variant">Control the form shown to prospective investors. Submitted applications appear in Investor Applications.</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.formEnabled ?? true} onChange={(event) => update("formEnabled", event.target.checked)} className="h-4 w-4 accent-primary" /> Accept investor applications</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-on-surface-variant">Form small heading<input value={form.formEyebrow || ""} onChange={(event) => update("formEyebrow", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
            <label className="text-xs font-semibold text-on-surface-variant">Form title<input value={form.formTitle || ""} onChange={(event) => update("formTitle", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
          </div>
          <div><p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Form introduction</p><RichTextEditor value={form.formDescription || ""} onChange={(value) => update("formDescription", value)} placeholder="Explain the investor application process…" minHeight="8rem" maxHeight="20rem" disabled={saving} /></div>
          <div className="grid gap-3 sm:grid-cols-2">{[
            ["companyLabel", "Company label"], ["phoneLabel", "Phone label"],
            ["investmentRangeLabel", "Investment range label"], ["documentLabel", "Document label"],
            ["messageLabel", "Message label"], ["submitLabel", "Submit button text"], ["successMessage", "Success message"],
          ].map(([key, label]) => <label key={key} className="text-xs font-semibold text-on-surface-variant">{label}<input value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className={`${inputClass} mt-1.5`} /></label>)}</div>
        </div>}
        <label className="block text-xs font-semibold text-on-surface-variant">Sections heading<input value={form.cardsTitle || ""} onChange={(event) => update("cardsTitle", event.target.value)} className={`${inputClass} mt-1.5`} /></label>
        <div><div className="flex items-center justify-between gap-3"><h3 className="font-headline-md text-primary">Page sections</h3><button type="button" onClick={addCard} className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"><i className="fa-solid fa-plus mr-1.5" />Add section</button></div><p className="mt-1 text-xs text-on-surface-variant">Use the editor toolbar to add headings, bold text, links, bullet lists, or numbered lists.</p></div>
        {(form.cards || []).map((card, index) => <fieldset key={index} className="rounded-lg border border-outline-variant/25 p-3"><legend className="px-1 text-xs font-semibold">Section {index + 1}</legend><div className="mb-3 flex justify-end"><button type="button" onClick={() => removeCard(index)} className="rounded border border-error/40 px-2.5 py-1 text-xs text-error"><i className="fa-solid fa-trash-can mr-1" />Remove</button></div><input placeholder="Section title" value={card.title} onChange={(event) => updateCard(index, "title", event.target.value)} className={inputClass} /><div className="mt-3"><p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Section content</p><RichTextEditor value={card.text} onChange={(value) => updateCard(index, "text", value)} placeholder="Write this section's content…" minHeight="10rem" maxHeight="24rem" disabled={saving} /></div><input placeholder="Optional link, for example /contact" value={card.href} onChange={(event) => updateCard(index, "href", event.target.value)} className={`${inputClass} mt-3`} /></fieldset>)}
        {error && <p className="text-sm text-error">{error}</p>}{notice && <p className="text-sm font-semibold text-green-700">{notice}</p>}
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? "Saving…" : `Save ${selectedLabel}`}</button>
      </div>
    </div>
  </section>;
}

function PageContentAdmin({ profiles, onReload }) {
  const merged = Object.fromEntries(
    Object.entries(DEFAULT_PAGE_PROFILES).map(([key, defaults]) => [
      key,
      {
        ...defaults,
        ...(profiles?.[key] || {}),
        current: { ...defaults.current, ...(profiles?.[key]?.current || {}) },
        opposition: {
          ...defaults.opposition,
          ...(profiles?.[key]?.opposition || {}),
        },
      },
    ]),
  );
  const [selected, setSelected] = useState("speeches");
  const [form, setForm] = useState(() => ({
    ...merged.speeches,
    bio: merged.speeches.bio.join("\n"),
    facts: merged.speeches.facts.join("\n"),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choose = (key) => {
    const profile = merged[key];
    setSelected(key);
    setForm({
      ...profile,
      bio: profile.bio.join("\n"),
      facts: profile.facts.join("\n"),
    });
    setError("");
  };
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const changePerson = (group, name, value) =>
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [name]: value },
    }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const profile = {
        ...form,
        bio: lines(form.bio),
        facts: lines(form.facts),
      };
      await referenceAdminApi.updatePageProfiles({
        ...merged,
        [selected]: profile,
      });
      await onReload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const labels = {
    speeches: "Speeches",
    rallies: "Rallies",
    elections: "Elections",
  };
  const articleCategories = {
    speeches: "Speech",
    rallies: "Rally",
    elections: "Elections",
  };
  return (
    <section className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6">
      <h2 className="font-headline-lg text-xl text-primary">
        Page Information
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Edit what each public page explains, its highlighted sides or leaders,
        history paragraphs, and key facts.
      </p>
      {error && (
        <p className="mt-4 rounded-md bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2 overflow-x-auto">
        {Object.keys(labels).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => choose(key)}
            className={`rounded-md px-4 py-2 text-sm ${selected === key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"}`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      <form
        onSubmit={save}
        inert={saving}
        aria-busy={saving}
        className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field
          definition={[
            "description",
            "What this page is about",
            "textarea",
            true,
          ]}
          value={form.description}
          onChange={change}
        />
        <Field
          definition={["currentLabel", "First section heading", "text"]}
          value={form.currentLabel}
          onChange={change}
        />
        <Field
          definition={["oppositionLabel", "Second section heading", "text"]}
          value={form.oppositionLabel}
          onChange={change}
        />
        <Field
          definition={[
            "currentName",
            "First highlighted name or group",
            "text",
          ]}
          value={form.current.name}
          onChange={(_, value) => changePerson("current", "name", value)}
        />
        <Field
          definition={["currentRole", "First highlighted description", "text"]}
          value={form.current.role}
          onChange={(_, value) => changePerson("current", "role", value)}
        />
        <Field
          definition={["currentPhoto", "First highlighted photo", "image"]}
          value={form.current.photo}
          onChange={(_, value) => changePerson("current", "photo", value)}
        />
        <Field
          definition={[
            "oppositionName",
            "Second highlighted name or group",
            "text",
          ]}
          value={form.opposition.name}
          onChange={(_, value) => changePerson("opposition", "name", value)}
        />
        <Field
          definition={[
            "oppositionRole",
            "Second highlighted description",
            "text",
          ]}
          value={form.opposition.role}
          onChange={(_, value) => changePerson("opposition", "role", value)}
        />
        <Field
          definition={["oppositionPhoto", "Second highlighted photo", "image"]}
          value={form.opposition.photo}
          onChange={(_, value) => changePerson("opposition", "photo", value)}
        />
        <Field
          definition={[
            "bio",
            "History and explanation (one paragraph per line)",
            "textarea",
          ]}
          value={form.bio}
          onChange={change}
        />
        <Field
          definition={["facts", "Key facts (one fact per line)", "textarea"]}
          value={form.facts}
          onChange={change}
        />
        <button
          disabled={saving}
          className="w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-label-md text-on-primary disabled:opacity-60"
        >
          {saving ? "Saving…" : `Save ${labels[selected]} Page`}
        </button>
      </form>
      <div className="mt-6 border-t border-outline-variant/30 pt-4">
        <p className="text-sm text-on-surface-variant">
          To add news coverage beneath this information:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(labels).map(([key, label]) => (
            <Link
              key={key}
              href={`/author/create/article?category=${encodeURIComponent(articleCategories[key])}`}
              className="rounded-md border border-primary/40 px-3 py-2 text-xs text-primary"
            >
              Add {label} Article
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ReferenceDataAdminClient({ initialTab = "" }) {
  const { user } = useAuth();
  const { activeSite, activeSiteId, features } = useAdminSite();
  const confirmDelete = useConfirmDialog();
  const allowedTabs = useMemo(() => TABS.filter((item) =>
    (item.key !== "politicians" || features.feature_leaders !== false) &&
    (item.key !== "parties" || features.feature_parties !== false) &&
    (item.key !== "states" || features.feature_states !== false) &&
    (item.key === "homeWidgets"
      ? HOME_WIDGET_PERMISSIONS.some((permission) => hasPermission(user, permission))
      : hasPermission(user, item.permission))
  ), [features, user]);
  const [data, setData] = useState({
    politicians: [],
    parties: [],
    states: [],
    districts: [],
    parliament: DEFAULT_PARLIAMENT,
    events: [],
    rallies: [],
    upcomingElections: [],
    vidhanSabhas: [],
  });
  const [tab, setTab] = useState(() => allowedTabs.some((item) => item.key === initialTab) ? initialTab : allowedTabs[0]?.key || "");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => ({ ...(EMPTY[tab] || {}) }));
  const [houseKey, setHouseKey] = useState("loksabha");
  const [houseForm, setHouseForm] = useState(() =>
    houseToForm(DEFAULT_PARLIAMENT.loksabha),
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await referenceAdminApi.list();
      setData({
        ...result,
        parliament: result.parliament || DEFAULT_PARLIAMENT,
      });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    referenceAdminApi
      .list()
      .then((result) => {
        if (active)
          setData({
            ...result,
            parliament: result.parliament || DEFAULT_PARLIAMENT,
          });
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeSiteId]);

  const items = useMemo(() => {
    if (tab === "parliament") return Object.values(data.parliament);
    if (tab === "homeWidgets") return [];
    if (tab === "pageContent" || tab === "websitePages") return [];
    const term = search.toLowerCase();
    return (data[tab] || []).filter(
      (item) =>
        `${item.name || ""} ${item.title || ""} ${item.abbreviation || ""} ${item.state || ""} ${item.date || ""}`
          .toLowerCase()
          .includes(term) &&
        (!filter || item.category === filter || item.kind === filter),
    );
  }, [data, filter, search, tab]);

  const chooseTab = (next) => {
    setTab(next);
    setEditing(null);
    setForm({ ...(EMPTY[next] || {}) });
    setSearch("");
    setFilter("");
    setPage(1);
    setError("");
  };
  useEffect(() => {
    if (allowedTabs.some((item) => item.key === tab) || !allowedTabs[0]) return;
    const timer = window.setTimeout(() => chooseTab(allowedTabs[0].key), 0);
    return () => window.clearTimeout(timer);
  }, [allowedTabs, tab]);
  const scrollTabsWithWheel = (event) => {
    const tabList = event.currentTarget;
    const distance =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    const maxScroll = tabList.scrollWidth - tabList.clientWidth;
    const canScroll =
      maxScroll > 0 &&
      ((distance < 0 && tabList.scrollLeft > 0) ||
        (distance > 0 && tabList.scrollLeft < maxScroll));

    if (canScroll) {
      event.preventDefault();
      tabList.scrollLeft += distance;
    }
  };
  const reset = () => {
    setEditing(null);
    setForm({ ...EMPTY[tab] });
    setError("");
  };
  const edit = (item) => {
    setEditing(item);
    setForm(toForm(tab, item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Each website has one Vidhan Sabha: once it exists, the tab always edits it.
  const singleVidhanSabha = tab === "vidhanSabhas" ? (data.vidhanSabhas || [])[0] || null : null;
  useEffect(() => {
    if (!singleVidhanSabha || editing?.id === singleVidhanSabha.id) return undefined;
    const timer = window.setTimeout(() => {
      setEditing(singleVidhanSabha);
      setForm(toForm("vidhanSabhas", singleVidhanSabha));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [singleVidhanSabha, editing]);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (["events", "rallies", "upcomingElections", "vidhanSabhas"].includes(tab)) {
        const current = data[tab] || [];
        const item = { ...form, id: editing?.id || `${Date.now()}` };
        const next = tab === "vidhanSabhas"
          ? [item]
          : editing
            ? current.map((entry) => (entry.id === editing.id ? item : entry))
            : [item, ...current];
        if (tab === "vidhanSabhas")
          await referenceAdminApi.updateVidhanSabhas(next);
        else await referenceAdminApi.updateSchedule(tab, next);
      } else {
        const payload = payloadOf(tab, form);
        if (editing) await referenceAdminApi.update(tab, editing.id, payload);
        else await referenceAdminApi.create(tab, payload);
      }
      await load();
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item) => {
    const label = item.name || item.title || "this item";
    const confirmed = await confirmDelete({
      title: `Delete ${label}?`,
      description: "This site data record will be moved to Deleted Items. It can be restored later from Deleted Items.",
    });
    if (!confirmed) return;
    try {
      const next = (data[tab] || []).filter((entry) => entry.id !== item.id);
      if (tab === "vidhanSabhas")
        await referenceAdminApi.updateVidhanSabhas(next);
      else if (["events", "rallies", "upcomingElections"].includes(tab))
        await referenceAdminApi.updateSchedule(tab, next);
      else await referenceAdminApi.remove(tab, item.id);
      await load();
      if (editing?.id === item.id) reset();
    } catch (err) {
      setError(err.message);
    }
  };
  const selectHouse = (item) => {
    setHouseKey(item.key);
    setHouseForm(houseToForm(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveHouse = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const colors = [
        "bg-primary",
        "bg-secondary",
        "bg-surface-tint",
        "bg-error",
        "bg-green-600",
        "bg-amber-500",
        "bg-orange-500",
        "bg-outline-variant",
      ];
      const house = structuredClone(houseForm);
      house.totalSeats = Number(house.totalSeats) || 0;
      house.composition = lines(house.compositionText)
        .map((line, index) => {
          const [party, seats] = line.split("|").map((part) => part.trim());
          return {
            party,
            seats: Number(seats) || 0,
            colorClass: colors[index % colors.length],
          };
        })
        .filter((item) => item.party);
      delete house.compositionText;
      await referenceAdminApi.updateParliament({
        ...data.parliament,
        [houseKey]: house,
      });
      await load();
      setHouseForm(houseToForm(house));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns =
    tab === "politicians"
      ? [
          ["name", "Name"],
          ["category", "Category"],
          ["party", "Party"],
          ["current_position", "Position"],
        ]
      : tab === "parties"
        ? [
            ["name", "Party"],
            ["abbreviation", "Short name"],
            ["founded_year", "Founded"],
          ]
        : tab === "states"
          ? [
              ["name", "Name"],
              ["kind", "Type"],
              ["capital", "Capital"],
            ]
          : tab === "districts"
            ? [
                ["name", "District"],
                ["state", "State"],
                ["headquarters", "Headquarters"],
                ["population", "Population"],
              ]
          : tab === "vidhanSabhas"
            ? [
                ["state", "State"],
                ["name", "Assembly"],
                ["totalSeats", "Seats"],
                ["chiefMinister", "Chief Minister"],
                ["rulingParty", "Ruling party"],
              ]
            : [
                ["date", "Date"],
                ["title", "Title"],
              ];
  const tableColumns = columns.map(([key, label]) => ({ key, label }));

  if (tab === "homeWidgets")
    return (
      <div className="space-y-6">
        <div className="flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-scroll overscroll-x-contain rounded-lg border border-outline-variant/30 bg-surface p-2 pb-3 touch-pan-x [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" role="tablist" aria-label="Site data sections" onWheel={scrollTabsWithWheel}>
          {allowedTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => chooseTab(item.key)}
              role="tab"
              aria-selected={tab === item.key}
              className={`flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-label-md ${tab === item.key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"}`}
            >
              <i className={`fa-solid ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-error/10 px-4 py-3 text-sm text-error"
          >
            {error}
          </p>
        )}
        <HomeWidgetsAdmin widgets={data.homeWidgets} onReload={load} user={user} siteId={activeSiteId} />
      </div>
    );

  if (tab === "pageContent")
    return (
      <div className="space-y-6">
        <div className="flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-scroll overscroll-x-contain rounded-lg border border-outline-variant/30 bg-surface p-2 pb-3 touch-pan-x [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" role="tablist" aria-label="Site data sections" onWheel={scrollTabsWithWheel}>
          {allowedTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => chooseTab(item.key)}
              role="tab"
              aria-selected={tab === item.key}
              className={`flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-label-md ${tab === item.key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"}`}
            >
              <i className={`fa-solid ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </div>
        <PageContentAdmin profiles={data.pageProfiles} onReload={load} />
      </div>
    );

  if (tab === "websitePages")
    return <WebsitePagesAdmin pages={data.homeWidgets?.managed_pages || {}} onReload={load} siteId={activeSiteId} />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="font-headline-md text-primary">Editing site data for {activeSite?.name || "the active website"}</p>
        <p className="mt-1 text-xs text-on-surface-variant">Only sections enabled for this website are shown. Schedules, assemblies, parliament and page details are saved separately for each website.</p>
      </div>
      <div className="flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-scroll overscroll-x-contain rounded-lg border border-outline-variant/30 bg-surface p-2 pb-3 touch-pan-x [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" role="tablist" aria-label="Site data sections" onWheel={scrollTabsWithWheel}>
        {allowedTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => chooseTab(item.key)}
            role="tab"
            aria-selected={tab === item.key}
            className={`flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-label-md ${tab === item.key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"}`}
          >
            <i className={`fa-solid ${item.icon}`} />
            {item.label}
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </p>
      )}
      {tab === "parliament" ? (
        <>
          <form
            onSubmit={saveHouse}
            inert={saving}
            aria-busy={saving}
            className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6"
          >
            <h2 className="font-headline-lg text-xl text-primary">
              Edit {houseForm.label}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Fill in the fields below. No JSON or coding is needed.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {HOUSE_FIELDS.map((field) => (
                <Field
                  key={field[0]}
                  definition={field}
                  value={getPath(houseForm, field[0])}
                  onChange={(name, value) =>
                    setHouseForm((current) => setPath(current, name, value))
                  }
                />
              ))}
            </div>
            <button
              disabled={saving}
              className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-label-md text-on-primary disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save House Details"}
            </button>
          </form>
          <section className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6">
            <h2 className="mb-4 font-headline-lg text-xl text-primary">
              Parliament houses
            </h2>
            <DataTable
              rows={items}
              columns={[
                ["label", "House"],
                ["fullName", "Full name"],
                ["totalSeats", "Seats"],
                ["currentTerm", "Current term"],
              ].map(([key, label]) => ({ key, label }))}
              onEdit={selectHouse}
              page={page}
              setPage={setPage}
            />
          </section>
        </>
      ) : (
        <>
          <form
            onSubmit={save}
            inert={saving}
            aria-busy={saving}
            className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-headline-lg text-xl text-primary">
                {tab === "vidhanSabhas"
                  ? "Vidhan Sabha details"
                  : editing
                    ? `Edit ${editing.name || editing.title}`
                    : `Add ${TABS.find((item) => item.key === tab)?.label}`}
              </h2>
              {editing && tab !== "vidhanSabhas" && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-primary"
                >
                  CANCEL
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS[tab].map((field) => (
                <Field
                  key={field[0]}
                  definition={field}
                  value={form[field[0]]}
                  onChange={(name, value) =>
                    setForm((current) => ({ ...current, [name]: value }))
                  }
                />
              ))}
            </div>
            <button
              disabled={saving}
              className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-label-md text-on-primary disabled:opacity-60"
            >
              {saving ? "Saving…" : tab === "vidhanSabhas" ? "Save" : editing ? "Update" : "Add"}
            </button>
            {tab === "vidhanSabhas" && <p className="mt-3 text-xs text-on-surface-variant">This website has one Vidhan Sabha. Saving updates it; it is shown at /vidhansabha and in the homepage Vidhan Sabha section.</p>}
          </form>
          {tab !== "vidhanSabhas" && <section className="rounded-lg border border-outline-variant/30 bg-surface p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-headline-lg text-xl text-primary">
                Saved records
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search table…"
                  className={inputClass}
                />
                {tab === "politicians" && (
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="">All categories</option>
                    <option value="KEY_FIGURE">Key figures</option>
                    <option value="FORMER_PM">Former PMs</option>
                    <option value="CHIEF_MINISTER">Chief Ministers</option>
                    <option value="PARTY_LEADER">Party leaders</option>
                  </select>
                )}
                {tab === "states" && (
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="">All types</option>
                    <option value="STATE">States</option>
                    <option value="UNION_TERRITORY">Union Territories</option>
                  </select>
                )}
              </div>
            </div>
            {loading ? (
              <p>Loading…</p>
            ) : (
              <DataTable
                rows={items}
                columns={tableColumns}
                onEdit={edit}
                onDelete={remove}
                page={page}
                setPage={setPage}
              />
            )}
          </section>}
        </>
      )}
    </div>
  );
}
