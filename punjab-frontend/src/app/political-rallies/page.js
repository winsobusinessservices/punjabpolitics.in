import CategoryPageShell from "@/components/category/CategoryPageShell";
import { getPoliticalRallys} from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({ title: "Upcoming Political Rallies in India", description: "See upcoming political rallies and public meetings across India as they are scheduled, and follow party campaign activity and election-season events.", path: "/political-rallies" });

export default async function PoliticalRalliesPage() {
  const events = await getPoliticalRallys();

  return (
    <CategoryPageShell title="Political Rallies" count={events.length} gridClassName="flex flex-col gap-4">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/20"
        >
          <span className="font-label-md text-sm text-primary bg-primary-fixed px-3 py-1.5 rounded-sm flex-shrink-0">
            {event.date}
          </span>
          <p className="font-body-md text-on-surface">{event.title}</p>
        </div>
      ))}
    </CategoryPageShell>
  );
}
