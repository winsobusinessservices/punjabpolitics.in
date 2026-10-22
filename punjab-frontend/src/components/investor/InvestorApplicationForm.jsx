"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { applicationsApi } from "@/lib/api";
import ManagedText from "@/components/common/ManagedText";
import { useAuth } from "@/context/AuthContext";
import { PANEL_SITE_URL } from "@/lib/env";

const fieldClass =
  "mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/15";

const defaults = {
  formEyebrow: "Investor application",
  formTitle: "Start an investment conversation",
  formDescription: "Share your profile and investment interest. Our administration team will review your application and contact you.",
  applicantNameLabel: "Full name",
  companyLabel: "Company or organisation",
  locationLabel: "Location",
  emailLabel: "Email address",
  phoneLabel: "Phone number",
  investmentRangeLabel: "Investment interest",
  passwordLabel: "Create account password",
  documentLabel: "Investor profile or pitch document",
  messageLabel: "Tell us about your interest",
  submitLabel: "Submit investor application",
  successMessage: "Your investor application has been submitted for admin review.",
};

function StatusCard({ icon, title, children, action }) {
  return <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
    </span>
    <h2 className="mt-4 font-display-lg text-2xl text-on-surface">{title}</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">{children}</p>
    {action}
  </div>;
}

export default function InvestorApplicationForm({ settings = {} }) {
  const { user, loading } = useAuth();
  const copy = { ...defaults, ...settings };
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  // Latest investor application for this account: null (none), or { status: PENDING | APPROVED | REJECTED }.
  const [application, setApplication] = useState(undefined);
  const userId = user?.id;
  const checkApplication = Boolean(userId) && user?.role !== "INVESTOR";

  useEffect(() => {
    if (!checkApplication) return undefined;
    let active = true;
    applicationsApi.myStatus("INVESTOR")
      .then((data) => { if (active) setApplication(data.application || null); })
      .catch(() => { if (active) setApplication(null); });
    return () => { active = false; };
  }, [checkApplication, userId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    const form = event.currentTarget;
    const formData = new FormData(form);
    const company = String(formData.get("company") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const investmentRange = String(formData.get("investmentRange") || "").trim();
    const message = String(formData.get("message") || "").trim();
    formData.delete("company");
    formData.delete("investmentRange");
    formData.set("location", location);
    formData.set("role", "INVESTOR");
    formData.set(
      "message",
      [
        company && `Company / organisation: ${company}`,
        investmentRange && `Investment interest: ${investmentRange}`,
        message && `Applicant message:\n${message}`,
      ].filter(Boolean).join("\n\n"),
    );

    try {
      await applicationsApi.submit(formData);
      setStatus({ type: "success", message: copy.successMessage });
      form.reset();
      setApplication({ status: "PENDING" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (checkApplication && application === undefined)) return <div className="min-h-80 animate-pulse rounded-2xl bg-surface-container-low" aria-hidden="true" />;

  if (!user) return <div className="rounded-2xl border border-outline-variant/25 bg-surface p-8 text-center">
    <i className="fa-solid fa-lock text-2xl text-primary" aria-hidden="true" />
    <h2 className="mt-4 font-display-lg text-2xl text-on-surface">Sign in to apply as an investor</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">Your application will be linked to your registered account. You will not need to enter your password again.</p>
    <Link href="/login?next=%2Finvestors" className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary">Sign in</Link>
  </div>;

  if (user.role === "INVESTOR") return <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
      <i className="fa-solid fa-circle-check" aria-hidden="true" />
    </span>
    <h2 className="mt-4 font-display-lg text-2xl text-on-surface">You already have investor access</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">This account is registered as an investor, so another investor application is not required.</p>
    <a href={`${PANEL_SITE_URL}/author/dashboard`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary">
      Open investor dashboard <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
    </a>
  </div>;

  if (application?.status === "APPROVED") return <StatusCard icon="fa-circle-check" title="Your investor application was approved">
    Another investor application is not needed. If you asked for a separate investor account, check that email for the link to set its password.
  </StatusCard>;

  if (application?.status === "PENDING") return <StatusCard icon="fa-hourglass-half" title="Your investor application is under review">
    {status.type === "success" ? `${copy.successMessage} ` : ""}Our administration team will contact you once it has been reviewed. You can apply again only if this application is not approved.
  </StatusCard>;

  return (
    <form onSubmit={handleSubmit} inert={submitting} aria-busy={submitting} className="rounded-2xl border border-outline-variant/25 bg-surface p-6 shadow-sm md:p-8">
      <div className="mb-7">
        {copy.formEyebrow && <span className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">{copy.formEyebrow}</span>}
        <h2 className="mt-2 font-display-lg text-3xl text-on-surface">{copy.formTitle}</h2>
        {copy.formDescription && <ManagedText text={copy.formDescription} className="mt-3 space-y-3 text-sm leading-relaxed text-on-surface-variant" />}
      </div>

      {application?.status === "REJECTED" && (
        <div className="mb-4 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-on-surface-variant" role="status">
          <i className="fa-solid fa-circle-info mr-2 text-secondary" aria-hidden="true" />
          Your previous investor application was not approved. You can update your details and apply again.
        </div>
      )}

      <div className="mb-6 rounded-lg bg-primary/5 px-4 py-3 text-sm text-on-surface-variant">
        Applying as <strong className="text-on-surface">{user.name}</strong> ({user.email}). Approval will upgrade this account unless you provide a different account email below.
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-label-md text-sm text-on-surface">
          Different investor account email <span className="text-xs font-normal text-on-surface-variant">(optional)</span>
          <input name="alternateEmail" type="email" autoComplete="email" maxLength={254} className={fieldClass} placeholder="Leave blank to upgrade your current account" />
          <span className="mt-1.5 block text-xs leading-5 text-on-surface-variant">If approved, this email receives a secure password-setup link.</span>
        </label>
        <label className="font-label-md text-sm text-on-surface">
          {copy.companyLabel}
          <input name="company" type="text" autoComplete="organization" maxLength={150} className={fieldClass} placeholder="Company name" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          {copy.phoneLabel}
          <input name="phone" type="tel" autoComplete="tel" maxLength={30} className={fieldClass} placeholder="+91 98765 43210" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          {copy.locationLabel} <span className="text-error">*</span>
          <input name="location" type="text" required autoComplete="address-level2" maxLength={255} className={fieldClass} placeholder="City, state, country" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          PAN number <span className="text-error">*</span>
          <input name="panNumber" type="text" required maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" className={`${fieldClass} uppercase`} placeholder="ABCDE1234F" title="Enter a valid 10-character PAN" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          Aadhaar number <span className="text-error">*</span>
          <input name="aadharNumber" type="text" required inputMode="numeric" maxLength={12} pattern="[0-9]{12}" className={fieldClass} placeholder="12-digit Aadhaar number" title="Enter a valid 12-digit Aadhaar number" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          {copy.investmentRangeLabel} <span className="text-error">*</span>
          <select name="investmentRange" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Select a range</option>
            <option value="Under ₹5 lakh">Under ₹5 lakh</option>
            <option value="₹5 lakh – ₹25 lakh">₹5 lakh – ₹25 lakh</option>
            <option value="₹25 lakh – ₹1 crore">₹25 lakh – ₹1 crore</option>
            <option value="Above ₹1 crore">Above ₹1 crore</option>
            <option value="Strategic partnership">Strategic partnership</option>
          </select>
        </label>
      </div>

      <label className="mt-5 block font-label-md text-sm text-on-surface">
        {copy.documentLabel} <span className="text-error">*</span>
        <input name="resume" type="file" required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" className={`${fieldClass} file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary`} />
        <span className="mt-1.5 block text-xs text-on-surface-variant">PDF, Word or image, up to 20 MB.</span>
      </label>

      <label className="mt-5 block font-label-md text-sm text-on-surface">
        {copy.messageLabel} <span className="text-error">*</span>
        <textarea name="message" required maxLength={5000} rows={6} className={`${fieldClass} resize-y`} placeholder="Introduce yourself, your investment goals and relevant experience." />
      </label>

      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-on-surface-variant">
        <input type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-primary" />
        <span>I consent to Punjab Politics reviewing these details and upgrading my current account, or creating the separate account I requested, if the application is approved.</span>
      </label>

      {status.message && (
        <p role="status" className={`mt-5 rounded-lg px-4 py-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-error"}`}>
          {status.message}
        </p>
      )}

      <button type="submit" disabled={submitting} className="mt-6 inline-flex min-w-52 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
        <i className={`fa-solid ${submitting ? "fa-spinner fa-spin" : "fa-paper-plane"}`} aria-hidden="true" />
        {submitting ? "Submitting…" : copy.submitLabel}
      </button>
    </form>
  );
}
