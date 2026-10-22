"use client";

import { useEffect, useMemo, useState } from "react";
import { preferencesApi } from "@/lib/api";
import { friendlyPushError, subscribeThisBrowser, unsubscribeThisBrowser } from "@/lib/webPush";

const EMPTY = {
  topics: [],
  regions: [],
  parties: [],
  contentTypes: [],
  channels: [],
  frequency: "weekly",
  feedback: "",
  notifyConsent: false,
  email: "",
  phone: "",
  website: "", // honeypot: hidden from people, bots fill it in
};

function ChipGroup({ options, value, onChange, label }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.key)}
            className={`rounded-full border px-4 py-2 font-label-md text-xs font-semibold transition-colors ${
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/50 bg-surface text-on-surface hover:border-primary hover:text-primary"
            }`}
          >
            {selected && <i className="fa-solid fa-check mr-1.5 text-[10px]" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Question({ number, title, hint, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-headline-md text-base text-on-surface">
        <span className="mr-2 text-primary">{number}.</span>
        {title}
      </legend>
      {hint && <p className="font-body-md text-xs text-on-surface-variant">{hint}</p>}
      {children}
    </fieldset>
  );
}

/**
 * The "My interests" survey: what the reader likes to follow and how they want
 * to hear from us. Used on the /my-interests page and in the first-visit popup.
 */
export default function InterestsForm({ onSaved, onSkip, skipLabel = "Maybe later" }) {
  const [options, setOptions] = useState(null);
  const [signedIn, setSignedIn] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [partySearch, setPartySearch] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushNote, setPushNote] = useState("");

  useEffect(() => {
    let active = true;
    preferencesApi
      .getMine()
      .then((data) => {
        if (!active) return;
        setOptions(data.options);
        setSignedIn(Boolean(data.signedIn));
        const mine = data.preferences;
        if (mine) {
          setForm({
            topics: mine.topics || [],
            regions: mine.regions || [],
            parties: mine.parties || [],
            contentTypes: mine.content_types || [],
            channels: mine.channels || [],
            frequency: mine.frequency || "weekly",
            feedback: mine.feedback || "",
            notifyConsent: Boolean(mine.notify_consent),
            email: mine.email || "",
            phone: mine.phone || "",
            website: "",
          });
        }
      })
      .catch((err) => { if (active) setLoadError(err?.message || "The survey could not be loaded."); });
    return () => { active = false; };
  }, []);

  const set = (key) => (value) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })); };

  const visibleParties = useMemo(() => {
    const query = partySearch.trim().toLowerCase();
    const all = options?.parties || [];
    // Chosen parties stay visible while searching.
    return all.filter((party) => !query || party.label.toLowerCase().includes(query) || form.parties.includes(party.key));
  }, [options, partySearch, form.parties]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setPushNote("");
    setSaving(true);
    try {
      await preferencesApi.save(form);
      setSaved(true);
      // They asked for browser notifications: let the browser ask permission now (a refusal or an error here
      // must never make the saved survey look failed).
      if (form.channels.includes("browser") && form.notifyConsent) {
        subscribeThisBrowser({ prompt: true })
          .then((result) => {
            // A browser never asks again once notifications were blocked, so say how to unblock them.
            if (result === "denied") setPushNote("Your browser has blocked notifications for this website, so it cannot ask again. Click the lock icon next to the address bar, set Notifications to Allow, then save again.");
            else if (result === "default") setPushNote("Notifications were not allowed yet. Save again and choose Allow when your browser asks.");
          })
          .catch((pushError) => setPushNote(friendlyPushError(pushError)));
      }
      // No longer wants browser notifications: stop them in this browser too.
      if (!form.channels.includes("browser") || !form.notifyConsent) unsubscribeThisBrowser();
      onSaved?.();
    } catch (err) {
      setError(err?.message || "Your interests could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error" role="alert">{loadError}</p>;
  if (!options) return <p className="font-body-md text-sm text-on-surface-variant">Loading the survey...</p>;

  return (
    <form onSubmit={submit} aria-busy={saving} className="space-y-8">
      <Question number={1} title="What topics interest you?" hint="Choose as many as you like.">
        <ChipGroup label="Topics" options={options.topics} value={form.topics} onChange={set("topics")} />
      </Question>

      <Question number={2} title="Which part of India do you follow?">
        <ChipGroup label="Regions" options={options.regions} value={form.regions} onChange={set("regions")} />
      </Question>

      <Question number={3} title="Which parties do you follow?" hint={form.parties.length ? `${form.parties.length} selected` : "Search and pick any parties."}>
        <input
          type="search"
          value={partySearch}
          onChange={(event) => setPartySearch(event.target.value)}
          placeholder="Search parties, e.g. BJP, Congress..."
          aria-label="Search parties"
          className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none"
        />
        <div className="max-h-44 overflow-y-auto rounded-lg border border-outline-variant/20 p-3">
          {visibleParties.length
            ? <ChipGroup label="Parties" options={visibleParties} value={form.parties} onChange={set("parties")} />
            : <p className="text-xs text-on-surface-variant">No party matches your search.</p>}
        </div>
      </Question>

      <Question number={4} title="What do you like to read or watch?">
        <ChipGroup label="Content types" options={options.contentTypes} value={form.contentTypes} onChange={set("contentTypes")} />
      </Question>

      <Question number={5} title="How should we keep you updated?" hint="Optional. Leave all unticked if you do not want notifications.">
        <ChipGroup label="Notification channels" options={options.channels} value={form.channels} onChange={set("channels")} />
        <div role="radiogroup" aria-label="How often" className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
          {options.frequencies.map((option) => (
            <label key={option.key} className="flex cursor-pointer items-center gap-2 font-body-md text-sm text-on-surface">
              <input
                type="radio"
                name="frequency"
                value={option.key}
                checked={form.frequency === option.key}
                onChange={() => set("frequency")(option.key)}
                className="h-4 w-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
        {/* Visitors without an account need to tell us where to reach them. */}
        {!signedIn && form.channels.includes("email") && (
          <label className="block font-label-md text-xs text-on-surface-variant">
            Your email address <span className="text-error">*</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => set("email")(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none"
            />
          </label>
        )}
        {!signedIn && form.channels.includes("whatsapp") && (
          <label className="block font-label-md text-xs text-on-surface-variant">
            Your WhatsApp number <span className="text-error">*</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => set("phone")(event.target.value)}
              autoComplete="tel"
              placeholder="+91 98765 43210"
              className="mt-1.5 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none"
            />
          </label>
        )}
        {form.channels.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-primary/5 p-3 font-body-md text-xs text-on-surface">
            <input
              type="checkbox"
              checked={form.notifyConsent}
              onChange={(event) => set("notifyConsent")(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span>I agree to receive notifications about these interests on the channels I chose. I can change this or stop at any time from My interests.</span>
          </label>
        )}
      </Question>

      <Question number={6} title="What would you like to see on the website?" hint="Optional. Your thoughts help us improve.">
        <textarea
          value={form.feedback}
          onChange={(event) => set("feedback")(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Tell us in your own words..."
          className="w-full resize-none rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none"
        />
      </Question>

      {/* Honeypot: invisible to people (and to screen readers); only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set("website")(event.target.value)} />
        </label>
      </div>

      {error && <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}
      {saved && <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary" role="status">Thank you! Your interests were saved.</p>}
      {saved && pushNote && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">{pushNote}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg border-2 border-outline-variant/60 bg-surface px-6 py-3 font-label-md text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
          >
            {skipLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border-2 border-primary bg-primary px-8 py-3 font-label-md text-xs font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save my interests"}
        </button>
      </div>
    </form>
  );
}
