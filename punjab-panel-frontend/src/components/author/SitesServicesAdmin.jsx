"use client";
import { useEffect, useState } from "react";
import RichTextEditor from "@/components/common/RichTextEditor";
import ImageUploadField from "@/components/common/ImageUploadField";
import { servicesApi } from "@/lib/api";
const field = "w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none";
const blank = { title: "", slug: "", summary: "", content: "", icon: "fa-briefcase", imageUrl: "", ctaLabel: "", ctaUrl: "", seoTitle: "", seoDescription: "", isVisible: true };
const ICONS = [["fa-briefcase", "Business services"], ["fa-bullhorn", "Promotion and campaigns"], ["fa-newspaper", "Media and publishing"], ["fa-chart-line", "Research and analysis"], ["fa-people-group", "Community engagement"], ["fa-handshake", "Partnerships"]];
export default function SitesServicesAdmin({ initialSiteId, siteName }) {
  const siteId = String(initialSiteId || "");
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(blank), [editing, setEditing] = useState(null), [error, setError] = useState("");
  const load = async (id) => setServices((await servicesApi.list(id)).services || []);
  useEffect(() => {
    if (siteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load(siteId).catch((e) => setError(e.message));
    }
  }, [siteId]);
  const save = async (event) => { event.preventDefault(); try { const payload = { ...form, siteId: Number(siteId) }; if (editing) await servicesApi.update(editing, payload); else await servicesApi.create(payload); setEditing(null); setForm(blank); await load(siteId); } catch (e) { setError(e.message); } };
  const edit = (item) => { setEditing(item.id); setForm({ title: item.title || "", slug: item.slug || "", summary: item.summary || "", content: item.content || "", icon: item.icon || "fa-briefcase", imageUrl: item.image_url || "", ctaLabel: item.cta_label || "", ctaUrl: item.cta_url || "", seoTitle: item.seo_title || "", seoDescription: item.seo_description || "", isVisible: Boolean(item.is_visible) }); };
  const remove = async (item) => {
    const confirmed = await confirmDelete({
      title: "Delete service?",
      description: `The service “${item.title}” will be permanently deleted.`,
    });
    if (!confirmed) return;
    try {
      await servicesApi.remove(item.id);
      await load(siteId);
    } catch (removeError) {
      setError(removeError.message);
    }
  };
  return <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-4 sm:p-6">
    {error && <p className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-headline-lg text-xl text-primary">Services</h2><p className="mt-1 text-sm text-on-surface-variant">Add and publish services without entering code.</p></div><span className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{siteName}</span></div>
    {!siteId ? <p className="mt-6 rounded-lg bg-surface p-5 text-sm text-on-surface-variant">Services are not enabled for an available website.</p> : <><form onSubmit={save} className="mt-6 space-y-4"><div className="grid gap-4 md:grid-cols-2"><input className={field} placeholder="Service title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /><input className={field} placeholder="Web address (created automatically if blank)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /><textarea className={`${field} md:col-span-2`} rows="2" placeholder="Short summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div><RichTextEditor value={form.content} onChange={(content) => setForm({ ...form, content })} placeholder="Write full service details…" minHeight="20rem" /><div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-on-surface-variant">Service icon<select className={`${field} mt-1.5`} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>{ICONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><ImageUploadField label="Service image (optional)" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} /><input className={field} placeholder="Button text, e.g. Contact us" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} /><input className={field} placeholder="Button destination" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} /><input className={field} placeholder="Search result title (optional)" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /><input className={field} placeholder="Search result description (optional)" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} /> Show this service on the website</label><div className="flex gap-3"><button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">{editing ? "Save Changes" : "Add Service"}</button>{editing && <button type="button" className="rounded-lg border px-5 py-2.5 text-sm" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}</div></form><div className="mt-7 grid gap-3 md:grid-cols-2">{services.map((item) => <article key={item.id} className="rounded-lg border border-outline-variant/25 bg-surface p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-on-surface-variant">{item.is_visible ? "Visible" : "Hidden"}</p><div className="mt-3 flex gap-3"><button type="button" onClick={() => edit(item)} className="text-sm text-primary">Edit</button><button type="button" onClick={() => remove(item)} className="text-sm text-error">Delete</button></div></article>)}</div></>}
  </section>;
}
