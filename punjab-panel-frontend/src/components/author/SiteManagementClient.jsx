"use client";

import { useCallback, useEffect, useState } from "react";
import { mediaUrl, siteManagementApi, uploadApi } from "@/lib/api";
import { useAdminSite } from "@/context/AdminSiteContext";

const DEFAULT_HEADER = {
  showUpcomingRallies: true,
  showWeather: true,
  showUpcomingEvents: true,
  menuItems: [],
  countdown: { enabled: false, title: "Election Results", targetAt: "", link: "/elections", buttonLabel: "View results" },
};

const DEFAULT_HOME_VIDEO = { enabled: false, title: "Watch", videoUrl: "", posterUrl: "", placement: "above_footer" };

const inputClass = "mt-1.5 w-full rounded-md border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none";

const HOMEPAGE_SECTION_TYPES = [
  ["top_news", "Top News", "/top-news"],
  ["latest_news", "Latest News", "/top-news"],
  ["leaders", "Political Leaders", "/key-political-figures"],
  ["services", "Services", "/services"],
  ["blogs", "Blogs", "/blogs"],
  ["videos", "Videos", "/videos"],
  ["parties", "Political Parties", "/parties"],
];

const BUILTIN_HOMEPAGE_SECTIONS = [
  ["top_stories", "Top Stories"],
  ["vidhan_sabha", "Vidhan Sabha"],
  ["editorial_opinion", "Editorial Opinion"],
  ["latest_blogs", "Latest Blogs"],
  ["regional_focus", "Regional Focus"],
  ["in_depth_analysis", "In-Depth Analysis"],
  ["multimedia_hub", "Multimedia Hub"],
  ["main_ad", "Homepage Advertisement"],
  ["key_figures", "Key Political Figures"],
  ["former_prime_ministers", "Former Prime Ministers"],
  ["voices_of_nation", "Voices of the Nation"],
  ["state_leadership", "State Leadership"],
  ["political_parties", "Political Parties"],
  ["parliament", "Parliament"],
  ["digital_dispatches", "Digital Dispatches"],
  ["cm_corner", "Chief Minister's Corner"],
  ["pm_corner", "Prime Minister's Corner"],
  ["press_conferences", "Press Conference Archive"],
];

function normalizeHomepageSections(sections) {
  const saved = Array.isArray(sections) ? sections.map((section) => ({
    ...section,
    placement: section.placement === "after_hero" ? "after_hero" : "main_content",
  })) : [];
  const builtins = BUILTIN_HOMEPAGE_SECTIONS.map(([sectionKey, title]) => ({ id: `builtin:${sectionKey}`, type: "builtin", sectionKey, title, placement: "main_content" }));
  if (!saved.some((section) => section.type === "builtin")) return [...builtins, ...saved];
  const savedIds = new Set(saved.map((section) => section.id));
  return [...saved, ...builtins.filter((section) => !savedIds.has(section.id))];
}

function dateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/25 bg-surface px-4 py-3">
      <div>
        <p className="font-label-md text-sm text-on-surface">{label}</p>
        {description && <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={`${checked ? "Disable" : "Enable"} ${label}`} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-primary" : "bg-outline-variant"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function CountdownPreview({ countdown }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, []);
  const target = new Date(countdown.targetAt || "").getTime();
  const remaining = now === null || !Number.isFinite(target) ? 0 : Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const units = [
    ["Days", Math.floor(totalSeconds / 86400)],
    ["Hours", Math.floor((totalSeconds % 86400) / 3600)],
    ["Minutes", Math.floor((totalSeconds % 3600) / 60)],
    ["Seconds", totalSeconds % 60],
  ];
  return (
    <div className="rounded-lg border border-primary/25 bg-surface-container-low p-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Header preview</span>
          <i className="fa-solid fa-hourglass-half text-primary" aria-hidden="true" />
        </div>
        <h3 className="mt-3 truncate font-headline-md text-base text-primary">{countdown.title || "Election Results"}</h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {units.map(([label, value]) => <div key={label} className="rounded-md border border-outline-variant/25 bg-surface px-1 py-2 text-center"><strong className="block text-lg leading-none text-on-surface">{String(value).padStart(2, "0")}</strong><span className="mt-1 block text-[8px] uppercase tracking-wide text-on-surface-variant">{label}</span></div>)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs"><span className="text-on-surface-variant">{countdown.enabled ? "Visible in website header" : "Currently disabled"}</span><span className="font-label-md text-primary">{countdown.buttonLabel || "View results"} <i className="fa-solid fa-arrow-right ml-1" /></span></div>
      </div>
    </div>
  );
}

export default function SiteManagementClient() {
  const { activeSite, activeSiteId: siteId } = useAdminSite();
  const [data, setData] = useState({ widgets: {}, sections: [] });
  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingSection, setUpdatingSection] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newMenuLabel, setNewMenuLabel] = useState("");
  const [newMenuHref, setNewMenuHref] = useState("");
  const [menuError, setMenuError] = useState("");
  const [draggedMenuHref, setDraggedMenuHref] = useState("");
  const [homepageSections, setHomepageSections] = useState([]);
  const [labelDrafts, setLabelDrafts] = useState({});
  const [savingLabels, setSavingLabels] = useState(false);
  const [homeVideo, setHomeVideo] = useState(DEFAULT_HOME_VIDEO);
  const [homeVideoBusy, setHomeVideoBusy] = useState("");
  const [newHomepageSection, setNewHomepageSection] = useState({ type: "top_news", title: "Top News", limit: 3, viewAllHref: "/top-news" });
  const [savingHomepageSections, setSavingHomepageSections] = useState(false);
  const [draggedHomepageSectionId, setDraggedHomepageSectionId] = useState("");
  const [editingHomepageSectionId, setEditingHomepageSectionId] = useState("");

  const load = useCallback(async () => {
    const result = await siteManagementApi.get(siteId);
    setData(result);
    setHeader({
      ...DEFAULT_HEADER,
      ...(result.widgets?.site_header || {}),
      menuItems: Array.isArray(result.widgets?.site_header?.menuItems) ? result.widgets.site_header.menuItems : [],
      countdown: { ...DEFAULT_HEADER.countdown, ...(result.widgets?.site_header?.countdown || {}) },
    });
    setHomepageSections(normalizeHomepageSections(result.widgets?.homepage_sections));
    setHomeVideo({ ...DEFAULT_HOME_VIDEO, ...(result.widgets?.home_video || {}) });
    return result;
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    siteManagementApi.get(siteId).then((result) => {
      if (!active) return;
      setData(result);
      setHeader({ ...DEFAULT_HEADER, ...(result.widgets?.site_header || {}), menuItems: Array.isArray(result.widgets?.site_header?.menuItems) ? result.widgets.site_header.menuItems : [], countdown: { ...DEFAULT_HEADER.countdown, ...(result.widgets?.site_header?.countdown || {}) } });
      setHomepageSections(normalizeHomepageSections(result.widgets?.homepage_sections));
    setHomeVideo({ ...DEFAULT_HOME_VIDEO, ...(result.widgets?.home_video || {}) });
    }).catch((err) => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [siteId]);

  const saveHeader = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await siteManagementApi.updateHeader(header, Number(siteId));
      setHeader(result.header);
      setMessage("Header and countdown settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addMenuItem = () => {
    const label = newMenuLabel.trim();
    const href = newMenuHref.trim();
    if (!label || !href) {
      setMenuError("Enter both the menu label and destination.");
      return;
    }
    if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) {
      setMenuError("Destination must begin with / or http.");
      return;
    }
    if ((header.menuItems || []).some((item) => item.href === href)) {
      setMenuError("That destination is already in the header menu.");
      return;
    }
    setHeader((current) => ({ ...current, menuItems: [...(current.menuItems || []), { label, href, enabled: true }] }));
    setNewMenuLabel("");
    setNewMenuHref("");
    setMenuError("");
  };

  const orderedHeaderMenuItems = header.menuItems || [];
  const moveMenuItem = (sourceHref, targetHref) => {
    if (!sourceHref || !targetHref || sourceHref === targetHref) return;
    const order = orderedHeaderMenuItems.map((item) => item.href).filter((href) => href !== sourceHref);
    order.splice(order.indexOf(targetHref), 0, sourceHref);
    setHeader((current) => ({ ...current, menuItems: order.map((href) => current.menuItems.find((item) => item.href === href)).filter(Boolean) }));
    setDraggedMenuHref("");
  };

  const toggleSection = async (section) => {
    setUpdatingSection(section.section_key);
    setError("");
    try {
      await siteManagementApi.setSectionVisibility(section.section_key, !Boolean(section.is_visible), Number(siteId));
      await load();
      if (section.section_key.startsWith("feature_")) window.dispatchEvent(new Event("panel-site-features-changed"));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingSection("");
    }
  };

  const chooseHomepageSectionType = (type) => {
    const option = HOMEPAGE_SECTION_TYPES.find(([key]) => key === type);
    setNewHomepageSection({ type, title: option?.[1] || "", limit: 3, viewAllHref: option?.[2] || "" });
  };

  const addHomepageSection = () => {
    if (!newHomepageSection.title.trim()) { setError("Enter a homepage section title."); return; }
    setHomepageSections((current) => [...current, { ...newHomepageSection, id: `${newHomepageSection.type}-${Date.now()}`, title: newHomepageSection.title.trim(), enabled: true, placement: "main_content" }]);
    setMessage("Section added below. Save homepage sections to publish it.");
    setError("");
  };

  const moveHomepageSection = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setHomepageSections((current) => {
      const source = current.find((section) => section.id === sourceId);
      const target = current.find((section) => section.id === targetId);
      if (!source || !target) return current;
      if (source.type === "builtin" && target.placement === "after_hero") return current;
      const reordered = current.filter((section) => section.id !== sourceId);
      reordered.splice(reordered.findIndex((section) => section.id === targetId), 0, { ...source, placement: source.type === "builtin" ? "main_content" : (target.placement || "main_content") });
      return reordered;
    });
    setDraggedHomepageSectionId("");
  };

  const moveHomepageSectionToPlacement = (sourceId, placement) => {
    if (!sourceId) return;
    setHomepageSections((current) => {
      const source = current.find((section) => section.id === sourceId);
      if (!source) return current;
      if (source.type === "builtin" && placement === "after_hero") return current;
      return [...current.filter((section) => section.id !== sourceId), { ...source, placement }];
    });
    setDraggedHomepageSectionId("");
  };

  const uploadHomeVideoFile = async (kind, file) => {
    if (!file) return;
    if (kind === "video" && file.size > 200 * 1024 * 1024) { setError("Video must be 200 MB or smaller."); return; }
    setHomeVideoBusy(kind); setError(""); setMessage("");
    try {
      const result = kind === "video" ? await uploadApi.video(file) : await uploadApi.image(file);
      setHomeVideo((current) => ({ ...current, [kind === "video" ? "videoUrl" : "posterUrl"]: result.url, ...(kind === "video" ? { enabled: true } : {}) }));
      setMessage(kind === "video" ? "Video uploaded. Click Save Homepage Video to publish it." : "Poster uploaded. Click Save Homepage Video to publish it.");
    } catch (err) { setError(err.message); } finally { setHomeVideoBusy(""); }
  };

  const saveSectionTitles = async () => {
    const current = data.widgets?.homepage_labels || {};
    const next = { ...current };
    for (const [key, title] of Object.entries(labelDrafts)) {
      const value = String(title || "").trim();
      if (!value) { setError("Section titles cannot be empty."); return; }
      next[key] = { ...(current[key] || {}), title: value };
    }
    setSavingLabels(true); setError(""); setMessage("");
    try {
      await siteManagementApi.updateWidget("homepage_labels", next, Number(siteId));
      await load();
      setLabelDrafts({});
      setMessage("Section titles saved for this website.");
    } catch (err) { setError(err.message); } finally { setSavingLabels(false); }
  };

  const saveHomeVideo = async () => {
    setHomeVideoBusy("save"); setError(""); setMessage("");
    try {
      await siteManagementApi.updateWidget("home_video", homeVideo, Number(siteId));
      await load();
      setMessage("Homepage video saved for this website.");
    } catch (err) { setError(err.message); } finally { setHomeVideoBusy(""); }
  };

  const saveHomepageSections = async () => {
    setSavingHomepageSections(true); setError(""); setMessage("");
    try {
      await siteManagementApi.updateWidget("homepage_sections", homepageSections, Number(siteId));
      await load();
      setMessage("Homepage sections saved for this website.");
    } catch (err) { setError(err.message); } finally { setSavingHomepageSections(false); }
  };

  const homepageSectionCard = (section) => {
    const builtinVisibility = section.type === "builtin" ? (data.sections || []).find((item) => item.section_key === section.sectionKey) : null;
    if (section.type === "builtin") return <div key={section.id} draggable onDragStart={() => setDraggedHomepageSectionId(section.id)} onDragEnd={() => setDraggedHomepageSectionId("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveHomepageSection(draggedHomepageSectionId, section.id); }} className={`flex min-h-36 flex-col rounded-xl border border-outline-variant/30 bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm ${draggedHomepageSectionId === section.id ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3"><span className="flex h-10 w-9 cursor-grab items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant" title="Drag to reorder"><i className="fa-solid fa-grip-vertical" /></span><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary"><i className="fa-solid fa-layer-group" /></span><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold ${builtinVisibility?.is_visible !== false ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}>{builtinVisibility?.is_visible !== false ? "VISIBLE" : "HIDDEN"}</span></div>
      <div className="mt-4 min-w-0"><label className="block text-[10px] font-label-md uppercase tracking-wider text-on-surface-variant">Section title<input value={labelDrafts[section.sectionKey] ?? data.widgets?.homepage_labels?.[section.sectionKey]?.title ?? section.title} maxLength={150} onChange={(event) => setLabelDrafts((current) => ({ ...current, [section.sectionKey]: event.target.value }))} onMouseDown={(event) => event.stopPropagation()} draggable={false} className={inputClass} /></label></div>
    </div>;
    const isEditing = editingHomepageSectionId === section.id;
    return <div key={section.id} draggable={!isEditing} onDragStart={() => setDraggedHomepageSectionId(section.id)} onDragEnd={() => setDraggedHomepageSectionId("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveHomepageSection(draggedHomepageSectionId, section.id); }} className={`flex min-h-48 flex-col rounded-xl border border-primary/25 bg-surface p-4 transition hover:border-primary/50 hover:shadow-sm ${draggedHomepageSectionId === section.id ? "opacity-50" : ""}`}>
    <div className="flex items-start gap-3"><span className="flex h-10 w-9 cursor-grab items-center justify-center rounded-lg bg-primary/10 text-primary" title="Drag to reorder or move this section"><i className="fa-solid fa-grip-vertical" /></span><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary"><i className={`fa-solid ${section.type === "services" ? "fa-briefcase" : "fa-layer-group"}`} /></span><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold ${section.enabled !== false ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}>{section.enabled !== false ? "VISIBLE" : "HIDDEN"}</span></div>
    <div className="mt-4"><h3 className="font-label-md text-sm text-on-surface">{section.title}</h3><p className="mt-1 text-xs capitalize text-on-surface-variant">Added {section.type.replace(/_/g, " ")} section · {section.limit || 3} cards · {section.placement === "after_hero" ? "After hero" : "Main content"}</p></div>
    {isEditing && <div className="mt-4 space-y-3 border-t border-outline-variant/25 pt-4">
      <label className="block text-xs font-label-md text-on-surface-variant">Heading<input value={section.title} onChange={(event) => setHomepageSections((current) => current.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item))} className={inputClass} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-label-md text-on-surface-variant">Cards<input type="number" min="1" max="12" value={section.limit} onChange={(event) => setHomepageSections((current) => current.map((item) => item.id === section.id ? { ...item, limit: Number(event.target.value) } : item))} className={inputClass} /></label><label className="text-xs font-label-md text-on-surface-variant">Position<select value={section.placement || "main_content"} onChange={(event) => moveHomepageSectionToPlacement(section.id, event.target.value)} className={inputClass}><option value="after_hero">After hero</option><option value="main_content">Main content</option></select></label></div>
      <label className="block text-xs font-label-md text-on-surface-variant">View all destination<input value={section.viewAllHref || ""} onChange={(event) => setHomepageSections((current) => current.map((item) => item.id === section.id ? { ...item, viewAllHref: event.target.value } : item))} className={inputClass} /></label>
      <Toggle label="Visible" checked={section.enabled !== false} onChange={(value) => setHomepageSections((current) => current.map((item) => item.id === section.id ? { ...item, enabled: value } : item))} />
    </div>}
    <div className="mt-auto flex gap-2 pt-4"><button type="button" onClick={() => setEditingHomepageSectionId(isEditing ? "" : section.id)} className="flex-1 rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"><i className={`fa-solid ${isEditing ? "fa-check" : "fa-pen"} mr-1.5`} />{isEditing ? "Done" : "Edit"}</button><button type="button" onClick={() => { setHomepageSections((current) => current.filter((item) => item.id !== section.id)); setEditingHomepageSectionId(""); }} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error hover:bg-error/10" aria-label={`Remove ${section.title}`}><i className="fa-solid fa-trash-can" /></button></div>
  </div>;
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" aria-label="Loading site management" />;
  const featureSections = (data.sections || []).filter((section) => section.section_key.startsWith("feature_"));
  const homepageVisibilitySections = (data.sections || []).filter((section) => !section.section_key.startsWith("feature_"));

  return (
    <div className="space-y-8">
      {(error || message) && <p role={error ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>{error || message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-surface p-4"><div><p className="font-headline-md text-primary">Website being managed</p><p className="text-xs text-on-surface-variant">Header, menus, features and homepage visibility below apply only to this website. Edit widget content from Site Data.</p></div><div className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{activeSite?.name || "Select a website in the sidebar"}</div></div>

      <form onSubmit={saveHeader} inert={saving} aria-busy={saving} className="rounded-xl border border-primary/25 bg-surface-container-low/60 p-4 sm:p-6">
        <h2 className="font-headline-lg text-xl text-primary">Header &amp; Menu</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Control the content beside the logo and every main navigation item.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Toggle label="Upcoming rallies" description="Shown to the left of the logo when the countdown is off." checked={header.showUpcomingRallies} onChange={(value) => setHeader((current) => ({ ...current, showUpcomingRallies: value }))} />
          <Toggle label="Weather" description="Weather beneath the left header content." checked={header.showWeather} onChange={(value) => setHeader((current) => ({ ...current, showWeather: value }))} />
          <Toggle label="Upcoming events" description="Shown to the right of the logo." checked={header.showUpcomingEvents} onChange={(value) => setHeader((current) => ({ ...current, showUpcomingEvents: value }))} />
        </div>

        <div className="mt-7"><h3 className="font-headline-md text-base text-primary">Header menu items</h3><p className="mt-1 text-xs text-on-surface-variant">Drag items using the handle to change their public menu order, and edit the box under each item to rename it. Every item uses the same show/hide control for {activeSite?.name || "this website"}.</p></div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderedHeaderMenuItems.map((item) => {
            return <div key={item.href} draggable onDragStart={() => setDraggedMenuHref(item.href)} onDragEnd={() => setDraggedMenuHref("")} onDragOver={(event) => event.preventDefault()} onDrop={() => moveMenuItem(draggedMenuHref, item.href)} className={`relative rounded-lg transition ${draggedMenuHref === item.href ? "opacity-50" : ""}`}><span className="absolute left-1 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded p-2 text-on-surface-variant hover:bg-primary/10 hover:text-primary" title="Drag to reorder"><i className="fa-solid fa-grip-vertical" /></span><div className="[&>div]:pl-10"><Toggle label={item.label} description={item.href} checked={item.enabled !== false} onChange={(value) => setHeader((current) => ({ ...current, menuItems: current.menuItems.map((entry) => entry.href === item.href ? { ...entry, enabled: value } : entry) }))} /></div><div className="pl-10 pr-2 pb-1"><input aria-label={`Menu name for ${item.href}`} title="Rename this menu item" value={item.label} maxLength={80} onChange={(event) => setHeader((current) => ({ ...current, menuItems: current.menuItems.map((entry) => entry.href === item.href ? { ...entry, label: event.target.value } : entry) }))} className={`${inputClass} !mt-1 !py-1.5 text-xs`} placeholder="Menu name" /></div><button type="button" aria-label={`Remove ${item.label}`} onClick={() => setHeader((current) => ({ ...current, menuItems: current.menuItems.filter((entry) => entry.href !== item.href) }))} className="absolute right-14 top-1/2 -translate-y-1/2 rounded p-2 text-error hover:bg-error/10"><i className="fa-solid fa-trash-can" /></button></div>;
          })}
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-primary/35 bg-surface p-4">
          <h4 className="font-label-md text-sm text-primary">Add a header menu item</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end"><label className="text-xs font-label-md text-on-surface-variant">Menu label<input className={inputClass} value={newMenuLabel} placeholder="Services" onChange={(event) => { setNewMenuLabel(event.target.value); setMenuError(""); }} /></label><label className="text-xs font-label-md text-on-surface-variant">Destination<input className={inputClass} value={newMenuHref} placeholder="/services" onChange={(event) => { setNewMenuHref(event.target.value); setMenuError(""); }} /></label><button type="button" onClick={addMenuItem} className="min-h-10 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary"><i className="fa-solid fa-plus mr-1.5" />Add to menu</button></div>
          {menuError && <p className="mt-2 text-xs text-error" role="alert">{menuError}</p>}
        </div>

        <div className="mt-7 rounded-xl border border-outline-variant/30 bg-surface p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
            <div>
              <Toggle label="Header countdown timer" description="When enabled, this replaces Upcoming Rallies beside the logo." checked={header.countdown.enabled} onChange={(value) => setHeader((current) => ({ ...current, countdown: { ...current.countdown, enabled: value } }))} />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-label-md text-on-surface-variant">Countdown title<input className={inputClass} value={header.countdown.title} onChange={(event) => setHeader((current) => ({ ...current, countdown: { ...current.countdown, title: event.target.value } }))} required={header.countdown.enabled} /></label>
            <label className="text-xs font-label-md text-on-surface-variant">Result/event date and time<input type="datetime-local" className={inputClass} value={dateTimeInputValue(header.countdown.targetAt)} onChange={(event) => setHeader((current) => ({ ...current, countdown: { ...current.countdown, targetAt: event.target.value ? new Date(event.target.value).toISOString() : "" } }))} required={header.countdown.enabled} /></label>
            <label className="text-xs font-label-md text-on-surface-variant">Click destination<input className={inputClass} placeholder="/elections or https://..." value={header.countdown.link} onChange={(event) => setHeader((current) => ({ ...current, countdown: { ...current.countdown, link: event.target.value } }))} /></label>
            <label className="text-xs font-label-md text-on-surface-variant">Link label<input className={inputClass} value={header.countdown.buttonLabel} onChange={(event) => setHeader((current) => ({ ...current, countdown: { ...current.countdown, buttonLabel: event.target.value } }))} /></label>
              </div>
            </div>
            <CountdownPreview countdown={header.countdown} />
          </div>
        </div>
        <button disabled={saving} className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-label-md text-on-primary disabled:opacity-60">{saving ? "Saving…" : "Save Header Settings"}</button>
      </form>

      <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-6">
        <h2 className="font-headline-lg text-xl text-primary">Website Features &amp; Staff Tools</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Turn off an entire feature for this website. Its public links, page content, and related staff creation tools will be hidden. Existing records remain safely stored.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {featureSections.map((section) => <Toggle key={section.section_key} label={section.label} description={`Show ${section.label} on ${activeSite?.name || "this website"}`} checked={Boolean(section.is_visible)} disabled={updatingSection === section.section_key} onChange={() => toggleSection(section)} />)}
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-4 sm:p-6">
        <h2 className="font-headline-lg text-xl text-primary">Homepage Section Visibility</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Enable or disable complete sections on the public homepage.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {homepageVisibilitySections.map((section) => <Toggle key={section.section_key} label={section.label} checked={Boolean(section.is_visible)} disabled={updatingSection === section.section_key} onChange={() => toggleSection(section)} />)}
        </div>
      </section>

      <section className="rounded-xl border border-primary/30 bg-surface p-4 sm:p-6">
        <h2 className="font-headline-lg text-xl text-primary">Homepage Section Builder</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Add reusable card sections, then drag them into the position where they should appear. Cards are filled automatically with data from the active website.</p>

        <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-dashed border-primary/35 bg-surface-container-low/50 p-4 sm:grid-cols-2 xl:grid-cols-12 xl:items-end">
          <label className="text-xs font-label-md text-on-surface-variant xl:col-span-3">Section type<select value={newHomepageSection.type} onChange={(event) => chooseHomepageSectionType(event.target.value)} className={inputClass}>{HOMEPAGE_SECTION_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-xs font-label-md text-on-surface-variant xl:col-span-3">Section heading<input value={newHomepageSection.title} onChange={(event) => setNewHomepageSection((current) => ({ ...current, title: event.target.value }))} className={inputClass} /></label>
          <label className="text-xs font-label-md text-on-surface-variant xl:col-span-1">Cards<input type="number" min="1" max="12" value={newHomepageSection.limit} onChange={(event) => setNewHomepageSection((current) => ({ ...current, limit: Number(event.target.value) }))} className={inputClass} /></label>
          <label className="text-xs font-label-md text-on-surface-variant xl:col-span-3">View all destination<input value={newHomepageSection.viewAllHref} onChange={(event) => setNewHomepageSection((current) => ({ ...current, viewAllHref: event.target.value }))} className={inputClass} placeholder="/services" /></label>
          <button type="button" onClick={addHomepageSection} className="min-h-11 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary sm:col-span-2 xl:col-span-2"><i className="fa-solid fa-plus mr-1.5" />Add section</button>
        </div>

        <div className="mt-5 space-y-4">
          <div onDragOver={(event) => event.preventDefault()} onDrop={() => moveHomepageSectionToPlacement(draggedHomepageSectionId, "after_hero")} className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${draggedHomepageSectionId ? "border-primary bg-primary/10" : "border-primary/25 bg-primary/5"}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary"><i className="fa-solid fa-image" /></span>
            <div className="min-w-0 flex-1"><h3 className="font-label-md text-sm text-primary">Hero section</h3><p className="text-xs text-on-surface-variant">Fixed first section · Drop a section here to place it immediately after Hero.</p></div>
            <i className="fa-solid fa-lock text-sm text-on-surface-variant" title="Fixed position" />
          </div>

          {homepageSections.some((section) => section.placement === "after_hero") && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {homepageSections.filter((section) => section.placement === "after_hero").map(homepageSectionCard)}
          </div>}

          <div onDragOver={(event) => event.preventDefault()} onDrop={() => moveHomepageSectionToPlacement(draggedHomepageSectionId, "main_content")} className={`flex items-center gap-3 rounded-xl border border-dashed p-3 transition-colors ${draggedHomepageSectionId ? "border-primary bg-primary/10" : "border-outline-variant/30 bg-surface-container-low"}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high text-primary"><i className="fa-solid fa-arrow-down" /></span>
            <div className="min-w-0 flex-1"><h3 className="font-label-md text-sm text-on-surface">Homepage content order</h3><p className="text-xs text-on-surface-variant">Drag cards left-to-right and top-to-bottom. Existing sections are protected from deletion.</p></div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {homepageSections.filter((section) => section.placement !== "after_hero").map(homepageSectionCard)}
          </div>
          {homepageSections.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">No additional homepage sections have been added for this website.</p>}
        </div>
        <button type="button" disabled={savingHomepageSections} onClick={saveHomepageSections} className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60">{savingHomepageSections ? "Saving…" : "Save Homepage Sections"}</button>
        {Object.keys(labelDrafts).length > 0 && <button type="button" disabled={savingLabels} onClick={saveSectionTitles} className="mt-5 ml-3 rounded-lg border border-primary px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-60">{savingLabels ? "Saving…" : "Save Section Titles"}</button>}
      </section>

      <section className="rounded-xl border border-outline-variant/30 bg-surface p-5 md:p-6">
        <h2 className="font-headline-md text-lg text-on-surface">Homepage video</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Upload a video (MP4, WebM or MOV, up to 200 MB) and choose where it appears on the homepage.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-xs font-label-md text-on-surface-variant">Heading<input value={homeVideo.title} maxLength={150} onChange={(event) => setHomeVideo((current) => ({ ...current, title: event.target.value }))} className={inputClass} /></label>
          <label className="text-xs font-label-md text-on-surface-variant">Position<select value={homeVideo.placement} onChange={(event) => setHomeVideo((current) => ({ ...current, placement: event.target.value }))} className={inputClass}><option value="after_hero">After hero</option><option value="main_content">In main content</option><option value="above_footer">Above footer</option></select></label>
          <div className="text-xs font-label-md text-on-surface-variant">Video file
            <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" disabled={homeVideoBusy !== ""} onChange={(event) => { uploadHomeVideoFile("video", event.target.files?.[0]); event.target.value = ""; }} className={inputClass} />
            {homeVideoBusy === "video" && <p className="mt-1.5">Uploading video…</p>}
          </div>
          <div className="text-xs font-label-md text-on-surface-variant">Poster image (optional)
            <input type="file" accept="image/*" disabled={homeVideoBusy !== ""} onChange={(event) => { uploadHomeVideoFile("poster", event.target.files?.[0]); event.target.value = ""; }} className={inputClass} />
            {homeVideoBusy === "poster" && <p className="mt-1.5">Uploading poster…</p>}
          </div>
        </div>
        {homeVideo.videoUrl && <div className="mt-4 max-w-xl">
          <video key={homeVideo.videoUrl} src={mediaUrl(homeVideo.videoUrl)} poster={homeVideo.posterUrl ? mediaUrl(homeVideo.posterUrl) : undefined} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
          <button type="button" onClick={() => setHomeVideo((current) => ({ ...current, videoUrl: "", enabled: false }))} className="mt-2 text-xs font-semibold text-error hover:underline">Remove video</button>
        </div>}
        <div className="mt-4"><Toggle checked={homeVideo.enabled} disabled={!homeVideo.videoUrl} onChange={(value) => setHomeVideo((current) => ({ ...current, enabled: value }))} label="Show video on homepage" description={homeVideo.videoUrl ? "Visitors see the video once you save." : "Upload a video first."} /></div>
        <button type="button" disabled={homeVideoBusy !== ""} onClick={saveHomeVideo} className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60">{homeVideoBusy === "save" ? "Saving…" : "Save Homepage Video"}</button>
      </section>

    </div>
  );
}
