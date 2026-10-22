"use client";

import { useEffect, useState } from "react";
import { subscriptionAdminApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";

const MAX_PAID = 4;

const field = "block w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1 block font-label-md text-xs text-on-surface-variant";
const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant/40 text-on-surface-variant hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40";

// One feature per line in the box; the server turns the lines back into a list.
const toLines = (list) => (list || []).join("\n");

const cardToForm = (card) => ({ name: card.name, tagline: card.tagline, ctaLabel: card.ctaLabel, features: toLines(card.features), notIncluded: toLines(card.notIncluded) });
const toForm = (plans) => ({
  free: cardToForm(plans.free),
  paid: plans.paid.map((card) => ({ ...cardToForm(card), id: card.id, uid: card.id, priceRupees: String(card.priceRupees), days: String(card.days), recommended: Boolean(card.recommended) })),
});

function CardFields({ value, onChange, children }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Card name</span>
          <input type="text" value={value.name} onChange={set("name")} maxLength={40} className={field} />
        </label>
        <label className="block">
          <span className={label}>Button text</span>
          <input type="text" value={value.ctaLabel} onChange={set("ctaLabel")} maxLength={30} className={field} />
        </label>
      </div>
      {children}
      <label className="block">
        <span className={label}>Short description</span>
        <input type="text" value={value.tagline} onChange={set("tagline")} maxLength={200} className={field} />
      </label>
      <label className="block">
        <span className={label}>What it includes (one per line, up to 10)</span>
        <textarea value={value.features} onChange={set("features")} rows={6} className={field} />
      </label>
      <label className="block">
        <span className={label}>What it does not include (one per line, shown crossed out, optional)</span>
        <textarea value={value.notIncluded} onChange={set("notIncluded")} rows={3} className={field} />
      </label>
    </div>
  );
}

/**
 * Admin: the cards on the subscription page. The Free card is fixed; the Premium cards are the ones people can buy,
 * and an admin can add up to four (for example Monthly and Yearly), reorder them and mark one as recommended.
 * Every Premium card unlocks all premium stories; they differ in price and length.
 */
export default function SubscriptionPlansEditor() {
  const confirm = useConfirmDialog();
  const [saved, setSaved] = useState(null); // what the server has: { plans, updatedAt, updatedByName }
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    subscriptionAdminApi
      .plans()
      .then((data) => {
        if (cancelled) return;
        setSaved(data);
        setForm(toForm(data.plans));
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadFailed) return <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">The plans could not be loaded.</p>;
  if (!form) return <div className="h-48 animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />;

  // uid is only a steady React key for each card (new cards have no id yet); it is not a change.
  const comparable = (value) => JSON.stringify({ free: value.free, paid: value.paid.map(({ uid, ...card }) => card) });
  const dirty = comparable(form) !== comparable(toForm(saved.plans));
  const savedPaid = saved.plans.paid;
  const pricingChanged = form.paid.some((card) => {
    const before = savedPaid.find((item) => item.id === card.id);
    return !before || before.priceRupees !== Number(card.priceRupees) || before.days !== Number(card.days);
  });

  const setPaid = (index, card) => setForm({ ...form, paid: form.paid.map((item, i) => (i === index ? card : item)) });
  const move = (index, step) => {
    const next = [...form.paid];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setForm({ ...form, paid: next });
  };
  const addCard = () => {
    const base = form.paid[form.paid.length - 1] || {};
    setForm({
      ...form,
      paid: [...form.paid, { uid: `new-${Date.now()}-${form.paid.length}`, name: "", tagline: "", ctaLabel: "", features: base.features || "", notIncluded: "", priceRupees: "", days: "", recommended: false }],
    });
  };
  const removeCard = async (index) => {
    const card = form.paid[index];
    const confirmed = await confirm({
      title: `Remove ${card.name || "this card"}?`,
      description: "It disappears from the subscription page when you save. Members who already bought it keep their Premium until it ends.",
      icon: "fa-trash",
      confirmIcon: "fa-trash",
      confirmLabel: "Remove",
    });
    if (confirmed) setForm({ ...form, paid: form.paid.filter((_, i) => i !== index) });
  };
  const setRecommended = (index) => setForm({ ...form, paid: form.paid.map((card, i) => ({ ...card, recommended: i === index })) });

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (pricingChanged) {
      const confirmed = await confirm({
        title: "Save these prices?",
        description: "New purchases will pay the prices and lengths shown on these cards. Members who already paid keep what they bought.",
        icon: "fa-indian-rupee-sign",
        confirmIcon: "fa-check",
        confirmLabel: "Save",
        tone: "success",
      });
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const data = await subscriptionAdminApi.savePlans({
        free: form.free,
        paid: form.paid.map(({ id, uid, priceRupees, days, ...card }) => ({ ...(id ? { id } : {}), ...card, priceRupees: Number(priceRupees), days: Number(days) })),
      });
      setSaved(data);
      setForm(toForm(data.plans));
      setNotice("Saved. The subscription page now shows these cards.");
    } catch (err) {
      setError(err.message || "The plans could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <fieldset className="rounded-xl border border-outline-variant/30 bg-surface p-5">
        <legend className="flex items-center gap-2 px-2 font-headline-md text-base text-primary">
          <i className="fa-solid fa-newspaper" aria-hidden="true" /> Free card
        </legend>
        <CardFields value={form.free} onChange={(free) => setForm({ ...form, free })} />
      </fieldset>

      <div>
        <h2 className="mb-1 font-headline-md text-lg text-primary">Premium cards</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          People buy these. Every card unlocks all premium stories and removes ads; cards differ in price and length, for example Monthly and Yearly. The page shows them in this order.
        </p>

        <div className="space-y-5">
          {form.paid.map((card, index) => (
            <fieldset key={card.uid} className="rounded-xl border border-outline-variant/30 bg-surface p-5">
              <legend className="flex items-center gap-2 px-2 font-headline-md text-base text-primary">
                <i className="fa-solid fa-crown" aria-hidden="true" /> {card.name.trim() || `Card ${index + 1}`}
              </legend>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-on-surface">
                  <input type="radio" name="recommended" checked={card.recommended} onChange={() => setRecommended(index)} className="h-4 w-4 accent-primary" />
                  Recommended (highlighted on the page)
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${card.name || "card"} up`} className={iconButton}>
                    <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === form.paid.length - 1} aria-label={`Move ${card.name || "card"} down`} className={iconButton}>
                    <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeCard(index)} disabled={form.paid.length === 1} aria-label={`Remove ${card.name || "card"}`} title={form.paid.length === 1 ? "Keep at least one Premium card" : "Remove this card"} className={iconButton}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <CardFields value={card} onChange={(next) => setPaid(index, next)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={label}>Price (₹, whole rupees)</span>
                    <input type="text" inputMode="numeric" value={card.priceRupees} onChange={(event) => setPaid(index, { ...card, priceRupees: event.target.value.replace(/\D/g, "") })} className={field} />
                  </label>
                  <label className="block">
                    <span className={label}>Lasts (days)</span>
                    <input type="text" inputMode="numeric" value={card.days} onChange={(event) => setPaid(index, { ...card, days: event.target.value.replace(/\D/g, "") })} className={field} />
                  </label>
                </div>
              </CardFields>
            </fieldset>
          ))}
        </div>

        <button
          type="button"
          onClick={addCard}
          disabled={form.paid.length >= MAX_PAID}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/60 px-5 py-3 font-label-md text-sm font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          {form.paid.length >= MAX_PAID ? `You can have up to ${MAX_PAID} Premium cards` : "Add a card"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={saving || !dirty} className="rounded-lg bg-primary px-6 py-2.5 font-label-md text-sm font-semibold text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving..." : "Save changes"}
        </button>
        {dirty && !saving && (
          <button type="button" onClick={() => { setForm(toForm(saved.plans)); setError(""); setNotice(""); }} className="font-label-md text-sm font-semibold text-primary hover:underline">
            Discard changes
          </button>
        )}
        {saved.updatedAt && (
          <span className="text-xs text-on-surface-variant">
            Last saved {new Date(saved.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {saved.updatedByName ? ` by ${saved.updatedByName}` : ""}
          </span>
        )}
      </div>
    </form>
  );
}
