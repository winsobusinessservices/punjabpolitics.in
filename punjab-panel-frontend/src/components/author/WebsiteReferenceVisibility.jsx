"use client";

import { useEffect, useMemo, useState } from "react";
import { categoriesApi } from "@/lib/api";

const GROUPS = [
  { key: "parties", type: "PARTY", title: "Political Parties", icon: "fa-flag", detail: "Choose which parties appear on this website." },
  { key: "politicians", type: "POLITICIAN", title: "Leaders", icon: "fa-user-tie", detail: "Choose the leaders and chief ministers visitors can see." },
  { key: "states", type: "STATE", title: "States", icon: "fa-map-location-dot", detail: "Choose the states shown in directories and category pages." },
  { key: "districts", type: "DISTRICT", title: "Districts", icon: "fa-location-dot", detail: "Choose the districts shown in the district directory and district pages." },
];

const EMPTY_REFERENCES = { parties: [], politicians: [], states: [], districts: [] };

export default function WebsiteReferenceVisibility({ siteId }) {
  const [references, setReferences] = useState(EMPTY_REFERENCES);
  const [activeGroup, setActiveGroup] = useState("parties");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(new Set());
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await categoriesApi.listReferenceVisibility(siteId);
    setReferences(data.references || EMPTY_REFERENCES);
  };

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    categoriesApi.listReferenceVisibility(siteId)
      .then((data) => { if (active) setReferences(data.references || EMPTY_REFERENCES); })
      .catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId]);

  const group = GROUPS.find((item) => item.key === activeGroup);
  const visibleItems = useMemo(() => {
    const items = references[activeGroup] || [];
    const query = filter.trim().toLowerCase();
    return query ? items.filter((item) => `${item.name || ""} ${item.abbreviation || ""} ${item.state || ""}`.toLowerCase().includes(query)) : items;
  }, [activeGroup, filter, references]);

  const toggle = async (item) => {
    const key = `${group.type}:${item.id}`;
    const isVisible = !Boolean(item.is_visible);
    setUpdating((current) => new Set(current).add(key)); setMessage("");
    try {
      await categoriesApi.setReferenceVisibility(group.type, item.id, isVisible, siteId);
      setReferences((current) => ({ ...current, [activeGroup]: current[activeGroup].map((row) => row.id === item.id ? { ...row, is_visible: isVisible } : row) }));
      setMessage(`${item.name} is now ${isVisible ? "shown" : "hidden"} on this website.`);
    } catch (error) { setMessage(error.message); }
    finally { setUpdating((current) => { const next = new Set(current); next.delete(key); return next; }); }
  };

  const setAll = async (isVisible) => {
    const targets = visibleItems.filter((item) => Boolean(item.is_visible) !== isVisible);
    if (!targets.length) return;
    setLoading(true); setMessage("");
    try {
      await Promise.all(targets.map((item) => categoriesApi.setReferenceVisibility(group.type, item.id, isVisible, siteId)));
      await load();
      setMessage(`${isVisible ? "Selected" : "Hidden"} ${targets.length} ${group.title.toLowerCase()}.`);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };

  return <section className="rounded-lg border border-primary/30 bg-surface-container-low/60 p-4 sm:p-5">
    <h2 className="font-headline-lg text-xl text-primary">Website Directory Selection</h2>
    <p className="mt-1 text-xs text-on-surface-variant">Unselecting something hides it only from the selected website. It is not deleted.</p>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{GROUPS.map((item) => <button key={item.key} type="button" onClick={() => { setActiveGroup(item.key); setFilter(""); }} className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold ${activeGroup === item.key ? "border-primary bg-primary text-on-primary" : "border-outline-variant/30 bg-surface text-on-surface"}`}><i className={`fa-solid ${item.icon} mr-2`} />{item.title}</button>)}</div>
    <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="font-semibold text-on-surface">{group.title}</h3><p className="text-xs text-on-surface-variant">{group.detail}</p></div><div className="flex gap-2"><button type="button" onClick={() => setAll(true)} className="rounded border border-primary/30 px-3 py-2 text-xs font-semibold text-primary">Select shown results</button><button type="button" onClick={() => setAll(false)} className="rounded border border-outline-variant/40 px-3 py-2 text-xs">Hide shown results</button></div></div>
    <div className="relative mt-4"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Search ${group.title.toLowerCase()}...`} className="w-full rounded border border-outline-variant/30 bg-surface py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none" /></div>
    {message && <p className="mt-3 text-xs text-primary" role="status">{message}</p>}
    {loading ? <p className="py-8 text-center text-sm text-on-surface-variant">Loading selections...</p> : <div className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">{visibleItems.map((item) => { const key = `${group.type}:${item.id}`; return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${item.is_visible ? "border-primary/30 bg-primary/5" : "border-outline-variant/25 bg-surface opacity-70"}`}><input type="checkbox" checked={Boolean(item.is_visible)} disabled={updating.has(key)} onChange={() => toggle(item)} className="h-4 w-4 accent-primary" /><span className="min-w-0"><strong className="block truncate text-sm text-on-surface">{item.name}</strong><small className="block truncate text-on-surface-variant">{item.abbreviation || item.category?.replaceAll("_", " ") || item.kind || item.state || "Directory item"}</small></span></label>; })}{!visibleItems.length && <p className="col-span-full py-8 text-center text-sm text-on-surface-variant">No matching items.</p>}</div>}
  </section>;
}
