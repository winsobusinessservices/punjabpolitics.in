import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import PostForm from "@/components/author/PostForm";
import { getBreakingNews } from "@/features/news/news.api";
import { PERMISSIONS } from "@/lib/permissions";

const VALID_TYPES = ["article", "blog", "video"];
const TYPE_LABEL = { article: "Article", blog: "Blog", video: "Video" };
const TYPE_PERMISSION = { article: PERMISSIONS.CREATE_ARTICLE, blog: PERMISSIONS.CREATE_BLOG, video: PERMISSIONS.CREATE_VIDEO };

export async function generateMetadata({ params }) {
  const { type } = await params;
  return { title: `Create ${TYPE_LABEL[type] || "Content"}` };
}

export default async function CreateContentPage({ params, searchParams }) {
  const { type } = await params;
  const { category = "" } = await searchParams;
  if (!VALID_TYPES.includes(type)) notFound();

  const breakingNews = await getBreakingNews();
  const label = TYPE_LABEL[type];

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />
      <main className="w-full bg-background flex-grow">
        <RequireContributorRole roles={["AUTHOR", "EDITOR", "ADMIN", "INVESTOR"]} permissions={[TYPE_PERMISSION[type]]}>
          <div className="max-w-full mx-auto px-4 md:px-16 py-10">
            <h1 className="font-display-lg text-3xl text-primary mb-2">Create {label}</h1>
            <p className="font-body-md text-on-surface-variant mb-8">
              Start a new {label.toLowerCase()} draft. You can submit it for editorial review once it&apos;s ready.
            </p>
            <PostForm type={type.toUpperCase()} initialCategory={category} />
          </div>
        </RequireContributorRole>
      </main>
      <Footer />
    </>
  );
}
