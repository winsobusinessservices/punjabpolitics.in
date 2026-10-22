"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { mediaUrl, sitesApi } from "@/lib/api";

const FALLBACK_LOGO = "/images/logo.jpg";

function SiteLogo({ className }) {
  const [site, setSite] = useState(null);
  const [failedLogo, setFailedLogo] = useState("");

  useEffect(() => {
    let active = true;
    sitesApi.current()
      .then((response) => {
        if (active) setSite(response?.site ?? response);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const configuredLogo = site?.logo_url ? mediaUrl(site.logo_url) : FALLBACK_LOGO;
  const logoSrc = failedLogo === configuredLogo ? FALLBACK_LOGO : configuredLogo;

  return (
    <Image
      src={logoSrc}
      alt={`${site?.name || "Punjab Politics"} logo`}
      width={320}
      height={160}
      className={className}
      sizes="160px"
      onError={() => setFailedLogo(configuredLogo)}
    />
  );
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-foreground py-12 px-4 sm:px-6 lg:px-8">
      {/* Main Container - Not full width */}
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-0 rounded-lg overflow-hidden shadow-lg border border-outline-variant/20">

          {/* Left Side - Punjab Politics branding */}
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary-container to-secondary p-12 flex-col justify-center items-start relative overflow-hidden">
            {/* Animated background shapes */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg
                className="absolute top-10 left-10 w-40 h-40 animate-[spin_120s_linear_infinite] text-white"
                fill="currentColor"
                viewBox="0 0 200 200"
              >
                <path d="M100,20 Q140,50 140,100 Q140,150 100,170 Q60,150 60,100 Q60,50 100,20 Z" />
                <path d="M100,40 Q130,65 130,100 Q130,135 100,155 Q70,135 70,100 Q70,65 100,40 Z" />
              </svg>
            </div>

            {/* Decorative gradient bars */}
            <div className="absolute bottom-0 right-0 w-96 h-96 opacity-15 pointer-events-none">
              <div className="absolute top-20 right-10 w-32 h-64 bg-gradient-to-r from-white to-secondary-fixed rounded-full blur-3xl transform -rotate-45" />
              <div className="absolute top-40 right-40 w-40 h-48 bg-gradient-to-l from-primary-fixed-dim to-white rounded-full blur-3xl transform rotate-45" />
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-md ">
              {/* Logo with matching background */}
              <div className="mb-8 inline-flex items-center justify-center p-4 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                <SiteLogo className="h-20 w-40 object-contain" />
              </div>

              <h1 className="font-display-lg text-white text-4xl tracking-tight leading-tight mb-4">
                {title}
              </h1>

              {subtitle && (
                <p className="font-body-lg text-white/95 leading-relaxed text-lg">
                  {subtitle}
                </p>
              )}

              {/* Features - Indian Politics News Focus */}
              <div className="mt-8 space-y-3">
                <div className="flex items-start gap-3 text-white/90">
                  <i className="fa-solid fa-newspaper text-white text-lg mt-1 flex-shrink-0" />
                  <span className="font-label-md">Breaking Electoral Updates</span>
                </div>
                <div className="flex items-start gap-3 text-white/90">
                  <i className="fa-solid fa-chart-line text-white text-lg mt-1 flex-shrink-0" />
                  <span className="font-label-md">Live Political Analysis</span>
                </div>
                <div className="flex items-start gap-3 text-white/90">
                  <i className="fa-solid fa-users text-white text-lg mt-1 flex-shrink-0" />
                  <span className="font-label-md">Verified Expert Commentary</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Form Section */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-10 lg:p-12 bg-surface-container-lowest">
            <div className="w-full">
              {/* Mobile Header - Only visible on mobile */}
              <div className="lg:hidden mb-8 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-primary-fixed rounded-lg mb-4">
                  <SiteLogo className="h-20 w-40 object-contain" />

                </div>
                <h2 className="font-display-lg text-primary text-2xl sm:text-3xl tracking-tight leading-tight mb-2">
                  {title}
                </h2>
                {subtitle && (
                  <p className="font-body-md text-on-surface-variant text-sm">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Form Card */}
              <div className="space-y-6 rounded-lg">
                {/* Desktop Header - Hidden on mobile */}
                <div className="hidden lg:block mb-6">
                  <h2 className="font-display-lg text-primary text-3xl tracking-tight leading-tight">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="font-body-md text-on-surface-variant mt-2">
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Form Children */}
                {children}

                {/* Footer */}
                {footer && (
                  <div className="text-center text-xs sm:text-sm border-t border-outline-variant/20 pt-4">
                    {footer}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
