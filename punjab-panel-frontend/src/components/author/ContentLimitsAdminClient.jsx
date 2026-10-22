"use client";

import { useEffect, useState } from "react";
import { contentLimitsApi } from "@/lib/api";
import { useAdminSite } from "@/context/AdminSiteContext";

const ROLES = [
  { key: "AUTHOR", label: "Authors", description: "Limits applied to accounts with the Author role." },
  { key: "EDITOR", label: "Editors", description: "Separate limits for content created by Editors." },
];

const CONTENT_TYPES = [
  { key: "ARTICLE", label: "Articles", icon: "fa-newspaper" },
  { key: "BLOG", label: "Blogs", icon: "fa-pen-nib" },
  { key: "VIDEO", label: "Videos", icon: "fa-video" },
];

function asFormValues(limits) {
  return Object.fromEntries(ROLES.map(({ key: role }) => [
    role,
    Object.fromEntries(CONTENT_TYPES.map(({ key: type }) => [type, String(limits?.[role]?.[type] ?? "")])),
  ]));
}

export default function ContentLimitsAdminClient() {
  const { activeSite, activeSiteId, features } = useAdminSite();
  const [values, setValues] = useState(() => asFormValues());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    contentLimitsApi.get()
      .then((data) => setValues(asFormValues(data.limits)))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [activeSiteId]);

  const updateValue = (role, type, value) => {
    setValues((current) => ({
      ...current,
      [role]: { ...current[role], [type]: value },
    }));
    setError("");
    setNotice("");
  };

  const save = async (event) => {
    event.preventDefault();
    const limits = Object.fromEntries(ROLES.map(({ key: role }) => [
      role,
      Object.fromEntries(CONTENT_TYPES.map(({ key: type }) => [type, Number(values[role][type])])),
    ]));
    const invalid = Object.values(limits).some((roleLimits) => Object.values(roleLimits)
      .some((value) => !Number.isInteger(value) || value < 1 || value > 1000));
    if (invalid) {
      setError("Every daily limit must be a whole number between 1 and 1000.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await contentLimitsApi.update(limits);
      setValues(asFormValues(data.limits));
      setNotice("Daily posting limits were updated successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" aria-label="Loading posting limits" />;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-lg border border-secondary/25 bg-secondary-fixed/45 px-4 py-3 font-body-md text-xs text-on-secondary-fixed">
        <i className="fa-solid fa-circle-info mr-2" aria-hidden="true" />These limits apply only to <strong>{activeSite?.name || "the active website"}</strong>. Limits count content created from 12:00 AM to 11:59 PM each day. Administrators are not limited.
      </div>

      {ROLES.map((role) => (
        <section key={role.key} className="rounded-xl border border-outline-variant/30 bg-surface p-5 shadow-sm" aria-labelledby={`${role.key.toLowerCase()}-limits`}>
          <h2 id={`${role.key.toLowerCase()}-limits`} className="font-display-lg text-2xl text-primary">{role.label}</h2>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">{role.description}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {CONTENT_TYPES.filter((type) => type.key !== "VIDEO" || features.feature_videos !== false).map((type) => (
              <label key={type.key} className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                <span className="flex items-center gap-2 font-label-md text-sm font-semibold text-on-surface">
                  <i className={`fa-solid ${type.icon} text-primary`} aria-hidden="true" /> {type.label} per day
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  required
                  value={values[role.key][type.key]}
                  onChange={(event) => updateValue(role.key, type.key, event.target.value)}
                  className="mt-3 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 font-label-md text-base text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {error && <p className="font-body-md text-sm text-error" role="alert">{error}</p>}
          {!error && notice && <p className="font-body-md text-sm font-semibold text-green-700" role="status">{notice}</p>}
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 font-label-md text-sm font-semibold text-on-primary hover:bg-primary-container disabled:cursor-wait disabled:opacity-60">
          {saving ? "Saving..." : "Save posting limits"}
        </button>
      </div>
    </form>
  );
}

