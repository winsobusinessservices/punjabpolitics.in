"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { commentsApi } from "@/lib/api";
import { checkCommentContent } from "@/lib/commentModeration";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";

const MAX_COMMENT_LENGTH = 1000;
const INITIAL_COMMENT_COUNT = 4;

function initials(name) {
  return String(name || "Reader")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

function commentDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CommentSection({ postSlug, commentsEnabled = true }) {
  const { user, loading: authLoading } = useAuth();
  const confirmDelete = useConfirmDialog();
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  useEffect(() => {
    let active = true;
    if (authLoading || !commentsEnabled) return () => { active = false; };
    queueMicrotask(() => {
      if (active) {
        setReady(false);
        setShowAllComments(false);
      }
    });
    commentsApi.listForPost(postSlug)
      .then((data) => { if (active) setComments(data.comments || []); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setReady(true); });
    return () => {
      active = false;
    };
  }, [postSlug, commentsEnabled, authLoading, user?.id]);

  const submitComment = async (event) => {
    event.preventDefault();
    const content = message.trim();
    if (!content) {
      setError("Write a comment before posting.");
      return;
    }

    const moderation = checkCommentContent(content);
    if (!moderation.isAllowed) {
      setError(moderation.message);
      setNotice("");
      return;
    }

    setSubmitting(true);
    try {
      const data = await commentsApi.create(postSlug, content);
      setComments((current) => [data.comment, ...current]);
      setMessage("");
      setError("");
      setNotice("Your comment passed the safety check and was posted.");
    } catch (submitError) {
      setError(submitError.message);
      setNotice("");
    } finally {
      setSubmitting(false);
    }
  };

  const publicCommentCount = comments.filter((comment) => comment.status === "VISIBLE").length;
  const visibleComments = comments.filter((comment) => (
    comment.status === "VISIBLE"
    || (user && comment.status === "HIDDEN" && String(comment.authorId) === String(user.id))
  ));
  const commentsExpanded = showAllComments && visibleComments.length > INITIAL_COMMENT_COUNT;
  const displayedComments = commentsExpanded
    ? visibleComments
    : visibleComments.slice(0, INITIAL_COMMENT_COUNT);

  const removeComment = async (comment) => {
    const isOwnComment = String(comment.authorId) === String(user?.id);
    const confirmed = await confirmDelete({
      title: isOwnComment ? "Delete your comment?" : "Delete this comment?",
      description: "The comment will be removed from this discussion.",
    });
    if (!confirmed) return;
    try {
      await commentsApi.remove(comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  if (!commentsEnabled) return null;

  return (
    <section className="mt-12 border-t border-outline-variant/30 pt-8" aria-labelledby="comments-heading">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-label-md text-xs uppercase tracking-widest text-secondary">Join the discussion</p>
          <h2 id="comments-heading" className="mt-1 font-display-lg text-2xl text-primary md:text-3xl">
            Comments <span className="align-middle font-label-md text-sm text-on-surface-variant">({publicCommentCount})</span>
          </h2>
        </div>
        <i className="fa-regular fa-comments text-3xl text-primary/25" aria-hidden="true" />
      </div>

      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5">
        {authLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-surface-container-high" aria-label="Loading comment form" />
        ) : user ? (
          <form onSubmit={submitComment}>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary font-label-md text-xs font-bold text-on-primary">
                {initials(user.name)}
              </span>
              <div>
                <p className="font-label-md text-sm font-semibold text-on-surface">{user.name || "Reader"}</p>
                <p className="text-[11px] text-on-surface-variant">Share a respectful, relevant response.</p>
              </div>
            </div>
            <label htmlFor="article-comment" className="sr-only">Write a comment</label>
            <textarea
              id="article-comment"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                if (error) setError("");
                if (notice) setNotice("");
              }}
              maxLength={MAX_COMMENT_LENGTH}
              rows={4}
              placeholder="What are your thoughts?"
              className="w-full resize-y rounded-lg border border-outline-variant/50 bg-surface px-4 py-3 font-body-md text-sm leading-relaxed text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                {error && <p className="font-body-md text-xs text-error" role="alert">{error}</p>}
                {/* {!error && notice && <p className="font-body-md text-xs font-semibold text-primary" role="status">{notice}</p>} */}
                {/* {!error && !notice && <p className="font-body-md text-[11px] text-on-surface-variant">Comments are checked for abusive and prohibited language before posting.</p>} */}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-label-md text-[11px] text-on-surface-variant">{message.length}/{MAX_COMMENT_LENGTH}</span>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-label-md text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">
                  <i className={`fa-regular ${submitting ? "fa-hourglass-half" : "fa-paper-plane"} text-xs`} aria-hidden="true" /> {submitting ? "Checking..." : "Post comment"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-headline-md text-base text-on-surface">Sign in to comment</h3>
              <p className="mt-1 font-body-md text-sm text-on-surface-variant">Join the conversation using your Punjab Politics account.</p>
            </div>
            <Link href="/login" className="inline-flex flex-none items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-label-md text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container">
              Sign in <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      <div className={`mt-7 space-y-5 ${commentsExpanded ? "max-h-[32rem] overflow-y-auto pr-2" : ""}`} aria-live="polite">
        {!ready ? (
          <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
        ) : visibleComments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant/50 px-5 py-8 text-center">
            <i className="fa-regular fa-message mb-3 text-2xl text-primary/35" aria-hidden="true" />
            <p className="font-headline-md text-base text-on-surface">No comments yet</p>
            <p className="mt-1 font-body-md text-sm text-on-surface-variant">Be the first reader to share a thoughtful response.</p>
          </div>
        ) : (
          displayedComments.map((comment) => {
            const canDelete = Boolean(user && comment.canDelete);
            return (
              <article key={comment.id} className="flex gap-3 border-b border-outline-variant/25 pb-5 sm:gap-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary-fixed font-label-md text-xs font-bold text-on-primary-fixed">
                  {initials(comment.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-label-md text-sm font-bold text-on-surface">{comment.author}</h3>
                      <time className="font-body-md text-[11px] text-on-surface-variant" dateTime={comment.createdAt}>{commentDate(comment.createdAt)}</time>
                      {comment.status === "HIDDEN" && <span className="ml-2 rounded-full bg-secondary-fixed px-2 py-0.5 font-label-md text-[10px] font-bold uppercase tracking-wide text-on-secondary-fixed">Hidden by admin</span>}
                    </div>
                    {canDelete && (
                      <button type="button" onClick={() => removeComment(comment)} className="rounded px-2 py-1 font-label-md text-xs text-on-surface-variant transition-colors hover:bg-error-container hover:text-error" aria-label={String(comment.authorId) === String(user.id) ? "Delete your comment" : `Delete comment by ${comment.author}`}>
                        <i className="fa-regular fa-trash-can mr-1" aria-hidden="true" /> Delete
                      </button>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words font-body-md text-sm leading-relaxed text-on-surface-variant">{comment.content}</p>
                </div>
              </article>
            );
          })
        )}
      </div>

      {ready && visibleComments.length > INITIAL_COMMENT_COUNT && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllComments((current) => !current)}
            aria-expanded={commentsExpanded}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-surface px-5 py-2.5 font-label-md text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <i className={`fa-solid ${commentsExpanded ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`} aria-hidden="true" />
            {commentsExpanded ? "Show fewer comments" : `View all ${visibleComments.length} comments`}
          </button>
        </div>
      )}
    </section>
  );
}
