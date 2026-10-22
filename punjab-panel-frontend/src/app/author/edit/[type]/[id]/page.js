import { Suspense } from "react";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import EditPostClient from "@/components/author/EditPostClient";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Edit Post" };

export default async function EditPostPage({ params }) {
  const { type, id } = await params;
  const breakingNews = await getBreakingNews();

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full bg-background flex-grow">
        <RequireContributorRole roles={["AUTHOR", "EDITOR", "ADMIN", "INVESTOR"]} permissions={[PERMISSIONS.MY_CONTENT]}>
          <Suspense fallback={null}>
            <EditPostClient type={type.toUpperCase()} id={id} />
          </Suspense>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
