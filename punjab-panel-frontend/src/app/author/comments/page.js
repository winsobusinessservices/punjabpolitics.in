import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import CommentModerationClient from "@/components/author/CommentModerationClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Comment Moderation" };

export default async function CommentModerationPage() {
  const breakingNews = await getBreakingNews();
  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_COMMENTS]} roleLabel="a comment moderator">
          <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-16">
            <h1 className="font-display-lg text-3xl text-primary">Comment Moderation</h1>
            <p className="mb-8 mt-2 font-body-md text-on-surface-variant">Control discussions per article, or hide and delete individual comments.</p>
            <CommentModerationClient />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
