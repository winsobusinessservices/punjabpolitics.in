import Link from "next/link";
import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import NewsCard from "@/components/news/NewsCard";
import { getBreakingNews } from "@/features/news/news.api";
import { searchContent } from "@/features/search/search.api";
import { CATEGORY_TYPE_LABEL } from "@/lib/constants";

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const [breakingNews, results] = await Promise.all([
    getBreakingNews(),
    query ? searchContent(query) : Promise.resolve({ posts: [], categories: [] }),
  ]);

  const hasResults = results.posts.length > 0 || results.categories.length > 0;

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        <div className="max-w-[1280px] mx-auto px-4 md:px-16 py-10">
                    <Breadcrumbs items={[{ label: "Search" }]} />
<form action="/search" method="GET" className="mb-10">
            <div className="relative max-w-2xl">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search politicians, parties, states, news..."
                autoFocus
                className="w-full pl-11 pr-4 py-3 border border-outline-variant/40 rounded-full bg-surface-container-low text-on-surface focus:border-primary focus:outline-none font-body-md"
              />
            </div>
          </form>

          {!query && (
            <p className="font-body-md text-on-surface-variant">
              Search for a politician, party, state, or news topic — matching any word in your search.
            </p>
          )}

          {query && !hasResults && (
            <p className="font-body-md text-on-surface-variant">
              No results for &ldquo;{query}&rdquo;. Try a different or shorter search term.
            </p>
          )}

          {query && hasResults && (
            <>
              {results.categories.length > 0 && (
                <section className="mb-10">
                  <h2 className="font-headline-lg text-primary text-xl mb-4 border-b border-outline-variant/30 pb-2">
                    Politicians, Parties &amp; States
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {results.categories.map((entry) => (
                      <Link
                        key={entry.slug}
                        href={`/category/${entry.slug}`}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-lg border border-outline-variant/20 hover:border-primary transition-colors"
                      >
                        <span className="font-body-md text-sm text-on-surface">{entry.label}</span>
                        {CATEGORY_TYPE_LABEL[entry.type] && (
                          <span className="text-[10px] font-label-md text-on-surface-variant uppercase tracking-widest">
                            {CATEGORY_TYPE_LABEL[entry.type]}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results.posts.length > 0 && (
                <section>
                  <h2 className="font-headline-lg text-primary text-xl mb-4 border-b border-outline-variant/30 pb-2">
                    News &amp; Articles
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.posts.map((story) => (
                      <NewsCard key={story.slug || story.id} variant="stacked" story={story} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
