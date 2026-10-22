import Link from "next/link";
import TrendingNews from "@/components/news/TrendingNews";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import WidgetHeading from "@/components/common/WidgetHeading";
import AdSlot from "@/components/common/AdSlot";
import { getTrending, getTopStories, getVideoHighlights } from "@/features/news/news.api";
import { formatViews } from "@/lib/formatViews";

export default async function NewsAsideLeft() {
  const [trending, topStories, videoHighlights] = await Promise.all([
    getTrending(),
    getTopStories(),
    getVideoHighlights(),
  ]);

  return (
    <aside className="order-2 lg:order-1 lg:w-1/4 flex flex-col bg-surface-container rounded-xl p-4 border border-outline-variant/30 gap-6">
      <TrendingNews items={trending} viewAllHref="/trending" />

      <div className="pt-4 border-t border-outline-variant/30">
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
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Videos" icon="fa-solid fa-video" />
        <div className="flex flex-col gap-4">
          {videoHighlights.map((video) => (
            <a
              key={video.id}
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Play video: ${video.title}`}
              className="group block cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="relative w-full aspect-video rounded-md overflow-hidden mb-2">
                <ImagePlaceholder icon="fa-solid fa-video" image={video.image} alt={video.title} gradient="secondary" className="w-full h-full" iconClassName="text-2xl" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                  <i className="fa-solid fa-circle-play text-white text-2xl opacity-90 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <h4 className="font-body-md font-semibold text-xs text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                {video.title}
              </h4>
              <span className="inline-flex items-center gap-1 text-[10px] text-outline mt-1">
                <i className="fa-regular fa-eye" /> {formatViews(video.views)}
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <AdSlot width="300px" height="250px" label="300x250 Rectangle Ad" />
      </div>
    </aside>
  );
}
