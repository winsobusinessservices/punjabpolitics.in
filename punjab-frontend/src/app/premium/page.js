import CategoryPageShell from "@/components/category/CategoryPageShell";
import PremiumAreaGate from "@/components/subscription/PremiumAreaGate";
import PremiumExplorer from "@/components/subscription/PremiumExplorer";
import { getPremiumPosts } from "@/features/news/news.api";
import { buildPageMetadata } from "@/lib/seo";

// A members' area: it is not offered to search engines (the story pages themselves are public previews).
export const metadata = {
  ...buildPageMetadata({
    title: "Premium Stories: Exclusive Political Analysis and Reports",
    description: "Exclusive political analysis, reports and election analysis for Premium members.",
    path: "/premium",
  }),
  robots: { index: false, follow: true },
};

export default async function PremiumPage() {
  const premium = await getPremiumPosts();

  // Same layout as the other listing pages (All News, Top News): title, filter bar, cards, sidebar.
  // No count is passed: for people without Premium the page is only the lock note.
  return (
    <CategoryPageShell title="Premium Stories" gridClassName="">
      <PremiumAreaGate>
        <PremiumExplorer stories={premium.posts} sections={premium.categories} kinds={premium.types} />
      </PremiumAreaGate>
    </CategoryPageShell>
  );
}
