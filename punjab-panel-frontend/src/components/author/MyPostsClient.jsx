"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authorApi } from "@/lib/api";
import AiCheckLoader from "@/components/common/AiCheckLoader";
import ReasonModal from "@/components/common/ReasonModal";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import { richTextToPlainText } from "@/lib/richText";
import EmptyState from "@/components/common/EmptyState";

const STATUS_BADGE = {
  DRAFT: "bg-outline-variant text-on-surface",
  PENDING: "bg-yellow-500 text-black",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-error text-on-error",
};

const AI_BADGE = {
  NOT_CHECKED: "bg-surface-container-high text-on-surface-variant",
  PROCESSING: "bg-blue-100 text-blue-700",
  PASSED: "bg-green-100 text-green-700",
  FLAGGED: "bg-amber-100 text-amber-700",
  FAILED: "bg-surface-container-high text-on-surface-variant",
};

const TYPE_ICON = {
  ARTICLE: "fa-newspaper",
  BLOG: "fa-pen-nib",
  VIDEO: "fa-video",
};

export default function MyPostsClient({ compact = false, refreshSignal }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [aiCheckingId, setAiCheckingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters = { status: statusFilter };
      const results = typeFilter
        ? (await authorApi.listByType(typeFilter, filters)).posts
        : await authorApi.listAllTypes(filters);
      setPosts(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    // Fetching on mount/filter changes intentionally enters the loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosts();
    // refreshSignal isn't read directly, but bumping it (e.g. after a new
    // post is created elsewhere on the page) should trigger a re-fetch.
  }, [loadPosts, refreshSignal]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;

    return posts.filter((post) => {
      const searchableText = [
        post.title,
        post.slug,
        post.excerpt,
        post.description,
        post.category,
        post.state,
        post.status,
        post.type,
        post.related_politician,
        ...(Array.isArray(post.tags) ? post.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [posts, searchQuery]);

  const handleDelete = async (reason) => {
    // See ReviewQueueClient's handleDelete for why this guard isn't optional:
    // the React Compiler's auto-memoization reads deleteTarget.type/.id on
    // every render (including the first, when deleteTarget is still null)
    // to decide whether to recompute this callback.
    if (!deleteTarget) return;
    setActionError("");
    const { type, id } = deleteTarget;
    await authorApi.deletePost(type, id, reason);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setDeleteTarget(null);
  };

  const handleSubmit = async (post) => {
    setActionError("");
    setAiCheckingId(post.id);
    try {
      const data = await authorApi.submitPost(post.type, post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAiCheckingId(null);
    }
  };

  const content = (
    <>
      {aiCheckingId != null && <AiCheckLoader />}
      {!compact && <h1 className="font-display-lg text-3xl text-primary mb-6">My Content</h1>}

      <div className="mb-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:items-end">
        <label className="block w-full min-w-0 sm:col-span-2 lg:min-w-64 lg:flex-1">
          <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Search my content</span>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, category, state, tag..."
              className="block min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </label>

        <label className="block w-full min-w-0 lg:w-48">
          <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Content type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="block min-h-11 w-full max-w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm font-label-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">All Types</option>
            <option value="ARTICLE">Articles</option>
            <option value="BLOG">Blogs</option>
            <option value="VIDEO">Videos</option>
          </select>
        </label>

        <label className="block w-full min-w-0 lg:w-48">
          <span className="mb-1 block font-label-md text-xs text-on-surface-variant">Review status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block min-h-11 w-full max-w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm font-label-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
      </div>

      {actionError && (
        <p className="text-sm text-error font-body-md mb-4" role="alert">
          {actionError}
        </p>
      )}

      {loading ? (
        <DashboardRowsSkeleton />
      ) : error ? (
        <EmptyState icon="fa-triangle-exclamation" title="Content is unavailable" description={error} />
      ) : filteredPosts.length === 0 ? (
        <EmptyState icon={searchQuery.trim() ? "fa-magnifying-glass" : "fa-file-circle-plus"} title={searchQuery.trim() ? "No content matches your search" : "No content has been created for this website"} description={searchQuery.trim() ? "Try a different title, category, state, tag, type, or status." : "Create an article, blog, or video and it will appear here."} actionHref={searchQuery.trim() ? undefined : "/author/create/article"} actionLabel={searchQuery.trim() ? undefined : "Create Article"} />
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <div
              key={`${post.type}-${post.id}`}
              className="flex flex-col items-stretch gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/20 sm:flex-row sm:items-start"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${TYPE_ICON[post.type]} text-primary`} />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${STATUS_BADGE[post.status]}`}>
                    {post.status === "PENDING" && post.scheduled_publish_at && new Date(post.scheduled_publish_at) > new Date() ? "SCHEDULED" : post.status}
                  </span>
                  {post.scheduled_publish_at && (
                    <span className="text-[10px] font-body-md text-on-surface-variant">
                      <i className="fa-solid fa-clock mr-1" />{new Date(post.scheduled_publish_at).toLocaleString()}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${AI_BADGE[post.ai_status]}`}>
                    AI: {post.ai_status.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-label-md text-on-surface-variant uppercase">{post.type}</span>
                </div>
                <h3 className="break-words font-headline-md text-base text-on-surface sm:truncate">{post.title}</h3>
                {(post.excerpt || post.description) && (
                  <p className="font-body-md text-sm text-on-surface-variant line-clamp-2 mt-1">
                    {post.excerpt || richTextToPlainText(post.description)}
                  </p>
                )}
                {post.ai_notes && (
               
                  <p className="font-body-md text-xs text-amber-700 mt-1">
                    <i className="fa-solid fa-triangle-exclamation mr-1" />
                    {post.ai_notes}
                  </p>
                )}
                {post.review_notes && (
                  <p className="font-body-md text-xs text-on-surface-variant mt-1 italic">Editor note: {post.review_notes}</p>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-shrink-0">
                <div className="grid grid-cols-3 gap-2 sm:flex">
                  <Link
                    href={`/author/view/${post.type.toLowerCase()}/${post.id}`}
                    className="px-2 py-2 text-center text-xs font-label-md border border-outline-variant/40 rounded hover:border-primary hover:text-primary transition-colors sm:px-3 sm:py-1.5"
                  >
                    View
                  </Link>
                  <Link
                    href={`/author/edit/${post.type.toLowerCase()}/${post.id}`}
                    className="px-2 py-2 text-center text-xs font-label-md border border-outline-variant/40 rounded hover:border-primary hover:text-primary transition-colors sm:px-3 sm:py-1.5"
                  >
                    Edit
                  </Link>
                  {post.status !== "APPROVED" && (
                  <button
                    onClick={() => setDeleteTarget(post)}
                    className="px-2 py-2 text-center text-xs font-label-md border border-error/40 text-error rounded hover:bg-error hover:text-on-error transition-colors sm:px-3 sm:py-1.5"
                  >
                    Delete
                  </button>
                  )}
                </div>
                {["DRAFT", "REJECTED"].includes(post.status) && (
                  <button
                    onClick={() => handleSubmit(post)}
                    disabled={aiCheckingId != null}
                    className="px-3 py-1.5 text-xs font-label-md bg-primary text-on-primary rounded hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Submit for Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReasonModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this post?"
        description="This content item will be moved to Deleted Items. It can be restored later from Deleted Items."
        confirmLabel="Delete"
        placeholder="Why is this being deleted?"
        danger
        required="true"
      />
    </>
  );

  if (compact) return content;

  return <div className="max-w-full mx-auto px-4 md:px-16 py-10">{content}</div>;
}
