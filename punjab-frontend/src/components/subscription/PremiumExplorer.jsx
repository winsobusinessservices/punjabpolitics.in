"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NewsCard from "@/components/news/NewsCard";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import EmptyState from "@/components/common/EmptyState";

function Chip({ selected, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-label-md text-sm font-semibold transition-colors ${
        selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant/50 text-on-surface hover:border-primary hover:text-primary"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

// One subscribers-only category as a card. It opens the category's own page, the same page every other category has.
function CategoryCard({ section }) {
  const { name, slug, count, description, latest } = section;
  return (
    <Link
      href={`/category/${slug}`}
      data-category-card={name}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-secondary/60 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative">
        {/* <ImagePlaceholder icon="fa-solid fa-crown" image={latest?.image || ""} alt={latest ? latest.title : name} gradient="secondary" className="aspect-[16/9] w-full" iconClassName="text-4xl" decorative={!latest} /> */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-label-sm text-[11px] font-bold uppercase tracking-wider text-on-secondary shadow">
          <i className="fa-solid fa-lock text-[10px]" aria-hidden="true" /> Subscribers only
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 mt-7">
        <h3 className="font-headline-md text-xl leading-snug text-on-surface transition-colors group-hover:text-primary">{name}</h3>
        <p className="mt-2 line-clamp-3 font-body-md text-sm leading-relaxed text-on-surface-variant">{description || "Exclusive stories and analysis, written for Premium members."}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="rounded-full bg-secondary/10 px-3 py-1 font-label-md text-xs font-semibold text-secondary">
            {count} {count === 1 ? "story" : "stories"}
          </span>
          <span className="inline-flex items-center gap-2 font-label-md text-sm font-semibold text-primary">
            Open category <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * The Premium page: one row of chips, then cards.
 *   All premium                every premium story
 *   the kinds of story         premium article, exclusive political analysis, ... (their stories)
 *   Category                   ONE chip. It shows a card for every subscribers-only category; a card opens that
 *                              category's own details page.
 * A category an admin switches to "Subscribers only" gets its card here by itself, even before it has stories.
 *   stories   premium stories, newest first
 *   sections  the subscribers-only categories [{ name, slug, description, count, latest }]
 *   kinds     the kinds of premium story [{ key, label }]
 */
export default function PremiumExplorer({ stories, sections, kinds }) {
  const [picked, setPicked] = useState("all"); // "all" | "category" | a kind key

  const kind = kinds.find((item) => item.key === picked);
  const shown = useMemo(() => (kind ? stories.filter((story) => story.premium === kind.key) : stories), [stories, kind]);

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max items-center gap-2">
          <Chip selected={picked === "all"} onClick={() => setPicked("all")} data-chip="all">All premium</Chip>
          {kinds.map((item) => (
            <Chip key={item.key} selected={picked === item.key} onClick={() => setPicked(item.key)} data-chip={`kind:${item.key}`}>{item.label}</Chip>
          ))}
          {sections.length > 0 && (
            <Chip selected={picked === "category"} onClick={() => setPicked("category")} data-chip="category">Category</Chip>
          )}
        </div>
      </div>

      {picked === "category" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <CategoryCard key={section.slug} section={section} />
          ))}
        </div>
      ) : (
        <>
          {/* "All premium" also lists the subscribers-only categories, above the stories. */}
          {picked === "all" && sections.length > 0 && (
            <section aria-label="Subscribers-only categories" className="flex flex-col gap-3">
              <h2 className="font-label-md text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                <i className="fa-solid fa-crown mr-1.5 text-[11px]" aria-hidden="true" /> Subscribers-only categories
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((section) => (
                  <CategoryCard key={section.slug} section={section} />
                ))}
              </div>
            </section>
          )}
          {shown.length === 0 ? (
            // With category cards on the page, an empty story list needs no big empty-state box.
            picked === "all" && sections.length > 0 ? null : (
              <EmptyState
                compact
                icon="fa-crown"
                title={kind ? `No ${kind.label.toLowerCase()} yet` : "No premium stories yet"}
                description="Premium analysis and reports will appear here as soon as they are published."
              />
            )
          ) : (
            <section aria-label="Premium stories" className="flex flex-col gap-3">
              {picked === "all" && sections.length > 0 && (
                <h2 className="font-label-md text-xs font-bold uppercase tracking-[0.18em] text-secondary">Premium stories</h2>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {shown.map((story) => (
                  <NewsCard key={`${story.type}-${story.id}`} variant="stacked" story={story} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
