"use client";

import { useState } from "react";
import Image from "next/image";
import { mediaUrl, isOptimizableImageHost } from "@/lib/api";

// Circular photo avatar for politician/party cards — shows a shimmer while
// the real photo loads, falls back to initials/abbreviation on a gradient
// when no photo exists yet (matches ImagePlaceholder's loading behavior,
// just circular instead of rectangular).
export default function Avatar({ photo, fallbackPhoto, alt = "", fallbackText = "", gradient = "from-primary to-primary-container", className = "w-20 h-20" }) {
  const [loaded, setLoaded] = useState(false);
  const resolvedPhoto = mediaUrl(photo);
  const resolvedFallback = mediaUrl(fallbackPhoto);
  const [activePhoto, setActivePhoto] = useState(resolvedPhoto || resolvedFallback);

  const handleError = () => {
    setLoaded(false);
    setActivePhoto((current) => current !== resolvedFallback ? resolvedFallback : "");
  };

  return (
    <div className={`relative overflow-hidden rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ${className}`}>
      {activePhoto ? (
        <>
          {!loaded && <span className="shimmer-sweep" aria-hidden="true" />}
          <Image
            src={activePhoto}
            alt={alt}
            fill
            sizes="96px"
            unoptimized={!isOptimizableImageHost(activePhoto)}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <span className="font-headline-md text-white text-xl relative z-10">{fallbackText}</span>
      )}
    </div>
  );
}
