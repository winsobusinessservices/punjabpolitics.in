import CategoryPageShell from "@/components/category/CategoryPageShell";
import PoliticianCard from "@/components/politician/PoliticianCard";
import { getKeyFigures } from "@/features/politicians/politician.api";
import { slugify } from "@/lib/slugify";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export const metadata = buildPageMetadata({ title: "Key Indian Political Leaders & Profiles", description: "Profiles of influential Indian political leaders: their positions, parties, careers and latest developments, gathered in one place for easy reference.", path: "/key-political-figures" });

export default async function KeyPoliticalFiguresPage() {
  if (!(await isSiteFeatureEnabled("feature_leaders"))) notFound();
  const keyFigures = await getKeyFigures();

  return (
    <CategoryPageShell title="Key Political Figures" count={keyFigures.length}>
      {keyFigures.map((figure) => (
        <PoliticianCard
          key={figure.id}
          name={figure.name}
          subtitle={figure.position}
          photo={figure.photo}
          photoFallback={figure.photoFallback}
          href={`/category/${slugify(figure.name)}`}
        />
      ))}
    </CategoryPageShell>
  );
}
