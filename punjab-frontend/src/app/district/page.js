import CategoryPageShell from "@/components/category/CategoryPageShell";
import DistrictCard from "@/components/geography/DistrictCard";
import { getDistricts } from "@/features/geography/district.api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Punjab Districts: Profiles & Constituencies",
  description: "Explore Punjab's districts, their administration, political constituencies, population, history and local profile, with a detailed page for every district.",
  path: "/district",
});

export default async function DistrictsPage() {
  const districts = await getDistricts();
  return (
    <CategoryPageShell
      title="Punjab Districts"
      count={districts.length}
      gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
      emptyTitle="No districts available"
      emptyDescription="District profiles added in Site Data will appear here."
    >
      {districts.map((district) => <DistrictCard key={district.id || district.slug} district={district} />)}
    </CategoryPageShell>
  );
}
