import CategoryPageShell from "@/components/category/CategoryPageShell";
import CMCard from "@/components/politician/CMCard";
import { getChiefMinisters } from "@/features/politicians/politician.api";
import { slugify } from "@/lib/slugify";
import { buildPageMetadata } from "@/lib/seo";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";
import { notFound } from "next/navigation";

export const metadata = buildPageMetadata({ title: "Chief Ministers of India: Full List", description: "View current chief ministers and state leadership across India, with party affiliations, political profiles and key details for every state and territory.", path: "/cm" });

export default async function ChiefMinistersPage() {
  if (!(await isSiteFeatureEnabled("feature_leaders"))) notFound();
  const chiefMinisters = await getChiefMinisters();

  return (
    <CategoryPageShell title="State Leadership" count={chiefMinisters.length}>
      {chiefMinisters.map((cm) => (
        <CMCard
          key={cm.id}
          name={cm.name}
          subtitle={`Chief Minister, ${cm.state}`}
          photo={cm.photo}
          photoFallback={cm.photoFallback}
          href={`/category/${slugify(cm.name)}`}
        />
      ))}
    </CategoryPageShell>
  );
}
