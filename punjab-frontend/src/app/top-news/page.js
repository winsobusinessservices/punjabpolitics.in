import CategoryPageShell from "@/components/category/CategoryPageShell";
import NewsCard from "@/components/news/NewsCard";
import { getTopStories } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";
import EmptyState from "@/components/common/EmptyState";

export const metadata = buildPageMetadata({ title: "Top Political Stories, Analysis & Updates", description: "Read the leading political stories, election updates, parliamentary developments and policy analysis, selected and explained by the Punjab Politics team.", path: "/top-news" });

export default async function TopStoriesPage() {
  const topStories = await getTopStories();

  return (
    <CategoryPageShell
      title="Top News"
      count={topStories.length}
      gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {topStories.length === 0 && <div className="md:col-span-2 lg:col-span-3"><EmptyState icon="fa-newspaper" title="No top news is available yet" description="Approved top stories for this website will appear here." /></div>}
      {topStories.map((story) => (
        <NewsCard key={story.id} variant="stacked" story={story} />
      ))}
    </CategoryPageShell>
  );
}
