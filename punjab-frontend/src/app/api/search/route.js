import { NextResponse } from "next/server";
import { searchContent } from "@/features/search/search.api";

// Backs the live-suggestions dropdown in SearchBox — a thin JSON wrapper
// around the same searchContent() the /search results page uses, capped to
// a handful of each kind since this renders in a small dropdown, not a page.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = Number(searchParams.get("limit")) || 5;

  const { posts, categories } = await searchContent(q);

  return NextResponse.json({
    categories: categories.slice(0, limit),
    posts: posts.slice(0, limit),
  });
}
