"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authorApi } from "@/lib/api";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import { richTextToPlainText } from "@/lib/richText";
import EmptyState from "@/components/common/EmptyState";

const STATUS_BADGE = {
  DRAFT: "bg-outline-variant text-on-surface",
  PENDING: "bg-yellow-500 text-black",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-error text-on-error",
  SCHEDULED: "bg-blue-600 text-white",
};

function displayStatus(post) {
  return post.status === "PENDING" && post.scheduled_publish_at ? "SCHEDULED" : post.status;
}

const TYPE_ICON = {
  ARTICLE: "fa-newspaper",
  BLOG: "fa-pen-nib",
  VIDEO: "fa-video",
};

/**
 * Moderator-only — every author's content, every status, backed by
 * GET /:resource/history (never the self-scoped GET /:resource that
 * MyPostsClient uses). Type/status are server-side filters; author and date
 * are filtered client-side over the already-fetched set, same pattern
 * MyPostsClient/ReviewQueueClient already use for their own filters.
 */
export default function ContentHistoryClient() {
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Reset request state whenever the server-side filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const filters = { status: statusFilter };
    const request = typeFilter
      ? authorApi.listHistoryByType(typeFilter, filters).then((data) => data.posts)
      : authorApi.listAllHistory(filters);

    request
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  const authors = useMemo(
    () => Array.from(new Set(posts.map((post) => post.author_name).filter(Boolean))).sort(),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (authorFilter && post.author_name !== authorFilter) return false;
      const created = post.created_at ? new Date(post.created_at) : null;
      if (dateFrom && created && created < new Date(dateFrom)) return false;
      if (dateTo && created && created > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [posts, authorFilter, dateFrom, dateTo]);

  return (
    <div className="max-w-full mx-auto px-4 md:px-16 py-10">
      <h1 className="font-display-lg text-3xl text-primary mb-2">Content History</h1>
      <p className="font-body-md text-on-surface-variant mb-8">
        Every article, blog, and video from every author, at every stage of the review workflow.
      </p>

      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-outline-variant/40 rounded px-3 py-2 text-sm font-label-md bg-surface text-on-surface"
        >
          <option value="">All Types</option>
          <option value="ARTICLE">Articles</option>
          <option value="BLOG">Blogs</option>
          <option value="VIDEO">Videos</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-outline-variant/40 rounded px-3 py-2 text-sm font-label-md bg-surface text-on-surface"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="border border-outline-variant/40 rounded px-3 py-2 text-sm font-label-md bg-surface text-on-surface"
        >
          <option value="">All Authors</option>
          {authors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="border border-outline-variant/40 rounded px-3 py-2 text-sm font-label-md bg-surface text-on-surface"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="border border-outline-variant/40 rounded px-3 py-2 text-sm font-label-md bg-surface text-on-surface"
        />
      </div>

      {loading ? (
        <DashboardRowsSkeleton />
      ) : error ? (
        <EmptyState icon="fa-triangle-exclamation" title="Content history is unavailable" description={error} />
      ) : filteredPosts.length === 0 ? (
        <EmptyState icon="fa-clock-rotate-left" title={posts.length ? "No content matches these filters" : "No content history for this website"} description={posts.length ? "Change or clear the type, status, author, or date filters." : "Created and reviewed content will appear here."} />
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <div
              key={`${post.type}-${post.id}`}
              className="flex items-start gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/20"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${TYPE_ICON[post.type]} text-primary`} />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${STATUS_BADGE[displayStatus(post)]}`}>
                    {displayStatus(post)}
                  </span>
                  <span className="text-[10px] font-label-md text-on-surface-variant uppercase">{post.type}</span>
                  {post.author_name && (
                    <span className="text-[10px] font-body-md text-on-surface-variant">
                      by {post.author_name}
                      {post.author_role && post.author_role !== "AUTHOR" && ` (${post.author_role})`}
                    </span>
                  )}
                  {post.created_at && (
                    <span className="text-[10px] font-body-md text-on-surface-variant">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {post.scheduled_publish_at && (
                    <span className="text-[10px] font-body-md text-blue-700">
                      <i className="fa-solid fa-calendar-clock mr-1" />Publishes {new Date(post.scheduled_publish_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <h3 className="font-headline-md text-base text-on-surface truncate">{post.title}</h3>
                {(post.excerpt || post.description) && (
                  <p className="font-body-md text-sm text-on-surface-variant line-clamp-2 mt-1">
                    {post.excerpt || richTextToPlainText(post.description)}
                  </p>
                )}
                {post.reviewer_name && (
                  <p className="font-body-md text-xs text-on-surface-variant mt-1">
                    Reviewed by <span className="font-label-md">{post.reviewer_name}</span>
                    {post.reviewed_at && ` on ${new Date(post.reviewed_at).toLocaleDateString()}`}
                  </p>
                )}
                {post.review_notes && (
                  <p className="font-body-md text-xs text-on-surface-variant mt-1 italic">Note: {post.review_notes}</p>
                )}
              </div>
              <Link
                href={`/author/view/${post.type.toLowerCase()}/${post.id}?from=history`}
                className="px-3 py-1.5 text-xs font-label-md border border-outline-variant/40 rounded hover:border-primary hover:text-primary transition-colors flex-shrink-0"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
