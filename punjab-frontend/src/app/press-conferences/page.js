import CategoryPageShell from "@/components/category/CategoryPageShell";
import VideoCard from "@/components/news/VideoCard";
import { getPressConferenceArchive } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export const metadata = buildPageMetadata({ title: "Political Press Conference Archive & Videos", description: "Watch and explore press conferences from Indian political parties, government leaders and opposition representatives, collected in one searchable archive.", path: "/press-conferences" });

export default async function PressConferencesPage() {
  if (!(await isSiteFeatureEnabled("feature_videos"))) notFound();
  const pressConferences = await getPressConferenceArchive();

  return (
    <CategoryPageShell
      title="Press Conference Archive"
      count={pressConferences.length}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {pressConferences.map((item) => (
        <VideoCard key={item.id} title={item.title} category={item.category} image={item.image} views={item.views} href={item.videoUrl} />
      ))}
    </CategoryPageShell>
  );
}
