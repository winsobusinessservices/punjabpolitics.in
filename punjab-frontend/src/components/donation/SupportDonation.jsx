"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthReturnLink from "@/components/auth/AuthReturnLink";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// name and email stay null until the donor edits them, so the signed-in account fills them in.
const EMPTY = { name: null, email: null, phone: "", message: "", showOnWall: false, consent: false, website: "" };

const inputClass =
  "w-full rounded-lg border border-outline-variant/50 bg-surface px-3 py-2.5 font-body-md text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const rupees = (value) => `₹${Number(value).toLocaleString("en-IN")}`;

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

/**
 * The Support (donation) form. It asks the server to start a donation, then opens
 * the payment window. The server only marks the donation as paid after the payment
 * signature is verified, so nothing here is trusted as proof of payment.
 */
export default function SupportDonation() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState("ONE_TIME");
  const [amount, setAmount] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // test mode: a started donation waiting for "Simulate payment"

  useEffect(() => {
    let cancelled = false;
    supportApi
      .getConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig(data.config);
        setAmount(String(data.config.presets?.[1] || ""));
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const goToThanks = (publicId) => router.push(`/support/thank-you?d=${encodeURIComponent(publicId)}`);

  const confirm = async (publicId, payment) => {
    try {
      await supportApi.confirm(publicId, payment);
    } catch (confirmError) {
      // The gateway also tells our server about the payment, so the thank-you page can still show it as paid.
      console.warn("Payment confirmation will be completed by the gateway:", confirmError.message);
    }
    goToThanks(publicId);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { donation, checkout } = await supportApi.start({ ...form, name: nameValue, email: emailValue, amount, kind });
      if (!checkout) return; // a bot was ignored

      if (checkout.provider === "test") {
        setPending({ publicId: donation.publicId });
        return;
      }

      const Razorpay = await loadRazorpay();
      const checkoutWindow = new Razorpay({
        key: checkout.publicKey,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: "Punjab Politics",
        description: kind === "MONTHLY" ? "Monthly support" : "Support independent journalism",
        ...(checkout.subscriptionId ? { subscription_id: checkout.subscriptionId } : { order_id: checkout.orderId }),
        prefill: checkout.prefill,
        theme: { color: "#7a1f2b" },
        handler: (response) =>
          confirm(donation.publicId, {
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
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

  const nameValue = form.name ?? user?.name ?? "";
  const emailValue = form.email ?? user?.email ?? "";

  if (loadError) {
    return <p className="mx-auto max-w-xl rounded-xl bg-surface p-6 text-center font-body-md text-sm text-on-surface-variant">Support is not available right now. Please try again in a little while.</p>;
  }
  if (!config) {
    return <div className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-surface-container" aria-hidden="true" />;
  }
  if (authLoading) {
    return <div className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-surface-container" aria-hidden="true" />;
  }
  if (!config.enabled) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm">
        <i className="fa-solid fa-hand-holding-heart text-3xl text-secondary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-xl text-primary">Contributions open soon</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          We are setting up online contributions. Thank you for wanting to help. In the meantime, sharing our stories is the best support.
        </p>
        <Link href="/contact" className="mt-4 inline-block font-label-md text-sm font-semibold text-primary hover:underline">
          Write to us
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm">
        <i className="fa-solid fa-user-lock text-3xl text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-xl text-primary">Sign in to contribute</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Please sign in or create a free account first. It lets us send your receipt and keep a record of your contribution.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <AuthReturnLink authPath="/login" returnTo="/support" className="rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary hover:opacity-90">
            Sign in
          </AuthReturnLink>
          <AuthReturnLink authPath="/register" returnTo="/support" className="rounded-lg border border-outline-variant/60 px-6 py-3 font-label-md text-sm font-semibold text-primary hover:border-primary">
            Create account
          </AuthReturnLink>
        </div>
      </div>
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
      <div role="group" aria-label="How often" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1">
        {[
          ["ONE_TIME", "One time"],
          ["MONTHLY", "Every month"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-lg py-2.5 font-label-md text-sm font-semibold transition-colors ${kind === value ? "bg-primary text-on-primary shadow" : "text-on-surface-variant hover:text-primary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 font-label-md text-sm font-semibold text-on-surface">Amount</p>
        <div className="flex flex-wrap gap-2">
          {config.presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={String(preset) === String(amount)}
              onClick={() => setAmount(String(preset))}
              className={`rounded-full border px-4 py-2 font-label-md text-sm font-semibold transition-colors ${
                String(preset) === String(amount) ? "border-primary bg-primary text-on-primary" : "border-outline-variant/50 text-on-surface hover:border-primary hover:text-primary"
              }`}
            >
              {rupees(preset)}
            </button>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Other amount in rupees</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
            placeholder={`Other amount (${rupees(config.minAmount)} to ${rupees(config.maxAmount)})`}
            className={inputClass}
          />
        </label>
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
        <label className="block md:col-span-2">
          <span className="mb-1 block font-label-md text-sm font-semibold text-on-surface">
            A message <span className="font-normal text-on-surface-variant">(optional)</span>
          </span>
          <textarea value={form.message} onChange={update("message")} maxLength={300} rows={3} className={inputClass} />
        </label>
      </div>

      {/* Honeypot: invisible to people, bots fill it in. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
        </label>
      </div>

      {/* <label className="flex items-start gap-3 font-body-md text-sm text-on-surface">
        <input type="checkbox" checked={form.showOnWall} onChange={update("showOnWall")} className="mt-1 h-4 w-4 accent-primary" />
        <span>Show my first name on the supporters wall. Amounts and emails are never shown.</span>
      </label> */}
      <label className="flex items-start gap-3 font-body-md text-sm text-on-surface">
        <input type="checkbox" checked={form.consent} onChange={update("consent")} className="mt-1 h-4 w-4 accent-primary" />
        <span>
          I have read the{" "}
          <Link href="/policies/privacy-policy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          . I understand this is a voluntary contribution, not a purchase, and that for any refund request I will{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">
            contact you
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
        {busy ? "Please wait…" : amount ? `Contribute ${rupees(amount)}${kind === "MONTHLY" ? " every month" : ""}` : "Contribute"}
      </button>
      <p className="text-center font-body-md text-xs text-on-surface-variant">
        Payments are processed securely by our payment partner. We never see your card details.
        {kind === "MONTHLY" && " You can stop a monthly contribution any time from your profile page."}
      </p>
    </form>
  );
}
