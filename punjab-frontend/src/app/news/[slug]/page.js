import Link from "next/link";
import { notFound } from "next/navigation";
import BreakingNews from "@/components/layout/BreakingNews";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import NewsCard from "@/components/news/NewsCard";
import NewsAsideLeft from "@/components/news/NewsAsideLeft";
import NewsAsideRight from "@/components/news/NewsAsideRight";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import { slugify } from "@/lib/slugify";
import { formatViews } from "@/lib/formatViews";

import { getBreakingNews, getPostBySlug, getRelatedPosts, getSectionVisibility } from "@/features/news/news.api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { absoluteUrl, buildPageMetadata, serializeJsonLd } from "@/lib/seo";
import { mediaUrl } from "@/lib/api";
import ShareButton from "@/components/common/ShareButton";
import PostBody from "@/components/common/PostBody";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import AdSlot from "@/components/common/AdSlot";
import CommentSection from "@/components/news/CommentSection";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  const metadata = buildPageMetadata({
    title: post.title,
    description: post.excerpt,
    path: post.canonicalUrl || `/news/${slug}`,
    image: post.image,
    type: "article",
    keywords: [...(post.tags || []), post.category],
  });
  metadata.openGraph.publishedTime = post.datePublished;
  metadata.openGraph.modifiedTime = post.dateModified;
  metadata.openGraph.authors = post.author ? [post.author] : undefined;
  metadata.openGraph.section = post.category;
  metadata.openGraph.tags = post.tags;
  return metadata;
}

export default async function PostDetailPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const [breakingNews, relatedPosts, sectionVisibility] = await Promise.all([getBreakingNews(), getRelatedPosts(slug, 4), getSectionVisibility()]);
  const canonicalUrl = post.canonicalUrl || absoluteUrl(`/news/${slug}`);
  const publisherName = post.source?.name || SITE_NAME;
  const publisherUrl = post.source?.siteUrl || `${SITE_URL}/#organization`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.excerpt,
    image: post.image ? [post.image] : undefined,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "NewsMediaOrganization",
      "@id": publisherUrl,
      name: publisherName,
      ...(post.source ? { url: publisherUrl } : { logo: { "@type": "ImageObject", url: `${SITE_URL}/globe.svg` } }),
    },
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    articleSection: post.category,
    keywords: post.tags?.join(", "),
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    url: canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: post.category, item: absoluteUrl(`/category/${slugify(post.category)}`) },
      { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(`/news/${slug}`) },
    ],
  };

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([articleSchema, breadcrumbSchema]) }} />
        <div className="max-w-full mx-auto px-4 md:px-16 py-6">
          {/* Breadcrumb */}
          <Breadcrumbs withSchema={false} items={[{ label: post.category, href: `/category/${slugify(post.category)}` }, { label: post.title }]} />

          <div className="flex flex-col lg:flex-row gap-6">
            <NewsAsideLeft />

            {/* Center: Article */}
            <article className="order-1 lg:order-2 flex-grow lg:w-3/5">
              <Link
                href={`/category/${slugify(post.category)}`}
                className="inline-block px-3 py-1 bg-primary text-on-primary text-xs font-label-md uppercase tracking-widest rounded-sm mb-4 hover:bg-primary-container transition-colors"
              >
                {post.category}
              </Link>
              <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface tracking-tight leading-tight mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-on-surface-variant font-label-md mb-6 pb-6 border-b border-outline-variant/30">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-user text-primary" /> {post.author}
                </span>
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-calendar text-primary" /> {post.date}
                </span>
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-clock text-primary" /> {post.readTime}
                </span>
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-eye text-primary" /> {formatViews(post.views)}
                </span>
                <ShareButton variant="inline" url={`/news/${slug}`} title={post.title} className="[&_button]:text-xs" />
              </div>

              {post.source?.url && (
                <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface-variant">
                  <i className="fa-solid fa-link text-primary" aria-hidden="true" />
                  <span>Originally published by</span>
                  <a href={post.source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                    {post.source.name || "Indian Rajniti"}
                    <i className="fa-solid fa-arrow-up-right-from-square ml-1.5 text-[10px]" aria-hidden="true" />
                  </a>
                </div>
              )}

              <ImagePlaceholder
                icon={post.icon}
                image={post.image}
                alt={post.title}
                gradient="primary"
                className="w-full aspect-[16/9] md:h-[420px] md:aspect-auto rounded-xl mb-8"
                iconClassName="text-7xl"
              />

              <div className="space-y-6">
                <PostBody content={post.content} />
                <AdSlot placement="article_inline" />
                <blockquote className="border-l-4 border-primary pl-6 py-2 italic font-headline-md text-lg text-on-surface">
                  &ldquo;{post.excerpt}&rdquo;
                </blockquote>
              </div>

              {post.additionalImages?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8" aria-label="Article images">
                  {post.additionalImages.map((url, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={mediaUrl(url)} alt={`${post.title} — image ${index + 2}`} loading="lazy" className="w-full aspect-video object-cover rounded-xl" />
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant">Share this story</span>
                <ShareButton variant="button" url={`/news/${slug}`} title={post.title} />
              </div>

              <div className="mt-10 pt-6 border-t border-outline-variant/30">
                <h3 className="font-label-md text-primary text-xs uppercase tracking-widest mb-3">Related Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/category/${slugify(tag)}`}
                      className="px-3 py-1 bg-surface-container-high text-on-surface text-xs font-label-md rounded-full hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>

              {!post.syndicated && sectionVisibility.feature_comments !== false && <CommentSection postSlug={post.slug || slug} commentsEnabled={post.comments_enabled !== 0 && post.comments_enabled !== false} />}
            </article>

            <NewsAsideRight />
          </div>
        </div>
      </main>

      {/* Recommended News */}
      <section className="w-full bg-surface py-10 border-t border-outline-variant/30">
        <div className="max-w-[1280px] mx-auto px-4 md:px-16">
          <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-2">
            <h2 className="font-display-lg text-2xl md:text-3xl text-primary tracking-tight">Recommended News</h2>
            <Link href="/" className="font-label-md text-secondary hover:underline flex items-center gap-1 text-sm">
              VIEW ALL <i className="fa-solid fa-arrow-right text-xs" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedPosts.map((story) => (
              <NewsCard key={story.id} variant="stacked" story={story} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
