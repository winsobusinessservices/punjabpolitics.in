"use client";

import { useEffect, useRef, useState } from "react";
import { PUBLIC_SITE_URL } from "@/lib/env";

function absoluteShareUrl(url) {
  const value = String(url || "").trim();
  if (!value) return PUBLIC_SITE_URL;
  if (/^https?:\/\//i.test(value)) return value;
  return `${PUBLIC_SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

/**
 * Share a card: opens the device's native share sheet when available (phones),
 * otherwise a small menu with WhatsApp, X, Facebook, Telegram, Email and
 * Copy link.
 *
 * `variant="overlay"` is a round button for the corner of a card image (place
 * it inside a `relative` container, as a sibling of the card's links).
 * `variant="inline"` is a small text-sized button for metadata rows.
 */
export default function ShareButton({ url, title, variant = "overlay", className = "" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shareUrl = absoluteShareUrl(url);
  const shareText = String(title || "").trim();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const targets = [
    { label: "WhatsApp", icon: "fa-brands fa-whatsapp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`.trim())}` },
    { label: "X", icon: "fa-brands fa-x-twitter", href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { label: "Facebook", icon: "fa-brands fa-facebook-f", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: "Telegram", icon: "fa-brands fa-telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { label: "Email", icon: "fa-regular fa-envelope", href: `mailto:?subject=${encodedText}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`.trim())}` },
  ];

  const handleToggle = async (event) => {
    // The button sits next to card links - never let the click navigate.
    event.preventDefault();
    event.stopPropagation();

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareText || undefined, url: shareUrl });
      } catch {
        // User dismissed the share sheet - nothing to do.
      }
      return;
    }
    setOpen((value) => !value);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const field = document.createElement("textarea");
      field.value = shareUrl;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(field);
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1200);
  };

  const triggerClass = variant === "overlay"
    ? "flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-on-surface shadow-sm backdrop-blur transition-colors hover:bg-primary hover:text-on-primary"
    : variant === "button"
      ? "inline-flex items-center gap-2 rounded-full border border-outline-variant/50 px-4 py-2 text-xs font-label-md font-semibold uppercase tracking-wider text-on-surface transition-colors hover:border-primary hover:bg-primary hover:text-on-primary"
      : "inline-flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant transition-colors hover:text-primary";

  // The overlay wrapper is itself absolutely positioned. If it stayed in the
  // normal flow, a flex/grid card (gap-3) would count it as an empty child and
  // push the image down, leaving the icon misaligned with the card.
  return (
    <div
      ref={rootRef}
      className={`${variant === "overlay" ? "absolute right-2 top-2 z-10" : "relative inline-block"} ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-label={shareText ? `Share: ${shareText}` : "Share"}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Share"
        className={triggerClass}
      >
        <i className="fa-solid fa-share-nodes text-xs" aria-hidden="true" />
        {variant !== "overlay" && <span>Share</span>}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Share options"
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-xl"
        >
          {targets.map((target) => (
            <a
              key={target.label}
              role="menuitem"
              href={target.href}
              target={target.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container"
            >
              <i className={`${target.icon} w-4 text-center text-primary`} aria-hidden="true" />
              {target.label}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-3 border-t border-outline-variant/20 px-3 py-2 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
          >
            <i className={`fa-solid ${copied ? "fa-check" : "fa-link"} w-4 text-center text-primary`} aria-hidden="true" />
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
