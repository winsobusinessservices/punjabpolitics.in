"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authorApi, commentsApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";

const FILTERS = ["ALL", "VISIBLE", "HIDDEN"];
const COMMENTS_PER_PAGE = 7;
const STATUS_STYLE = {
  VISIBLE: "bg-green-100 text-green-800",
  HIDDEN: "bg-secondary-fixed text-on-secondary-fixed",
};

function formattedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CommentModerationClient() {
  const confirmDelete = useConfirmDialog();
  const [comments, setComments] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postSearch, setPostSearch] = useState("");
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [settingPostId, setSettingPostId] = useState(null);
  const [commentsError, setCommentsError] = useState("");

  useEffect(() => {
    commentsApi.listForAdmin()
      .then((data) => setComments(data.comments || []))
      .catch((error) => setCommentsError(error.message))
      .finally(() => setReady(true));

    authorApi.listAllHistory({ status: "APPROVED" })
      .then((items) => {
        const uniquePosts = Array.from(
          new Map(items.filter((post) => post.slug).map((post) => [post.slug, post])).values()
        );
        setPosts(uniquePosts);
      })
      .catch((error) => setPostsError(error.message))
      .finally(() => setPostsLoading(false));
  }, []);

  const filteredPosts = useMemo(() => {
    const query = postSearch.trim().toLocaleLowerCase();
    if (!query) return posts;
    return posts.filter((post) => [post.title, post.slug, post.type]
      .some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [posts, postSearch]);

  const toggleComments = async (post) => {
    const enabled = post.comments_enabled !== 0 && post.comments_enabled !== false;
    setPostsError("");
    setSettingPostId(`${post.type}:${post.id}`);
    try {
      const data = await authorApi.setCommentsEnabled(post.type, post.id, !enabled);
      setPosts((current) => current.map((item) => (
        item.type === post.type && item.id === post.id ? data.post : item
      )));
    } catch (error) {
      setPostsError(error.message);
    } finally {
      setSettingPostId(null);
    }
  };

  const totals = useMemo(() => ({
    ALL: comments.length,
    VISIBLE: comments.filter((comment) => comment.status === "VISIBLE").length,
    HIDDEN: comments.filter((comment) => comment.status === "HIDDEN").length,
  }), [comments]);

  const visibleComments = useMemo(() => {
    const statusMatches = filter === "ALL" ? comments : comments.filter((comment) => comment.status === filter);
    const query = search.trim().toLocaleLowerCase();
    if (!query) return statusMatches;
    return statusMatches.filter((comment) =>
      [comment.author, comment.content, comment.postTitle, comment.postSlug]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query))
    );
  }, [comments, filter, search]);

  const totalPages = Math.max(1, Math.ceil(visibleComments.length / COMMENTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * COMMENTS_PER_PAGE;
  const paginatedComments = visibleComments.slice(pageStart, pageStart + COMMENTS_PER_PAGE);

  const setVisibility = async (commentId, status) => {
    setCommentsError("");
    try {
      const data = await commentsApi.setHidden(commentId, status === "HIDDEN");
      setComments((current) => current.map((comment) => comment.id === commentId ? data.comment : comment));
      setPage(1);
    } catch (error) {
      setCommentsError(error.message);
    }
  };

  const removeComment = async (comment) => {
    const confirmed = await confirmDelete({
      title: "Delete comment?",
      description: `The comment by ${comment.author} will be moved to Deleted Items. It can be restored later from Deleted Items.`,
    });
    if (!confirmed) return;
    try {
      await commentsApi.remove(comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setPage(1);
    } catch (error) {
      setCommentsError(error.message);
    }
  };

  return (
    <div>
      {commentsError && <p className="mb-6 rounded-lg bg-error-container px-4 py-3 font-body-md text-sm text-on-error-container" role="alert">{commentsError}</p>}

      <section className="mb-8 rounded-xl border border-outline-variant/30 bg-surface p-4 shadow-sm sm:p-5" aria-labelledby="article-comment-settings">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="article-comment-settings" className="font-headline-md text-lg text-on-surface">Comments by article</h2>
            <p className="mt-1 font-body-md text-sm text-on-surface-variant">Enable or disable the complete comment section independently for each published item.</p>
          </div>
          <label className="block w-full sm:max-w-sm">
            <span className="sr-only">Search published articles</span>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant" aria-hidden="true" />
              <input type="search" value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="Search article title or slug..." className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 pl-9 pr-3 font-body-md text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
          </label>
        </div>

        <div className="mt-5 max-h-80 divide-y divide-outline-variant/25 overflow-y-auto rounded-lg border border-outline-variant/30">
          {postsLoading ? (
            <div className="h-24 animate-pulse bg-surface-container-low" aria-label="Loading published articles" />
          ) : postsError ? (
            <p className="p-4 font-body-md text-sm text-error" role="alert">{postsError}</p>
          ) : filteredPosts.length === 0 ? (
            <p className="p-4 font-body-md text-sm text-on-surface-variant">{postSearch ? "No published articles match your search." : "No published articles are available."}</p>
          ) : filteredPosts.map((post) => {
            const enabled = post.comments_enabled !== 0 && post.comments_enabled !== false;
            const isSaving = settingPostId === `${post.type}:${post.id}`;
            return (
              <div key={post.slug} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-label-md text-sm font-semibold text-on-surface">{post.title}</p>
                  <p className="mt-0.5 truncate font-body-md text-xs text-on-surface-variant">{post.type} · /news/{post.slug}</p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className={`font-label-md text-[10px] font-bold uppercase tracking-wide ${enabled ? "text-green-700" : "text-on-surface-variant"}`}>{isSaving ? "Saving" : enabled ? "Enabled" : "Disabled"}</span>
                  <button type="button" role="switch" aria-checked={enabled} disabled={isSaving} onClick={() => toggleComments(post)} className={`relative h-7 w-12 flex-none rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 ${enabled ? "bg-green-700" : "bg-outline"}`} aria-label={`${enabled ? "Disable" : "Enable"} comments for ${post.title}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {FILTERS.map((status) => (
          <button key={status} type="button" onClick={() => { setFilter(status); setPage(1); }} className={`rounded-xl border p-4 text-left transition-colors ${filter === status ? "border-primary bg-primary text-on-primary" : "border-outline-variant/30 bg-surface hover:border-primary/50"}`}>
            <span className="block font-label-md text-[10px] font-semibold uppercase tracking-widest opacity-75">{status === "ALL" ? "All comments" : status}</span>
            <span className="mt-1 block font-display-lg text-2xl">{totals[status]}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <label htmlFor="comment-search" className="sr-only">Search comments</label>
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant" aria-hidden="true" />
          <input
            id="comment-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search name, comment, article or blog..."
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 pl-9 pr-10 font-body-md text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface" aria-label="Clear comment search">
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="flex-none font-label-md text-xs text-on-surface-variant">
          Showing <span className="font-bold text-on-surface">{visibleComments.length}</span> of {filter === "ALL" ? comments.length : totals[filter]}
        </p>
      </div>

      {!ready ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-container-low" />
      ) : visibleComments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface px-6 py-14 text-center">
          <i className="fa-regular fa-comments mb-3 text-3xl text-primary/30" aria-hidden="true" />
          <h2 className="font-headline-md text-lg text-on-surface">{search ? "No comments match your search" : `No ${filter === "ALL" ? "" : `${filter.toLowerCase()} `}comments`}</h2>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">{search ? "Try another name, phrase, article, or blog title." : "Posted reader comments will appear here."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full border-collapse text-left overflow-x-auto">
              <thead className="bg-surface-container-high text-on-surface-variant">
                <tr>
                  <th scope="col" className="px-4 py-3 font-label-md text-[11px] uppercase tracking-wider">Reader</th>
                  <th scope="col" className="px-4 py-3 font-label-md text-[11px] uppercase tracking-wider">Article / Blog</th>
                  <th scope="col" className="w-[32%] px-4 py-3 font-label-md text-[11px] uppercase tracking-wider">Comment</th>
                  <th scope="col" className="px-4 py-3 font-label-md text-[11px] uppercase tracking-wider">Submitted</th>
                  <th scope="col" className="px-4 py-3 font-label-md text-[11px] uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-label-md text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/25">
                {paginatedComments.map((comment) => (
                  <tr key={comment.id} className="align-top transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">
                      <p className="font-label-md text-sm font-bold text-on-surface">{comment.author}</p>
                    </td>
                    <td className="max-w-56 px-4 py-4">
                      <Link href={`/news/${comment.postSlug}`} className="line-clamp-2 font-label-md text-xs font-semibold leading-relaxed text-primary hover:underline" target="_blank">
                        {comment.postTitle || comment.postSlug} <i className="fa-solid fa-arrow-up-right-from-square ml-1 text-[9px]" aria-hidden="true" />
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <p className="line-clamp-3 whitespace-pre-wrap break-words font-body-md text-sm leading-relaxed text-on-surface-variant" title={comment.content}>{comment.content}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-body-md text-xs text-on-surface-variant">{formattedDate(comment.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 font-label-md text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[comment.status]}`}>{comment.status}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1.5">
                        {comment.status === "VISIBLE" ? (
                          <button type="button" onClick={() => setVisibility(comment.id, "HIDDEN")} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-on-secondary hover:opacity-90" title="Hide comment" aria-label={`Hide comment by ${comment.author}`}><i className="fa-regular fa-eye-slash text-xs" /></button>
                        ) : (
                          <button type="button" onClick={() => setVisibility(comment.id, "VISIBLE")} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-green-700 text-white hover:bg-green-800" title="Show comment" aria-label={`Show comment by ${comment.author}`}><i className="fa-regular fa-eye text-xs" /></button>
                        )}
                        <button type="button" onClick={() => removeComment(comment)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-error/40 text-error hover:bg-error-container" title="Delete comment" aria-label={`Delete comment by ${comment.author}`}><i className="fa-regular fa-trash-can text-xs" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav className="flex flex-col items-center justify-between gap-3 border-t border-outline-variant/30 bg-surface-container-low px-4 py-3 sm:flex-row" aria-label="Comment table pagination">
              <p className="font-body-md text-xs text-on-surface-variant">
                Showing {pageStart + 1}–{Math.min(pageStart + COMMENTS_PER_PAGE, visibleComments.length)} of {visibleComments.length} comments
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="inline-flex h-9 items-center gap-1 rounded-md border border-outline-variant/40 px-3 font-label-md text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40">
                  <i className="fa-solid fa-chevron-left text-[9px]" aria-hidden="true" /> Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={currentPage === pageNumber ? "page" : undefined} className={`h-9 min-w-9 rounded-md border px-2 font-label-md text-xs font-bold transition-colors ${currentPage === pageNumber ? "border-primary bg-primary text-on-primary" : "border-outline-variant/40 text-on-surface hover:border-primary"}`}>
                    {pageNumber}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="inline-flex h-9 items-center gap-1 rounded-md border border-outline-variant/40 px-3 font-label-md text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40">
                  Next <i className="fa-solid fa-chevron-right text-[9px]" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
