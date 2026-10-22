"use client";

import { useEffect, useState } from "react";
import { interestPushApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface p-4">
      <p className="font-label-sm text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display-lg text-2xl text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

const hourLabel = (hour) => (hour === 0 ? "Any time of day" : `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`);

/**
 * Admin switch for the notifications that are sent automatically when something new matches what a reader follows
 * (articles, blogs, videos, upcoming elections, events, rallies, election results), at most 3 a day per reader.
 */
export default function NotificationsAdminClient() {
  const confirm = useConfirmDialog();
  const [settings, setSettings] = useState(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    interestPushApi
      .settings()
      .then((data) => !cancelled && setSettings(data.settings))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">The notification settings could not be loaded. Only an admin can see this page.</p>;
  if (!settings) return <div className="h-48 animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />;

  const change = async (enabled) => {
    if (!enabled) {
      const confirmed = await confirm({
        title: "Turn off notifications?",
        description: "Nothing will be sent to readers while this is off. New articles, videos, events and results added meanwhile will never be sent later, even after you turn it back on.",
        icon: "fa-bell-slash",
        confirmIcon: "fa-bell-slash",
        confirmLabel: "Turn off",
      });
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const data = await interestPushApi.setEnabled(enabled);
      setSettings(data.settings);
    } catch {
      // the request helper already showed the reason
    } finally {
      setSaving(false);
    }
  };

  const on = settings.enabled;

  const changeHour = async (event) => {
    const hour = Number(event.target.value);
    setSaving(true);
    try {
      const data = await interestPushApi.setSendFromHour(hour);
      setSettings(data.settings);
    } catch {
      // the request helper already showed the reason
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${on ? "border-primary/25 bg-surface" : "border-amber-400/60 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary/10 text-primary" : "bg-amber-200 text-amber-800"}`}>
            <i className={`fa-solid ${on ? "fa-bell" : "fa-bell-slash"}`} aria-hidden="true" />
          </span>
          <div>
            <p className="font-headline-md text-base text-on-surface">
              Interest notifications
              <span className={`ml-2 rounded-full px-2.5 py-0.5 align-middle text-xs font-semibold ${on ? "bg-green-100 text-green-800" : "bg-amber-200 text-amber-900"}`}>{on ? "On" : "Off"}</span>
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {on
                ? "New items that match what a reader follows are sent automatically, checked every 5 minutes."
                : "Nothing is being sent. Items added while this is off will not be sent later."}
            </p>
            {!settings.configured && <p className="mt-1 text-sm font-semibold text-error">Browser notifications are not set up on the server yet (the VAPID keys are missing), so nothing can be sent either way.</p>}
            {settings.updatedAt && (
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Last changed {new Date(settings.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {settings.updatedByName ? ` by ${settings.updatedByName}` : ""}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => change(!on)}
          disabled={saving}
          className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-60 ${on ? "border border-outline-variant/60 text-primary hover:border-primary" : "bg-primary text-on-primary hover:opacity-90"}`}
        >
          <i className={`fa-solid ${on ? "fa-pause" : "fa-play"} mr-2`} aria-hidden="true" />
          {saving ? "Saving..." : on ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-headline-md text-base text-on-surface"><i className="fa-regular fa-clock mr-2 text-primary" aria-hidden="true" />Send notifications from</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            India time. Anything that appears before this time is held and sent when it comes, not lost. Each reader still gets at most {settings.dailyLimit} a day.
          </p>
        </div>
        <label className="flex-none">
          <span className="sr-only">Send notifications from</span>
          <select
            value={settings.sendFromHour}
            onChange={changeHour}
            disabled={saving}
            className="min-h-11 rounded-lg border border-outline-variant/50 bg-surface px-4 py-2.5 font-label-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>{hourLabel(hour)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Browsers subscribed" value={settings.activeBrowsers} hint="Readers who allowed notifications" />
        <Stat label="Will get interest updates" value={settings.eligibleBrowsers} hint="Also chose Browser notification in My Interests and agreed" />
        <Stat label="Sent today" value={settings.sentToday} hint={`To ${settings.peopleToday} reader${settings.peopleToday === 1 ? "" : "s"} (India time)`} />
      </div>

      <section className="rounded-xl border border-outline-variant/30 bg-surface p-5">
        <h2 className="font-headline-md text-base text-primary">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
          <li><strong className="text-on-surface">What is sent:</strong> a newly published article, blog or video, and newly added upcoming elections, events, rallies and election results.</li>
          <li><strong className="text-on-surface">Who gets it:</strong> only readers whose My Interests answers match (topics, regions, parties, content types) and who chose Browser notification.</li>
          <li><strong className="text-on-surface">Limits:</strong> at most {settings.dailyLimit} a day per reader, never the same item twice. Readers who chose Weekly get at most {settings.dailyLimit} a week; readers who chose Only breaking updates get only breaking items.</li>
          <li><strong className="text-on-surface">Matching depends on tags:</strong> an article reaches Lok Sabha followers when its category or tags mention Lok Sabha.</li>
        </ul>
      </section>
    </div>
  );
}
