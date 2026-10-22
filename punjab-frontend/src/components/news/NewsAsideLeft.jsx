import Link from "next/link";
import TrendingNews from "@/components/news/TrendingNews";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import WidgetHeading from "@/components/common/WidgetHeading";
import AdSlot from "@/components/common/AdSlot";
import GoogleAd from "@/components/common/GoogleAd";
import { getTrending, getTopStories, getSectionVisibility } from "@/features/news/news.api";

export default async function NewsAsideLeft() {
  const [trending, topStories, visibility] = await Promise.all([
    getTrending(),
    getTopStories(),
    getSectionVisibility(),
  ]);

  return (
    <aside className="order-2 lg:order-1 lg:w-1/4 flex flex-col bg-surface-container rounded-xl p-4 border border-outline-variant/30 gap-6">
      {visibility.trending_news !== false && <TrendingNews items={trending} viewAllHref="/trending" />}

      {visibility.top_stories !== false && <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Top Stories" icon="fa-solid fa-newspaper" />
        <div className="flex flex-col gap-4">
          {topStories.map((story) => (
            <Link key={story.id} href={`/news/${story.slug}`} className="flex gap-3 group cursor-pointer">
              <ImagePlaceholder
                icon={story.icon}
                image={story.image}
                alt={story.title}
                gradient="primary"
                className="w-16 h-16 flex-shrink-0 rounded-md"
                iconClassName="text-lg"
              />
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-surface-tint uppercase tracking-wider">
                  {story.category}
                </span>
                <h4 className="font-headline-md text-xs text-on-surface group-hover:text-primary transition-colors leading-tight">
                  {story.title}
                </h4>
              </div>
            </Link>
          ))}
        </div>
      </div>}

      <AdSlot placement="sidebar_left" />
      <GoogleAd slot="3691353983" className="flex justify-center" style={{ width: 250, height: 250 }} />
    </aside>
  );
}
