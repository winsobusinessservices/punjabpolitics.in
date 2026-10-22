"use client";

import { useState } from "react";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/api";

const GRADIENTS = {
  primary: "from-primary to-primary-container",
  secondary: "from-secondary to-secondary-container",
  inverse: "from-inverse-surface to-tertiary-container",
  tint: "from-surface-tint to-primary",
};

export default function ImagePlaceholder({
  icon = "fa-solid fa-image",
  gradient = "primary",
  className = "",
  iconClassName = "text-2xl",
  image = "",
  fallbackImage = "",
  alt = "",
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}) {
  const [loaded, setLoaded] = useState(false);
  // Uploads-folder fallback (e.g. a seeded photo) used only if the primary
  // URL is missing or fails to load, so a broken/absent photo_url still
  // shows a real image instead of dropping straight to the icon.
  const [useFallback, setUseFallback] = useState(false);

  const src = (!useFallback && image) || (useFallback && fallbackImage) || image || fallbackImage;

  if (src) {
    return (
      <div className={`relative z-0 overflow-hidden bg-gradient-to-br ${GRADIENTS[gradient] || GRADIENTS.primary} ${className}`} style={{ zIndex: 0 }}>
        {/* Shown until the real photo finishes loading, then fades out —
            real images can take a moment over the network, so this covers
            that gap instead of leaving a blank/broken-looking box. */}
        {!loaded && <span className="shimmer-sweep" aria-hidden="true" />}
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized={!isOptimizableImageHost(src)}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!useFallback && fallbackImage && src !== fallbackImage) {
              setUseFallback(true);
              setLoaded(false);
            }
          }}
          className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS[gradient] || GRADIENTS.primary} flex items-center justify-center ${className}`}
    >
      <span className="shimmer-sweep" aria-hidden="true" />
      <i className={`${icon} text-white/50 ${iconClassName} relative z-10`} />
    </div>
  );
}
