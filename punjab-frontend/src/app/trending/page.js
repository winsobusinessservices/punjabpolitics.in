import CategoryPageShell from "@/components/category/CategoryPageShell";
import NewsCard from "@/components/news/NewsCard";
import { getTrending } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({ title: "Trending Political Stories & Debates", description: "Follow the political stories, leaders, elections and policy debates currently trending across India, updated as the public conversation develops.", path: "/trending" });

export default async function TrendingPage() {
  const trending = await getTrending();

  return (
    <CategoryPageShell
      title="Trending News"
      count={trending.length}
      gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {trending.map((story) => (
        <NewsCard key={story.id} variant="stacked" story={story} />
      ))}
    </CategoryPageShell>
  );
}
