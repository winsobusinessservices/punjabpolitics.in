"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscriptionApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePremium } from "@/lib/usePremium";
import AuthReturnLink from "@/components/auth/AuthReturnLink";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// name and email stay null until the buyer edits them, so the signed-in account fills them in.
const EMPTY = { name: null, email: null, phone: "", consent: false, website: "" };

const inputClass =
  "w-full rounded-lg border border-outline-variant/50 bg-surface px-3 py-2.5 font-body-md text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const rupees = (value) => `₹${Number(value).toLocaleString("en-IN")}`;
const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("The payment window could not be loaded. Please check your connection and try again."));
    document.body.appendChild(script);
  });
}

const Shell = ({ children }) => (
  <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm">{children}</div>
);

/**
 * The Premium form: one month, paid once. It asks the server to start the purchase, then opens the payment
 * window. The month only starts after the server has verified the payment, so nothing here is proof of payment.
 */
export default function SubscriptionForm({ initialPlanId }) {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { isPremium, endsAt } = usePremium();
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [planId, setPlanId] = useState(null); // the card the reader picked (until then: the one the page linked to, the recommended one, or the first)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // test mode: a started purchase waiting for "Simulate payment"
  const [done, setDone] = useState(null); // { endsAt, receiptNumber } right after paying

  useEffect(() => {
    let cancelled = false;
    subscriptionApi
      .getConfig()
      .then((data) => !cancelled && setConfig(data.config))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const paidPlans = config?.plans?.paid || [];
  const plan = paidPlans.find((item) => item.id === planId) || paidPlans.find((item) => item.id === initialPlanId) || paidPlans.find((item) => item.recommended) || paidPlans[0];
  const nameValue = form.name ?? user?.name ?? "";
  const emailValue = form.email ?? user?.email ?? "";

  const confirm = async (publicId, payment) => {
    setError("");
    try {
      const result = await subscriptionApi.confirm(publicId, payment);
      setPending(null);
      setDone({ endsAt: result.endsAt, receiptNumber: result.receiptNumber });
      await refreshUser(); // the rest of the site (ads, premium stories) now knows
    } catch (confirmError) {
      // The gateway also tells our server about the payment, so the subscription can still start by itself.
      setPending(null);
      setError(confirmError.message || "We could not confirm the payment yet. If money was taken, your Premium starts automatically within a few minutes.");
    }
    setBusy(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { subscription, checkout } = await subscriptionApi.start({ ...form, name: nameValue, email: emailValue, planId: plan.id });
      if (!checkout) return; // a bot was ignored

      if (checkout.provider === "test") {
        setPending({ publicId: subscription.publicId });
        setBusy(false);
        return;
      }

      const Razorpay = await loadRazorpay();
      const checkoutWindow = new Razorpay({
        key: checkout.publicKey,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: "Punjab Politics",
        description: `${plan.name}: ${plan.days} days`,
        order_id: checkout.orderId,
        prefill: checkout.prefill,
        theme: { color: "#7a1f2b" },
        handler: (response) => confirm(subscription.publicId, { paymentId: response.razorpay_payment_id, signature: response.razorpay_signature }),
        modal: { ondismiss: () => setBusy(false) },
      });
      checkoutWindow.on?.("payment.failed", (failure) => {
        setError(failure?.error?.description || "The payment failed. You have not been charged. Please try again.");
        setBusy(false);
      });
      checkoutWindow.open();
      return; // stays busy until the payment window closes or finishes
    } catch (submitError) {
      setError(submitError.message || "Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  if (loadError) {
    return <p className="mx-auto max-w-xl rounded-xl bg-surface p-6 text-center font-body-md text-sm text-on-surface-variant">Premium is not available right now. Please try again in a little while.</p>;
  }
  if (!config || authLoading) {
    return <div className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-surface-container" aria-hidden="true" />;
  }

  if (done) {
    return (
      <Shell>
        <i className="fa-solid fa-crown text-3xl text-secondary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-xl text-primary">Welcome to Premium!</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Your payment was received. Premium is active until <strong className="text-on-surface">{dateLabel(done.endsAt)}</strong>. Ads are switched off and every premium story is open to you.
          {done.receiptNumber && <> Receipt number: {done.receiptNumber}. We also emailed it to you.</>}
        </p>
        <Link href="/premium" className="mt-5 inline-block rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
          Read premium stories
        </Link>
      </Shell>
    );
  }

  if (!config.enabled || !plan) {
    return (
      <Shell>
        <i className="fa-solid fa-crown text-3xl text-secondary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-xl text-primary">Premium opens soon</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">We are getting Premium ready. Thank you for your interest. Please check back in a little while.</p>
        <Link href="/contact" className="mt-4 inline-block font-label-md text-sm font-semibold text-primary hover:underline">
          Write to us
        </Link>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <i className="fa-solid fa-user-lock text-3xl text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-xl text-primary">Sign in to get Premium</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Please sign in or create a free account first. Premium belongs to your account, so it works on every device you sign in on.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <AuthReturnLink authPath="/login" returnTo="/subscription" className="rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
            Sign in
          </AuthReturnLink>
          <AuthReturnLink authPath="/register" returnTo="/subscription" className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">
            Create account
          </AuthReturnLink>
        </div>
      </Shell>
    );
  }

  if (pending) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border-2 border-dashed border-secondary/60 bg-surface p-8 text-center">
        <p className="font-label-sm text-xs font-bold uppercase tracking-[0.2em] text-secondary">Test mode</p>
        <h2 className="mt-2 font-headline-md text-xl text-primary">No real payment will be made</h2>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">The payment gateway is not connected yet. This button pretends the payment worked.</p>
        <button
          type="button"
          onClick={() => confirm(pending.publicId, { paymentId: `pay_test_${Date.now()}`, signature: "TEST_OK" })}
          className="mt-5 rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90"
        >
          Simulate payment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-sm md:p-8" noValidate>
      {paidPlans.length > 1 && (
        <fieldset>
          <legend className="mb-2 font-label-md text-sm font-semibold text-on-surface">Plan</legend>
          <div className="grid gap-2">
            {paidPlans.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${item.id === plan.id ? "border-primary bg-primary/5" : "border-outline-variant/50 hover:border-primary"}`}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="plan" value={item.id} checked={item.id === plan.id} onChange={() => setPlanId(item.id)} className="h-4 w-4 accent-primary" />
                  <span className="font-body-md text-sm font-semibold text-on-surface">{item.name}</span>
                </span>
                <span className="font-body-md text-sm text-on-surface-variant">
                  {rupees(item.priceRupees)} · {item.days} days
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
        <i className="fa-solid fa-crown mt-0.5 text-secondary" aria-hidden="true" />
        <div className="font-body-md text-sm text-on-surface">
          <p className="font-semibold">
            {plan.name} for {plan.days} days: {rupees(plan.priceRupees)}
          </p>
          <p className="mt-0.5 text-on-surface-variant">
            {isPremium
              ? `You are Premium until ${dateLabel(endsAt)}. Subscribing again adds ${plan.days} more days after that.`
              : "A one-time payment. It does not renew by itself, so you are never charged again unless you choose to."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-label-md text-sm font-semibold text-on-surface">Name</span>
          <input type="text" value={nameValue} onChange={update("name")} maxLength={120} autoComplete="name" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block font-label-md text-sm font-semibold text-on-surface">Email (for your receipt)</span>
          <input type="email" value={emailValue} onChange={update("email")} maxLength={254} autoComplete="email" required className={inputClass} />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block font-label-md text-sm font-semibold text-on-surface">
            Phone <span className="font-normal text-on-surface-variant">(optional)</span>
          </span>
          <input type="tel" value={form.phone} onChange={update("phone")} maxLength={20} autoComplete="tel" className={inputClass} />
        </label>
      </div>

      {/* Honeypot: invisible to people, bots fill it in. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
        </label>
      </div>

      <label className="flex items-start gap-3 font-body-md text-sm text-on-surface">
        <input type="checkbox" checked={form.consent} onChange={update("consent")} className="mt-1 h-4 w-4 accent-primary" />
        <span>
          I have read the{" "}
          <Link href="/policies/privacy-policy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          . I agree to my details being used to process this payment and to send my receipt. I can withdraw my consent any time by{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">
            contacting us
          </Link>
          .
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-error-container px-4 py-3 font-body-md text-sm text-on-error-container">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-primary px-6 py-3.5 font-label-md text-base font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Please wait…" : isPremium ? `Add ${plan.days} more days for ${rupees(plan.priceRupees)}` : `${plan.ctaLabel} for ${rupees(plan.priceRupees)}`}
      </button>
      <p className="text-center font-body-md text-xs text-on-surface-variant">Payments are processed securely by our payment partner. We never see your card details.</p>
    </form>
  );
}
