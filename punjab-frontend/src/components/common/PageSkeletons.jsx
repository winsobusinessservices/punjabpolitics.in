// Page-level skeleton layouts, composed from the primitives in Skeleton.jsx.
// These approximate each page family's overall shape (hero/grid/sidebar,
// article body, card list) rather than pixel-matching every section — for
// a loading state, the goal is a smooth shape transition, not a literal
// preview of content that hasn't loaded yet.
import { SkeletonBlock, SkeletonText, SkeletonCardGrid, SkeletonHeaderBar } from "./Skeleton";

function SectionSkeleton({ columns }) {
  return (
    <section className="border-t border-outline-variant/30 pt-6 mt-6 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2">
        <SkeletonText className="w-40 h-7" />
        <SkeletonText className="w-16 h-3" />
      </div>
      <SkeletonCardGrid count={columns === 2 ? 2 : 3} columns={columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"} />
    </section>
  );
}

// Homepage — hero slider, several card-grid sections in the main column,
// a narrower list-shaped sidebar. The real page has ~20 sections; a
// skeleton doesn't need to enumerate all of them to read as "this page."
export function HomeSkeleton() {
  return (
    <>
      <SkeletonHeaderBar />
      <main className="w-full bg-background flex-grow" aria-hidden="true">
        <div className="max-w-full mx-auto px-4 md:px-16 py-6">
          <SkeletonBlock className="w-full aspect-[16/6] rounded-xl" />
        </div>
        <div className="max-w-full mx-auto px-4 md:px-16 flex flex-col lg:flex-row gap-6 py-6">
          <div className="flex-grow flex flex-col lg:w-2/3">
            <SectionSkeleton columns={3} />
            <SectionSkeleton columns={2} />
            <SectionSkeleton columns={3} />
          </div>
          <aside className="lg:w-1/4 flex flex-col bg-surface-container rounded-xl p-4 border border-outline-variant/30 gap-4">
            <SkeletonText className="w-1/2 h-6 mb-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonText key={i} className="w-full" />
            ))}
          </aside>
        </div>
      </main>
    </>
  );
}

// Category/list pages — title, filter row, one big card grid.
export function CardGridPageSkeleton({ count = 9 }) {
  return (
    <>
      <SkeletonHeaderBar />
      <main className="w-full bg-background flex-grow" aria-hidden="true">
        <div className="max-w-full mx-auto px-4 md:px-16 py-10">
          <SkeletonText className="w-64 h-9 mb-3" />
          <SkeletonText className="w-96 h-4 mb-8" />
          <SkeletonCardGrid count={count} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3" />
        </div>
      </main>
    </>
  );
}

// Just the article body — title, meta row, hero image, paragraph lines.
// Exported separately so client components that fetch their own data (and
// whose surrounding page shell/header is already rendered) can reuse the
// same shape without a second header bar.
export function ArticleBodySkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10" aria-hidden="true">
      <SkeletonText className="w-24 h-3 mb-4" />
      <SkeletonText className="w-full h-9 mb-2" />
      <SkeletonText className="w-2/3 h-9 mb-6" />
      <div className="flex gap-4 mb-8">
        <SkeletonText className="w-24 h-3" />
        <SkeletonText className="w-24 h-3" />
      </div>
      <SkeletonBlock className="w-full aspect-[16/9] rounded-xl mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonText key={i} className={i % 3 === 2 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

// A single article/news detail page — the body above, plus the page shell.
export function ArticleDetailSkeleton() {
  return (
    <>
      <SkeletonHeaderBar />
      <main className="w-full bg-background flex-grow">
        <ArticleBodySkeleton />
      </main>
    </>
  );
}

// Author dashboard/content/history/review pages — these are client
// components that fetch client-side and manage their own loading state,
// so this only covers the brief moment before that client component mounts
// (the page.js itself still awaits getBreakingNews first).
export function DashboardPageSkeleton() {
  return (
    <>
      <SkeletonHeaderBar />
      <main className="w-full bg-background flex-grow" aria-hidden="true">
        <div className="max-w-full mx-auto px-4 md:px-16 py-10">
          <SkeletonText className="w-56 h-9 mb-6" />
          <DashboardRowsSkeleton />
        </div>
      </main>
    </>
  );
}

// Just the form body — title + the form's two-column shape. Exported
// separately for the same reason as ArticleBodySkeleton above.
export function FormBodySkeleton() {
  return (
    <div className="max-w-full mx-auto px-4 md:px-16 py-10" aria-hidden="true">
      <SkeletonText className="w-48 h-9 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonBlock className="lg:col-span-2 h-96" />
        <div className="space-y-4">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-56" />
        </div>
      </div>
    </div>
  );
}

// Create/edit post pages — the body above, plus the page shell.
export function FormPageSkeleton() {
  return (
    <>
      <SkeletonHeaderBar />
      <main className="w-full bg-background flex-grow">
        <FormBodySkeleton />
      </main>
    </>
  );
}

// Author-area rows (My Content, Review Queue, Content History) — the
// row shape those list pages already share, used inside the client
// components' own loading state (they fetch client-side, so a route-level
// loading.js never gets a chance to show for them).
export function DashboardRowsSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/20">
          <SkeletonBlock className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-grow min-w-0">
            <SkeletonText className="w-20 h-4 mb-2" />
            <SkeletonText className="w-2/3 h-5 mb-2" />
            <SkeletonText className="w-full h-3" />
          </div>
          <SkeletonBlock className="w-20 h-8 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
