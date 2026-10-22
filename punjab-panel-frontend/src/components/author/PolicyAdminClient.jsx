"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { policiesApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import { useAdminSite } from "@/context/AdminSiteContext";
import EmptyState from "@/components/common/EmptyState";
import RichTextEditor from "@/components/common/RichTextEditor";

const EMPTY_FORM = { title: "", policyType: "", summary: "", content: "", status: "DRAFT", showOnRegistration: false };

export default function PolicyAdminClient() {
  const confirmDelete = useConfirmDialog();
  const { activeSite, activeSiteId } = useAdminSite();
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPolicies = () => {
    if (!activeSiteId) return;
    policiesApi.listForAdmin(activeSiteId)
      .then((data) => setPolicies(data.policies || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    if (!activeSiteId) return () => { active = false; };
    policiesApi.listForAdmin(activeSiteId).then((data) => { if (active) setPolicies(data.policies || []); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeSiteId]);

  const updateField = (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
  };

  const editPolicy = (policy) => {
    setEditingId(policy.id);
    setForm({
      title: policy.title,
      policyType: policy.policy_type,
      summary: policy.summary,
      content: policy.content,
      status: policy.status,
      showOnRegistration: Boolean(policy.show_on_registration),
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) await policiesApi.update(editingId, form, activeSiteId);
      else await policiesApi.create(form, activeSiteId);
      resetForm();
      loadPolicies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (policy) => {
    const confirmed = await confirmDelete({
      title: "Delete policy?",
      description: `The policy “${policy.title}” will be moved to Deleted Items. It can be restored later from Deleted Items.`,
    });
    if (!confirmed) return;
    try {
      await policiesApi.remove(policy.id, activeSiteId);
      setPolicies((current) => current.filter((item) => item.id !== policy.id));
      if (editingId === policy.id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5"><div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Managing website</p><p className="mt-1 font-headline-md text-lg text-on-surface">{activeSite?.name || "Select a website"}</p><p className="text-xs text-on-surface-variant">Policies created, edited or deleted here belong only to this website.</p></div><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
      <form onSubmit={savePolicy} className="rounded-xl border border-outline-variant/25 bg-surface p-5 shadow-sm md:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-label-md text-xs font-bold uppercase tracking-widest text-secondary">{editingId ? "Editing" : "New policy"}</p>
            <h2 className="mt-1 font-headline-lg text-2xl text-primary">{editingId ? "Update policy" : "Create a policy"}</h2>
          </div>
          {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-outline-variant/40 px-4 py-2 text-sm text-primary">Cancel editing</button>}
        </div>

        {error && <p className="mb-5 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2 font-label-md text-sm text-on-surface">Title
            <input name="title" value={form.title} onChange={updateField} required maxLength={200} className="mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body-md outline-none focus:border-primary" placeholder="Example: National Education Policy explained" />
          </label>
          <label className="font-label-md text-sm text-on-surface">Policy area
            <input name="policyType" value={form.policyType} onChange={updateField} required maxLength={100} className="mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body-md outline-none focus:border-primary" placeholder="Education, Economy, Health..." />
          </label>
          <label className="font-label-md text-sm text-on-surface">Status
            <select name="status" value={form.status} onChange={updateField} className="mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body-md outline-none focus:border-primary">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </label>
          <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
            <input name="showOnRegistration" type="checkbox" checked={form.showOnRegistration} onChange={updateField} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>
              <span className="block font-label-md text-sm text-on-surface">Show on registration</span>
              <span className="mt-1 block font-body-md text-xs leading-relaxed text-on-surface-variant">When this policy is published, add it beside the registration consent checkbox. Use this for Terms &amp; Conditions, Privacy Policy, and similar legal policies.</span>
            </span>
          </label>
          <label className="sm:col-span-2 font-label-md text-sm text-on-surface">Summary
            <textarea name="summary" value={form.summary} onChange={updateField} required maxLength={600} rows={4} className="mt-2 w-full resize-y rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body-md outline-none focus:border-primary" placeholder="A short public summary of this policy." />
            <span className="mt-1 block text-right text-xs text-on-surface-variant">{form.summary.length}/600</span>
          </label>
          <div className="sm:col-span-2"><p className="mb-2 font-label-md text-sm text-on-surface">Full policy content <span className="text-error">*</span></p><RichTextEditor value={form.content} onChange={(content) => setForm((current) => ({ ...current, content }))} placeholder="Write the complete policy analysis…" minHeight="24rem" disabled={saving} /></div>
        </div>

        <button type="submit" disabled={saving} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary disabled:opacity-50">
          <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`} aria-hidden="true" />
          {saving ? "Saving..." : editingId ? "Update policy" : "Create policy"}
        </button>
      </form>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline-lg text-2xl text-primary">All policies</h2>
            <p className="font-body-md text-sm text-on-surface-variant">{policies.length} total</p>
          </div>
          <a href={activeSite?.domain ? `https://${activeSite.domain}/policies` : "/policies"} className="font-label-md text-sm font-semibold text-primary hover:underline">View public page</a>
        </div>

        {loading ? (
          <p className="rounded-xl bg-surface p-6 text-on-surface-variant">Loading policies...</p>
        ) : policies.length === 0 ? (
          <EmptyState icon="fa-scale-balanced" title="No policies for this website" description="Use the policy form to create the first policy. It will remain separate from other websites." />
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <article key={policy.id} className="rounded-xl border border-outline-variant/25 bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${policy.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{policy.status}</span>
                  <span className="text-xs text-on-surface-variant">{policy.policy_type}</span>
                  {Boolean(policy.show_on_registration) && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">Registration</span>}
                </div>
                <h3 className="mt-3 font-headline-md text-lg text-on-surface">{policy.title}</h3>
                <p className="mt-2 line-clamp-2 font-body-md text-sm text-on-surface-variant">{policy.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => editPolicy(policy)} className="rounded-lg border border-primary/30 px-3 py-2 font-label-md text-xs text-primary hover:bg-primary/5"><i className="fa-solid fa-pen mr-1" /> Edit</button>
                  {policy.status === "PUBLISHED" && <Link href={`/policies/${policy.slug}`} className="rounded-lg border border-outline-variant/40 px-3 py-2 font-label-md text-xs text-on-surface hover:border-primary"><i className="fa-solid fa-arrow-up-right-from-square mr-1" /> View</Link>}
                  <button type="button" onClick={() => deletePolicy(policy)} className="rounded-lg border border-error/30 px-3 py-2 font-label-md text-xs text-error hover:bg-error/5"><i className="fa-solid fa-trash mr-1" /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div></div>
  );
}
