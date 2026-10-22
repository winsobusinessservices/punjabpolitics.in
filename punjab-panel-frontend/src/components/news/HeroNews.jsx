"use client";

import { useEffect, useState } from "react";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import { formatViews } from "@/lib/formatViews";

const BADGE_CLASS = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  tint: "bg-surface-tint text-on-primary",
};

export default function HeroNews({ slides }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goTo = (index) => setCurrent((index + slides.length) % slides.length);

  // No approved articles yet — nothing to feature. Real content, so unlike
  // the old dummy data (always exactly 3 slides), this can genuinely happen.
  if (slides.length === 0) return null;

  return (
    <div className="relative isolate z-0 w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden shadow-lg group" style={{ zIndex: 0, isolation: "isolate" }}>
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
            index === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <ImagePlaceholder icon={slide.icon} image={slide.image} alt={slide.title} gradient="primary" className="w-full h-full" iconClassName="text-6xl" priority={index === 0} sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6">
            <span
              className={`text-xs font-bold px-3 py-1 uppercase tracking-widest self-start mb-2 rounded-sm ${
                BADGE_CLASS[slide.badge] || BADGE_CLASS.primary
              }`}
            >
              {slide.category}
            </span>
            <h2 className="font-display-lg text-white text-2xl md:text-3xl lg:text-4xl leading-tight mb-2 drop-shadow-md">
              {slide.title}
            </h2>
            <p className="font-body-md text-gray-200 hidden md:block max-w-3xl drop-shadow-sm text-sm">
              {slide.excerpt}
            </p>
            <span className="text-xs text-gray-200 mt-2 inline-flex items-center gap-1">
              <i className="fa-regular fa-eye" /> {formatViews(slide.views)}
            </span>
          </div>
        </div>
      ))}

      <button
        onClick={() => goTo(current - 1)}
        aria-label="Previous slide"
        className="absolute top-1/2 left-4 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-primary text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 z-20"
      >
        <i className="fa-solid fa-chevron-left text-xs" />
      </button>
      <button
        onClick={() => goTo(current + 1)}
        aria-label="Next slide"
        className="absolute top-1/2 right-4 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-primary text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 z-20"
      >
        <i className="fa-solid fa-chevron-right text-xs" />
      </button>

      <div className="absolute bottom-4 right-4 flex gap-2 z-20">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-1 rounded-full transition-all duration-300 ${
              index === current ? "w-8 bg-primary" : "w-3 bg-surface-variant hover:bg-outline"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
