"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adsApi, mediaUrl } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import { useAdminSite } from "@/context/AdminSiteContext";

const field = "w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none";
const PLACEMENTS = [
  ["home_banner", "Homepage banner", "Wide banner, about 970 × 120"],
  ["sidebar_left", "Left sidebar", "Rectangle, 300 × 250"],
  ["sidebar_right", "Right sidebar", "Tall, 300 × 600"],
  ["article_inline", "Inside articles", "Wide banner, about 728 × 90"],
];
const blank = { advertiser: "", title: "", placement: "sidebar_left", linkUrl: "", altText: "", displayUrl: "", headline: "", description: "", ctaLabel: "Learn more", startsAt: "", endsAt: "", sortOrder: 0, isActive: true };

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusOf(ad) {
  const now = Date.now();
  if (!ad.is_active) return ["Paused", "bg-outline-variant/30 text-on-surface-variant"];
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return ["Scheduled", "bg-secondary/15 text-secondary"];
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return ["Ended", "bg-error/10 text-error"];
  return ["Live", "bg-green-600/15 text-green-700"];
}

export default function AdsAdminClient() {
  const confirmDelete = useConfirmDialog();
  const { activeSiteId } = useAdminSite();
  const [ads, setAds] = useState([]);
  const [form, setForm] = useState(blank);
  const [image, setImage] = useState(null);
  const [logo, setLogo] = useState(null);
  const [existingImage, setExistingImage] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => setAds((await adsApi.list()).ads || []), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
  }, [load, activeSiteId]);

  const reset = () => { setEditing(null); setForm(blank); setImage(null); setLogo(null); setExistingImage(""); };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (!editing && !image && !form.headline.trim()) return setError("Add a headline (text ad) or upload a banner image");
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (image) data.append("image", image);
    if (logo) data.append("logo", logo);
    setSaving(true);
    try {
      if (editing) await adsApi.update(editing, data); else await adsApi.create(data);
      reset();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (ad) => {
    setEditing(ad.id);
    setImage(null);
    setLogo(null);
    setExistingImage(ad.image_url || "");
    setForm({
      advertiser: ad.advertiser, title: ad.title, placement: ad.placement, linkUrl: ad.link_url, altText: ad.alt_text || "", displayUrl: ad.display_url || "", headline: ad.headline || "", description: ad.description || "", ctaLabel: ad.cta_label || "",
      startsAt: toLocalInput(ad.starts_at), endsAt: toLocalInput(ad.ends_at), sortOrder: ad.sort_order, isActive: Boolean(ad.is_active),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePause = async (ad) => {
    const data = new FormData();
    data.append("isActive", String(!ad.is_active));
    try { await adsApi.update(ad.id, data); await load(); } catch (e) { setError(e.message); }
  };

  const remove = async (ad) => {
    const confirmed = await confirmDelete({ title: "Delete ad?", description: `The ad “${ad.title}” by ${ad.advertiser} will be permanently deleted, including its view and click counts.` });
    if (!confirmed) return;
    try { await adsApi.remove(ad.id); await load(); } catch (e) { setError(e.message); }
  };

  const placementLabel = (key) => PLACEMENTS.find(([value]) => value === key)?.[1] || key;
  const hint = PLACEMENTS.find(([value]) => value === form.placement)?.[2];
  const localPreview = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const previewSrc = localPreview || (existingImage ? mediaUrl(existingImage) : "");

  return <section className="grid md:grid-cols-2 gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-4 sm:p-6">
    <div className=" w-full" >
    {error && <p className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
    <h2 className="font-headline-lg text-xl text-primary">{editing ? "Edit advertisement" : "New advertisement"}</h2>
    <form onSubmit={save} className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-1 ">
        <input className={field} placeholder="Advertiser / company name" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} required />
        <input className={field} placeholder="Ad title (internal label)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <label className="text-xs text-on-surface-variant">Where should it appear?
          <select className={`${field} mt-1.5`} value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
            {PLACEMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {hint && <span className="mt-1 block text-[11px]">Recommended: {hint}</span>}
        </label>
        <label className="text-xs text-on-surface-variant">Destination link
          <input className={`${field} mt-1.5`} type="url" placeholder="https://advertiser.com/offer" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} required />
        </label>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary md:col-span-2">Text ad (logo, headline, description and button — whole card is clickable)</p>
        <input className={field} placeholder="Headline, e.g. Need a Trusted Local Service?" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        <input className={field} placeholder="Website shown under logo, e.g. todayfix.in" value={form.displayUrl} onChange={(e) => setForm({ ...form, displayUrl: e.target.value })} />
        <textarea className={`${field} md:col-span-2`} rows="2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className={field} placeholder="Button text, e.g. Learn more" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />
        <label className="text-xs text-on-surface-variant">Logo{editing ? " (leave empty to keep current)" : ""}
          <input className={`${field} mt-1.5`} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
        </label>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary md:col-span-2">Or a banner image instead (used when there is no headline)</p>
        <label className="text-xs text-on-surface-variant">Banner image{editing ? " (leave empty to keep current)" : ""}
          <input className={`${field} mt-1.5`} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => setImage(e.target.files?.[0] || null)} />
        </label>
        <input className={field} placeholder="Image description for accessibility (optional)" value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} />
        <label className="text-xs text-on-surface-variant">Start showing (optional)
          <input className={`${field} mt-1.5`} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        </label>
        <label className="text-xs text-on-surface-variant">Stop showing (optional)
          <input className={`${field} mt-1.5`} type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </label>
        <label className="text-xs text-on-surface-variant">Order (lower shows first)
          <input className={`${field} mt-1.5`} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </label>
      </div>
      {previewSrc && <img src={previewSrc} alt="Ad preview" className="max-h-40 rounded-lg border border-outline-variant/30 object-contain" />}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (uncheck to pause without deleting)</label>
      <div className="flex gap-3">
        <button disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? "Saving…" : editing ? "Save Changes" : "Add Advertisement"}</button>
        {editing && <button type="button" className="rounded-lg border px-5 py-2.5 text-sm" onClick={reset}>Cancel</button>}
      </div>
    </form>
    </div>

    <div>

    <h2 className="mt-10 font-headline-lg text-xl text-primary">All advertisements</h2>
    {!ads.length ? <p className="mt-4 rounded-lg bg-surface p-5 text-sm text-on-surface-variant">No advertisements yet. Until one is live in a slot, that slot stays hidden on the website.</p> :
      <div className="mt-4 grid gap-3 md:grid-cols-2">{ads.map((ad) => {
        const [label, tone] = statusOf(ad);
        const ctr = ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
        return <article key={ad.id} className="rounded-lg border border-outline-variant/25 bg-surface p-4">
          <div className="flex gap-3">
            {(ad.image_url || ad.logo_url) ? <img src={mediaUrl(ad.image_url || ad.logo_url)} alt={ad.alt_text || ad.title} className="h-20 w-28 flex-shrink-0 rounded border border-outline-variant/20 object-contain bg-surface-container" /> : <span className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded border border-outline-variant/20 bg-surface-container text-xs text-on-surface-variant">Text ad</span>}
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{ad.title}</h3>
              <p className="truncate text-xs text-on-surface-variant">{ad.advertiser} · {placementLabel(ad.placement)}</p>
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">{Number(ad.impressions).toLocaleString()} views · {Number(ad.clicks).toLocaleString()} clicks · {ctr}% CTR</p>
          {(ad.starts_at || ad.ends_at) && <p className="mt-1 text-xs text-on-surface-variant">{ad.starts_at ? new Date(ad.starts_at).toLocaleString() : "Now"} → {ad.ends_at ? new Date(ad.ends_at).toLocaleString() : "No end date"}</p>}
          <div className="mt-3 flex gap-4 text-sm">
            <button type="button" onClick={() => edit(ad)} className="text-primary">Edit</button>
            <button type="button" onClick={() => togglePause(ad)} className="text-primary">{ad.is_active ? "Pause" : "Resume"}</button>
            <button type="button" onClick={() => remove(ad)} className="text-error">Delete</button>
          </div>
        </article>;
      })}</div>}
    </div>

  </section>;
}
