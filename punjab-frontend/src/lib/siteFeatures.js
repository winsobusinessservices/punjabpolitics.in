import { getSectionVisibility } from "@/features/news/news.api";

export async function isSiteFeatureEnabled(featureKey) {
  try {
    const visibility = await getSectionVisibility();
    return visibility?.[featureKey] !== false;
  } catch {
    return true;
  }
}
