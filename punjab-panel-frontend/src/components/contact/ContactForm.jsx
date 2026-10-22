"use client";

import { useTurnstile } from "@/hooks/useTurnstile";
import { useState } from "react";
import { contactApi } from "@/lib/api";

const fieldClass =
  "w-full rounded-lg border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const turnstile = useTurnstile({ action: "contact" });
  const [status, setStatus] = useState({ type: "", message: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.turnstileToken = turnstile.token;

    try {
      const data = await contactApi.submit(payload);
      setStatus({ type: "success", message: data.message });
      form.reset();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
      turnstile.reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} inert={submitting} aria-busy={submitting} className="rounded-xl border border-outline-variant/25 bg-surface p-6 shadow-sm md:p-8">
      <div className="mb-7">
        <span className="font-label-sm text-xs font-bold uppercase tracking-[0.18em] text-secondary">Send a message</span>
        <h2 className="mt-2 font-display-lg text-3xl text-on-surface">Get in Touch</h2>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">
          Have a story tip, correction, partnership proposal, or general question? We would be glad to hear from you.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-label-md text-sm text-on-surface">
          Full name <span className="text-error">*</span>
          <input name="name" type="text" autoComplete="name" required maxLength={100} className={`${fieldClass} mt-2`} placeholder="Your name" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          Email address <span className="text-error">*</span>
          <input name="email" type="email" autoComplete="email" required maxLength={254} className={`${fieldClass} mt-2`} placeholder="you@example.com" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          Phone number
          <input name="phone" type="tel" autoComplete="tel" maxLength={30} className={`${fieldClass} mt-2`} placeholder="+91 98765 43210" />
        </label>
        <label className="font-label-md text-sm text-on-surface">
          Subject <span className="text-error">*</span>
          <input name="subject" type="text" required maxLength={150} className={`${fieldClass} mt-2`} placeholder="How can we help?" />
        </label>
      </div>

      <label className="mt-5 block font-label-md text-sm text-on-surface">
        Message <span className="text-error">*</span>
        <textarea name="message" required maxLength={5000} rows={7} className={`${fieldClass} mt-2 resize-y`} placeholder="Write your message here..." />
      </label>

      {status.message && (
        <p role="status" className={`mt-5 rounded-lg px-4 py-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-error"}`}>
          {status.message}
        </p>
      )}

      {turnstile.widget}
      <button type="submit" disabled={submitting || !turnstile.ready} className="mt-6 inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
        <i className={`fa-solid ${submitting ? "fa-spinner fa-spin" : "fa-paper-plane"}`} />
        {submitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
