import CategoryPageShell from "@/components/category/CategoryPageShell";
import NewsCard from "@/components/news/NewsCard";
import { getBlogs, getListingPages } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export async function generateMetadata() {
  const page = (await getListingPages()).blogs || {};
  return buildPageMetadata({ title: page.title || "Punjab Political Blogs, Opinion & Analysis", description: page.description || "Read blogs, opinion pieces and in-depth analysis on Punjab politics, elections, governance and public policy, written by our contributors and subject experts.", path: "/blogs" });
}

export default async function BlogsPage() {
  if (!(await isSiteFeatureEnabled("feature_blogs"))) notFound();
  const [blogs, pages] = await Promise.all([getBlogs(), getListingPages()]);

  return (
    <CategoryPageShell
      title={pages.blogs?.title || ""}
      count={blogs.length}
      gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {blogs.map((blog) => (
        <NewsCard key={blog.id} variant="stacked" story={blog} />
      ))}
    </CategoryPageShell>
  );
}
