import CategoryPageShell from "@/components/category/CategoryPageShell";
import CMCard from "@/components/politician/CMCard";
import { getFormerPMs } from "@/features/politicians/politician.api";
import { slugify } from "@/lib/slugify";
import { buildPageMetadata } from "@/lib/seo";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";
import { notFound } from "next/navigation";

export const metadata = buildPageMetadata({ title: "Former Prime Ministers of India: Profiles", description: "Explore the tenures, political careers and legacies of India's former prime ministers, with profiles covering their parties, terms in office and key decisions.", path: "/former-prime-ministers" });

export default async function FormerPrimeMinistersPage() {
  if (!(await isSiteFeatureEnabled("feature_leaders"))) notFound();
  const formerPMs = await getFormerPMs();

  return (
    <CategoryPageShell title="Former Prime Ministers" count={formerPMs.length}>
      {formerPMs.map((pm) => (
        <CMCard key={pm.id} name={pm.name} subtitle={pm.tenure} photo={pm.photo} href={`/category/${slugify(pm.name)}`} />
      ))}
    </CategoryPageShell>
  );
}
