"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supportApi } from "@/lib/api";

const MAX_CHECKS = 10; // the gateway may take a few seconds to confirm
const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString("en-IN")}`;

/** Shows the result of a donation. Keeps checking briefly in case the payment is still being confirmed. */
export default function ThankYouContent({ publicId }) {
  const [donation, setDonation] = useState(null);
  const [state, setState] = useState(publicId ? "loading" : "missing");

  useEffect(() => {
    if (!publicId) return undefined;
    let cancelled = false;
    let timer;
    let checks = 0;

    const check = async () => {
      checks += 1;
      try {
        const data = await supportApi.status(publicId);
        if (cancelled) return;
        setDonation(data.donation);
        if (data.donation.status === "PAID") return setState("paid");
        if (data.donation.status === "FAILED" || data.donation.status === "CANCELLED") return setState("failed");
      } catch (error) {
        if (cancelled) return;
        if (error.status === 404) return setState("missing");
      }
      if (checks >= MAX_CHECKS) return setState("pending");
      timer = setTimeout(check, 2500);
    };
    check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [publicId]);

  const card = "mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm";

  if (state === "loading") return <div className={card}><p className="font-body-md text-sm text-on-surface-variant">Checking your payment…</p></div>;

  if (state === "paid") {
    return (
      <div className={card}>
        <i className="fa-solid fa-circle-check text-4xl text-secondary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-2xl text-primary">Thank you, {donation.firstName}!</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Your {donation.kind === "MONTHLY" ? "monthly " : ""}contribution of <strong className="text-on-surface">{rupees(donation.amountPaise)}</strong> has been received. A receipt has been emailed to you.
        </p>
        {donation.receiptNumber && <p className="mt-3 font-label-md text-xs text-on-surface-variant">Receipt number: {donation.receiptNumber}</p>}
        <Link href="/" className="mt-6 inline-block font-label-md text-sm font-semibold text-primary hover:underline">Back to the home page</Link>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className={card}>
        <h2 className="font-headline-md text-2xl text-primary">The payment did not go through</h2>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">You have not been charged. You are welcome to try again.</p>
        <Link href="/support" className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-label-md text-sm font-semibold text-on-primary">Try again</Link>
      </div>
    );
  }

  if (state === "pending" && donation?.kind === "MONTHLY") {
    return (
      <div className={card}>
        <i className="fa-solid fa-hourglass-half text-4xl text-secondary" aria-hidden="true" />
        <h2 className="mt-4 font-headline-md text-2xl text-primary">Your monthly contribution is set up</h2>
        <p className="mt-2 font-body-md text-sm leading-relaxed text-on-surface-variant">
          Thank you{donation.firstName ? `, ${donation.firstName}` : ""}. Your bank is still processing the first payment of {rupees(donation.amountPaise)}.
          We will email your receipt as soon as it goes through. Nothing is counted as paid until then.
        </p>
        <p className="mt-3 font-body-md text-xs text-on-surface-variant">
          You can stop it any time from{" "}
          <Link href="/profile" className="font-semibold text-primary hover:underline">your profile</Link>.
        </p>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className={card}>
        <h2 className="font-headline-md text-2xl text-primary">We are still confirming your payment</h2>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">
          This can take a few minutes. If the money was taken, you will get a receipt by email. If you do not, please{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">contact us</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <h2 className="font-headline-md text-2xl text-primary">We could not find that contribution</h2>
      <Link href="/support" className="mt-6 inline-block font-label-md text-sm font-semibold text-primary hover:underline">Go to the support page</Link>
    </div>
  );
}
