import CategoryPageShell from "@/components/category/CategoryPageShell";
import CMCard from "@/components/politician/CMCard";
import { getChiefMinisters } from "@/features/politicians/politician.api";
import { getAllStatesAndUTs } from "@/features/geography/geography.api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export const metadata = buildPageMetadata({ title: "Indian States & Union Territories: Politics", description: "Explore state politics, chief ministers, opposition leaders, elections and governance across India's states and union territories, with a profile for each.", path: "/state" });

export default async function StatesPage() {
  if (!(await isSiteFeatureEnabled("feature_states"))) notFound();
  const [places, chiefMinisters] = await Promise.all([
    getAllStatesAndUTs(),
    getChiefMinisters(),
  ]);

  const chiefMinisterByState = new Map(
    chiefMinisters.map((cm) => [cm.state.toLowerCase(), cm]),
  );

  return (
    <CategoryPageShell title="States & Union Territories" count={places.length}>
      {places.map((place) => {
        const cm = chiefMinisterByState.get(place.name.toLowerCase());
        const details = [
          cm || place.currentCmName ? `Chief Minister: ${cm?.name || place.currentCmName}` : place.kind === "UNION_TERRITORY" ? "Union Territory" : null,
          place.capital ? `Capital: ${place.capital}` : null,
        ].filter(Boolean).join(" · ");

        return (
        <CMCard
          key={place.id || place.slug}
          name={place.name}
          subtitle={details || "View political profile"}
          photo={place.image || cm?.photo}
          photoFallback={cm?.photoFallback}
          href={`/category/${place.slug}`}
        />
        );
      })}
    </CategoryPageShell>
  );
}
