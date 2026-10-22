"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { mediaUrl, sitesApi } from "@/lib/api";
import { applySiteTheme } from "@/lib/siteTheme";

const field = "w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none";
const empty = { name: "", subtitle: "", description: "", slug: "", domain: "", logoUrl: "", iconUrl: "", primaryColor: "#7a1f2b", secondaryColor: "#9a6700", socialText: "", servicesEnabled: false, status: "ACTIVE" };

function fromSite(site) {
  let socials = site.social_links || [];
  if (typeof socials === "string") { try { socials = JSON.parse(socials); } catch { socials = []; } }
  return { name: site.name || "", subtitle: site.subtitle || "", description: site.description || "", slug: site.slug || "", domain: site.domain || "", logoUrl: site.logo_url || "", iconUrl: site.icon_url || "", primaryColor: site.primary_color || "#7a1f2b", secondaryColor: site.secondary_color || "#9a6700", socialText: socials.map((item) => `${item.label} | ${item.url}`).join("\n"), servicesEnabled: Boolean(site.services_enabled), status: site.status || "ACTIVE" };
}

function payload(form, files) {
  const data = new FormData();
  ["name", "subtitle", "description", "slug", "domain", "primaryColor", "secondaryColor", "status"].forEach((key) => data.append(key, form[key] ?? ""));
  data.append("servicesEnabled", String(form.servicesEnabled));
  data.append("socialLinks", JSON.stringify(form.socialText.split("\n").map((line) => { const divider = line.indexOf("|"); return divider < 0 ? null : { label: line.slice(0, divider).trim(), url: line.slice(divider + 1).trim() }; }).filter(Boolean)));
  if (files.logoFile) data.append("logoFile", files.logoFile);
  if (files.iconFile) data.append("iconFile", files.iconFile);
  return data;
}

export default function WebsiteManagementClient() {
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [files, setFiles] = useState({ logoFile: null, iconFile: null });
  const [error, setError] = useState("");
  const load = async () => {
    const available = (await sitesApi.list()).sites || [];
    setSites(available);
    if (available[0]) {
      setEditingId(available[0].id);
      setForm(fromSite(available[0]));
    }
  };
  useEffect(() => {
    let active = true;
    sitesApi.list().then((data) => {
      if (!active) return;
      const available = data.sites || [];
      setSites(available);
      if (available[0]) {
        setEditingId(available[0].id);
        setForm(fromSite(available[0]));
      }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setError("");
    if (!form.iconUrl && !files.iconFile) {
      setError("Please upload a website tab icon before saving. A square PNG, JPG or WebP image works best.");
      return;
    }
    try {
      if (!editingId) throw new Error("Punjab Politics website settings could not be loaded.");
      await sitesApi.update(editingId, payload(form, files));
      setFiles({ logoFile: null, iconFile: null });
      applySiteTheme(document.documentElement, { primary_color: form.primaryColor, secondary_color: form.secondaryColor });
      await load();
    } catch (e) { setError(e.message); }
  };
  return <div className="space-y-6">
    {error && <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-4 sm:p-6">
      <h2 className="font-headline-lg text-xl text-primary">Punjab Politics branding</h2>
      <p className="mt-1 text-sm text-on-surface-variant">These settings control the Punjab Politics website and browser identity.</p>
      <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Website name<input className={`${field} mt-1.5`} value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
        <label className="text-sm">Domain<input className={`${field} mt-1.5`} placeholder="example.com" value={form.domain} onChange={(e) => set("domain", e.target.value)} required /></label>
        <label className="text-sm">Subtitle<input className={`${field} mt-1.5`} placeholder="A short line shown with your brand" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></label>
        <label className="text-sm">Short website name<input className={`${field} mt-1.5`} placeholder="Created automatically if empty" value={form.slug} onChange={(e) => set("slug", e.target.value)} /></label>
        <label className="text-sm md:col-span-2">Website description<textarea className={`${field} mt-1.5 min-h-24 resize-y`} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="rounded-lg border border-outline-variant/25 bg-surface p-4 text-sm"><span className="font-semibold text-on-surface">Website logo</span><span className="mt-1 block text-xs text-on-surface-variant">Upload a PNG, JPG or WebP image. A wide transparent logo works best.</span>{form.logoUrl && <Image src={mediaUrl(form.logoUrl)} alt="Current website logo" width={240} height={80} unoptimized className="mt-3 h-20 max-w-full rounded border border-outline-variant/20 bg-white object-contain p-2" />}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFiles((current) => ({ ...current, logoFile: e.target.files?.[0] || null }))} className="mt-3 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-on-primary" />{files.logoFile && <span className="mt-2 block text-xs text-primary">Selected: {files.logoFile.name}</span>}</label>
        <label className="rounded-lg border border-outline-variant/25 bg-surface p-4 text-sm"><span className="font-semibold text-on-surface">Browser tab icon <span className="text-error">*</span></span><span className="mt-1 block text-xs text-on-surface-variant">This icon appears in the browser tab for this website. Upload a square PNG, JPG or WebP image.</span>{form.iconUrl && <Image src={mediaUrl(form.iconUrl)} alt="Current browser tab icon" width={80} height={80} unoptimized className="mt-3 h-20 w-20 rounded border border-outline-variant/20 bg-white object-contain p-2" />}<input type="file" required={!form.iconUrl} accept="image/png,image/jpeg,image/webp" onChange={(e) => setFiles((current) => ({ ...current, iconFile: e.target.files?.[0] || null }))} className="mt-3 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-on-primary" />{files.iconFile && <span className="mt-2 block text-xs text-primary">Selected tab icon: {files.iconFile.name}</span>}</label>
        <label className="text-sm">Primary colour<div className="mt-1.5 flex gap-2"><input type="color" className="h-11 w-14 rounded border border-outline-variant/30 bg-surface p-1" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} /><input className={field} value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} /></div></label>
        <label className="text-sm">Secondary colour<div className="mt-1.5 flex gap-2"><input type="color" className="h-11 w-14 rounded border border-outline-variant/30 bg-surface p-1" value={form.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} /><input className={field} value={form.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} /></div></label>
        <label className="text-sm md:col-span-2">Social links <span className="text-xs text-on-surface-variant">(one per line: Facebook | https://facebook.com/...)</span><textarea className={`${field} mt-1.5 min-h-28 resize-y`} value={form.socialText} onChange={(e) => set("socialText", e.target.value)} /></label>
        <label className="flex items-center gap-3 rounded-lg border border-outline-variant/25 bg-surface px-3 py-3 text-sm md:col-span-2"><input type="checkbox" checked={form.servicesEnabled} onChange={(e) => set("servicesEnabled", e.target.checked)} /><span><strong className="block">Enable Services menu</strong><span className="text-xs text-on-surface-variant">Turn this on only for websites that provide services.</span></span></label>
        <div className="flex gap-3 md:col-span-2"><button disabled={!editingId} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">Save Website Settings</button></div>
      </form>
    </section>
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-4 sm:p-6"><h2 className="font-headline-lg text-xl text-primary">Punjab Politics connection</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{sites.map((site) => <article key={site.id} className="rounded-lg border border-outline-variant/25 bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3">{site.icon_url ? <Image src={mediaUrl(site.icon_url)} alt={`${site.name} tab icon`} width={44} height={44} unoptimized className="h-11 w-11 flex-none rounded-lg border border-outline-variant/20 bg-white object-contain p-1" /> : <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-error/10 text-error"><i className="fa-solid fa-image" /></span>}<div className="min-w-0"><h3 className="truncate font-semibold text-on-surface">{site.name}</h3><p className="mt-1 truncate text-xs text-on-surface-variant">{site.domain}</p></div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${site.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}>{site.status}</span></div><p className={`mt-3 text-xs ${site.icon_url ? "text-green-700" : "font-semibold text-error"}`}>Browser tab icon: {site.icon_url ? "Added" : "Missing — upload one above"}</p><p className="mt-1 text-xs text-on-surface-variant">Services: {site.services_enabled ? "Enabled" : "Disabled"}</p></article>)}</div>{!sites.length && <p className="mt-4 text-sm text-on-surface-variant">Punjab Politics website settings are unavailable. Start the Punjab backend and refresh this page.</p>}</section>
  </div>;
}
