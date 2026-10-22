/**
 * Site-wide search: matches a query against every news/blog/speech/rally
 * teaser (by title, excerpt, category) and the same politician/party/state/
 * topic registry /category/[slug] resolves against (by label). "Anywords"
 * matching — a hit on ANY word in the query counts, not the whole phrase —
 * so "modi budget" finds Modi-related results even without "budget" nearby.
 */
import { allTeasers } from "@/features/news/news.api";
import { getAllCategoryEntries } from "@/features/category/category.api";

function tokenize(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function matchesAnyWord(text, words) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export async function searchContent(query) {
  const words = tokenize(query || "");
  if (!words.length) return { posts: [], categories: [] };

  const posts = allTeasers().filter(
    (story) =>
      matchesAnyWord(story.title, words) ||
      matchesAnyWord(story.excerpt, words) ||
      matchesAnyWord(story.category, words)
  );

  const categoryEntries = await getAllCategoryEntries();
  const categories = categoryEntries.filter((entry) => matchesAnyWord(entry.label, words));

  return { posts, categories };
}
