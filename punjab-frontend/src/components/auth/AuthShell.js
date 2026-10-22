"use client";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-foreground px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-lg sm:p-10">
        <header className="mb-6 flex flex-col justidy-center items-center">
          <h1 className="font-display-lg text-2xl leading-tight text-primary sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 font-body-md text-sm text-on-surface-variant">
              {subtitle}
            </p>
          )}
        </header>
        <div className="space-y-6">
          {children}
          {footer && (
            <div className="border-t border-outline-variant/20 pt-4 text-center text-xs sm:text-sm">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
