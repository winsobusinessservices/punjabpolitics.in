"use client";

export default function ErrorPage({ reset }) {
  return <main className="flex min-h-[60vh] items-center justify-center bg-background px-4"><div className="max-w-lg rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center shadow-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary"><i className="fa-solid fa-triangle-exclamation" /></span><h1 className="mt-4 font-display-lg text-2xl text-on-surface">Content is temporarily unavailable</h1><p className="mt-2 text-sm leading-6 text-on-surface-variant">We could not load this page right now. Please try again in a moment.</p><button type="button" onClick={reset} className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"><i className="fa-solid fa-rotate-right mr-2" />Try again</button></div></main>;
}
