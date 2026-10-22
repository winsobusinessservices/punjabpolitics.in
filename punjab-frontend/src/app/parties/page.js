import CategoryPageShell from "@/components/category/CategoryPageShell";
import PartyCard from "@/components/politician/PartyCard";
import { getParties } from "@/features/politicians/politician.api";
import { buildPageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";

export const metadata = buildPageMetadata({ title: "Political Parties in India: Leaders & History", description: "Explore India's national and regional political parties, their leaders, history, ideology and current political role, with clear profiles of each party.", path: "/parties" });

export default async function PartiesPage() {
  if (!(await isSiteFeatureEnabled("feature_parties"))) notFound();
  const parties = await getParties();

  return (
    <CategoryPageShell title="Political Parties" count={parties.length}>
      {parties.map((party) => (
        <PartyCard key={party.id} name={party.name} abbreviation={party.abbreviation} founded={party.founded} photo={party.photo} photoFallback={party.photoFallback} href={`/category/${party.slug}`} />
      ))}
    </CategoryPageShell>
  );
}
