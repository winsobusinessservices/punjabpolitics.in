import Breadcrumbs from "@/components/common/Breadcrumbs";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CategorySidebar from "@/components/category/CategorySidebar";
import { getBreakingNews } from "@/features/news/news.api";
import EmptyState from "@/components/common/EmptyState";

export default async function CategoryPageShell({
  title,
  count,
  gridClassName = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4",
  children,
  emptyTitle,
  emptyDescription,
}) {
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        <div className="max-w-full mx-auto px-4 md:px-16 py-6">
          <Breadcrumbs items={[{ label: title }]} />

          <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2">
            <h1 className="font-display-lg text-2xl md:text-3xl text-primary tracking-tight">{title}</h1>
            {count != null && (
              <span className="font-label-md text-on-surface-variant text-sm">{count} total</span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="order-1 flex-grow lg:w-3/4">
              {count === 0 ? <EmptyState icon="fa-box-open" title={emptyTitle || `No ${String(title || "content").toLowerCase()} available`} description={emptyDescription || "Content for this website will appear here when it becomes available."} /> : <div className={gridClassName}>{children}</div>}
            </div>
            <aside className="order-2 lg:w-1/4 bg-surface-container rounded-xl p-4 border border-outline-variant/30">
              <CategorySidebar />
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
