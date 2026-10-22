import CategoryPageShell from "@/components/category/CategoryPageShell";
import VideoCard from "@/components/news/VideoCard";
import { getAllVideos, getListingPages } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export async function generateMetadata() {
  const page = (await getListingPages()).videos || {};
  return buildPageMetadata({ title: page.title || "Political Videos, Interviews & Speeches", description: page.description || "Watch videos, interviews and speeches on Punjab and Indian politics, elections, governance and public policy, collected in one place for easy viewing.", path: "/videos" });
}

export default async function VideosPage() {
  if (!(await isSiteFeatureEnabled("feature_videos"))) notFound();
  const [videos, pages] = await Promise.all([getAllVideos(), getListingPages()]);

  return (
    <CategoryPageShell
      title={pages.videos?.title || ""}
      count={videos.length}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {videos.map((video) => (
        <VideoCard key={video.id} title={video.title} category={video.category} image={video.image} views={video.views} href={video.videoUrl} />
      ))}
    </CategoryPageShell>
  );
}
