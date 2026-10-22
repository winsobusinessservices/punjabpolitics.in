"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authorApi, mediaUrl } from "@/lib/api";
import { deriveExternalThumbnail } from "@/lib/videoThumbnail";
import AiCheckLoader from "@/components/common/AiCheckLoader";
import ReasonModal from "@/components/common/ReasonModal";
import { resolveBackTarget } from "@/lib/postNav";
import { ArticleBodySkeleton } from "@/components/common/PageSkeletons";
import { splitContentMedia } from "@/lib/contentMedia";
import PostBody from "@/components/common/PostBody";

const MODERATOR_ROLES = ["EDITOR", "ADMIN"];

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

const TYPE_LABEL = { ARTICLE: "article", BLOG: "blog", VIDEO: "video" };

export default function ViewPostClient({ type, id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const backTarget = resolveBackTarget(fromParam);
  const { user } = useAuth();
  const isModerator = MODERATOR_ROLES.includes(user?.role);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [aiChecking, setAiChecking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const contentMedia = splitContentMedia(post?.content);

  // `loading` already starts true, so the effect only needs to flip it back
  // (from an async callback, not synchronously) — nothing here re-fetches,
  // so there's no separate retry entry point that would need its own
  // setLoading(true).
  useEffect(() => {
    authorApi
      .getPost(type, id)
      .then((data) => setPost(data.post))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [type, id]);

  const handleDelete = async (reason) => {
    setActionError("");
    await authorApi.deletePost(post.type, post.id, reason);
    setDeleteOpen(false);
    router.push(backTarget.href);
  };

  const handleSubmit = async () => {
    setActionError("");
    setAiChecking(true);
    try {
      const data = await authorApi.submitPost(post.type, post.id);
      setPost(data.post);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAiChecking(false);
    }
  };

  const handleApprove = async () => {
    setActionError("");
    try {
      const data = await authorApi.reviewPost(post.type, post.id, { action: "APPROVE" });
      setPost(data.post);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleReject = async (notes) => {
    const data = await authorApi.reviewPost(post.type, post.id, { action: "REJECT", notes });
    setPost(data.post);
    setRejectOpen(false);
  };

  if (loading) {
    return <ArticleBodySkeleton />;
  }

  if (error || !post) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <i className="fa-solid fa-triangle-exclamation text-4xl text-error mb-4" />
        <h1 className="font-display-lg text-2xl text-primary mb-2">Post Not Found</h1>
        <p className="font-body-md text-on-surface-variant mb-6">
          {error || "This post doesn't exist or you don't have access to it."}
        </p>
        <Link
          href={backTarget.href}
          className="inline-block bg-primary text-on-primary px-6 py-2 font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors"
        >
          {backTarget.label}
        </Link>
      </div>
    );
  }

  const isVideoUpload = post.type === "VIDEO" && post.video_url?.startsWith("/uploads/");
  // Falls back to the provider's own thumbnail for a post saved before
  // auto-derivation existed, instead of a bare icon placeholder.
  const externalThumbnail =
    post.type === "VIDEO" && !isVideoUpload
      ? post.thumbnail
        ? mediaUrl(post.thumbnail)
        : deriveExternalThumbnail(post.video_url)
      : null;

  return (
    <div className="max-w-full mx-auto px-4 md:px-16 py-10">
      {aiChecking && <AiCheckLoader />}
      <Link
        href={backTarget.href}
        className="inline-flex items-center gap-1.5 text-xs font-label-md text-on-surface-variant hover:text-primary transition-colors mb-6"
      >
        <i className="fa-solid fa-arrow-left" /> {backTarget.label}
      </Link>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase ${STATUS_BADGE[post.status]}`}>
          {post.status}
        </span>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase ${AI_BADGE[post.ai_status]}`}>
          AI: {post.ai_status.replace("_", " ")}
        </span>
        <span className="text-[10px] font-label-md text-on-surface-variant uppercase flex items-center gap-1.5">
          <i className={`fa-solid ${TYPE_ICON[post.type]}`} /> {post.type}
        </span>
      </div>

      <h1 className="font-display-lg font-bold text-3xl md:text-4xl text-on-surface tracking-tight leading-tight mb-4">
        {post.title}
      </h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-on-surface-variant font-label-md mb-8 pb-6 border-b border-outline-variant/30">
        {post.category && (
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-folder-open text-primary" /> {post.category}
          </span>
        )}
        {post.state && (
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-location-dot text-primary" /> {post.state}
          </span>
        )}
        <span className="flex items-center gap-2">
          <i className="fa-regular fa-calendar text-primary" /> Created {new Date(post.created_at).toLocaleDateString()}
        </span>
        {post.submitted_at && (
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-paper-plane text-primary" /> Submitted{" "}
            {new Date(post.submitted_at).toLocaleDateString()}
          </span>
        )}
        {post.reviewed_at && (
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-gavel text-primary" /> Reviewed {new Date(post.reviewed_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Media */}
      {post.type === "VIDEO" ? (
        <div className="mb-8">
          {isVideoUpload ? (
            <video controls poster={post.thumbnail ? mediaUrl(post.thumbnail) : undefined} className="w-full aspect-video rounded-xl bg-black">
              <source src={mediaUrl(post.video_url)} />
            </video>
          ) : (
            <a
              href={post.video_url}
              target="_blank"
              rel="noreferrer"
              className="relative flex w-full aspect-video rounded-xl overflow-hidden group bg-primary/10"
            >
              {externalThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={externalThumbnail} alt={post.title} className="w-full h-full object-cover" />
              ) : (
                <i className="fa-solid fa-video text-5xl text-primary m-auto" />
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <i className="fa-solid fa-circle-play text-white text-6xl opacity-90 group-hover:scale-110 transition-transform" />
              </div>
            </a>
          )}
        </div>
      ) : (
        post.featured_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(post.featured_image)}
            alt={post.title}
            className="block mx-auto w-1/2 aspect-[16/9] md:h-[420px] md:aspect-auto object-cover rounded-xl mb-8"
          />
        )
      )}

      {/* Body */}
      <div className="space-y-4 mb-8">
        {post.excerpt && (
          <p className="font-body-lg text-on-surface leading-relaxed italic whitespace-pre-wrap break-words">{post.excerpt}</p>
        )}
        {!post.excerpt && post.description && <PostBody content={post.description} className="space-y-4" />}
        {contentMedia.text && (
          <PostBody content={contentMedia.text} className="space-y-4" />
        )}
        {contentMedia.images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {contentMedia.images.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={mediaUrl(url)} alt={`${post.title} — image ${index + 2}`} className="w-full aspect-video object-cover rounded-xl" />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="mb-8">
          <h3 className="font-label-md text-primary text-xs uppercase tracking-widest mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-surface-container-high text-on-surface text-xs font-label-md rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related */}
      {(post.related_politician || post.related_election || post.related_article_id) && (
        <div className="mb-8 flex flex-wrap gap-3">
          {post.related_politician && (
            <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm">
              <i className="fa-solid fa-user-tie text-primary mr-2" />
              {post.related_politician}
            </span>
          )}
          {post.related_election && (
            <span className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm">
              <i className="fa-solid fa-vote-yea text-primary mr-2" />
              {post.related_election}
            </span>
          )}
          {post.related_article_id && (
            <Link
              href={`/author/view/article/${post.related_article_id}`}
              className="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm hover:bg-primary hover:text-on-primary transition-colors"
            >
              <i className="fa-solid fa-link mr-2" />
              View Related Article
            </Link>
          )}
        </div>
      )}

      {/* AI Review — grammar/quality check that ran on submit. Advisory
          only: the editor still makes the actual approve/reject call. */}
      {(post.ai_summary ||
        post.ai_quality_score != null ||
        post.ai_grammar_issues?.length > 0 ||
        post.ai_spelling_issues?.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-label-md text-primary text-xs uppercase tracking-widest">AI Review</h3>
            <div className="flex items-center gap-2">
              {post.ai_language && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-sm bg-surface-container-high text-on-surface">
                  <i className="fa-solid fa-language mr-1.5" />
                  {post.ai_language}
                  {post.ai_language_confidence != null && ` (${Math.round(post.ai_language_confidence * 100)}%)`}
                </span>
              )}
              {post.ai_quality_score != null && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-sm bg-surface-container-high text-on-surface">
                  Quality: {post.ai_quality_score}/100
                </span>
              )}
            </div>
          </div>

          {post.ai_summary && (
            <p className="font-body-md text-sm text-on-surface-variant italic mb-3">
              <i className="fa-solid fa-robot mr-2" />
              {post.ai_summary}
            </p>
          )}

          {post.ai_grammar_issues?.length > 0 && (
            <div className="mb-3">
              <h4 className="font-label-md text-xs text-on-surface-variant uppercase tracking-wide mb-2">Grammar</h4>
              <div className="space-y-2">
                {post.ai_grammar_issues.map((issue, index) => (
                  <div key={index} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <p className="text-amber-900">
                      <span className="line-through text-amber-700">{issue.original}</span>
                      {" → "}
                      <span className="font-semibold">{issue.correction}</span>
                    </p>
                    {issue.explanation && <p className="text-xs text-amber-700 mt-1">{issue.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {post.ai_spelling_issues?.length > 0 && (
            <div className="mb-3">
              <h4 className="font-label-md text-xs text-on-surface-variant uppercase tracking-wide mb-2">Spelling</h4>
              <div className="space-y-2">
                {post.ai_spelling_issues.map((issue, index) => (
                  <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="text-blue-900">
                      <span className="line-through text-blue-700">{issue.original}</span>
                      {" → "}
                      <span className="font-semibold">{issue.correction}</span>
                    </p>
                    {issue.reason && <p className="text-xs text-blue-700 mt-1">{issue.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {post.ai_corrected_content && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-label-md text-primary hover:underline list-none flex items-center gap-1.5">
                <i className="fa-solid fa-chevron-right text-xs group-open:rotate-90 transition-transform" />
                View AI-suggested corrected version
              </summary>
              <div className="mt-3 p-4 bg-surface-container-low border border-outline-variant/30 rounded-lg font-body-md text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {post.ai_corrected_content}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Notes */}
      {post.ai_notes && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-body-md text-sm text-amber-800">
            <i className="fa-solid fa-robot mr-2" />
            <strong>AI check:</strong> {post.ai_notes}
          </p>
        </div>
      )}
      {post.review_notes && (
        <div className="mb-8 p-4 bg-surface-container-low border border-outline-variant/30 rounded-lg">
          <p className="font-body-md text-sm text-on-surface-variant">
            <i className="fa-solid fa-comment-dots mr-2 text-primary" />
            <strong>Editor note:</strong> {post.review_notes}
          </p>
        </div>
      )}

      {actionError && (
        <p className="text-sm text-error font-body-md mb-4" role="alert">
          {actionError}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-6 border-t border-outline-variant/30">
        {(post.author_id === user?.id || user?.role === "ADMIN") && (
          <Link
            href={`/author/edit/${post.type.toLowerCase()}/${post.id}${fromParam ? `?from=${fromParam}` : ""}`}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md border border-outline-variant/40 rounded hover:border-primary hover:text-primary transition-colors"
          >
            <i className="fa-solid fa-pen" /> Edit
          </Link>
        )}
        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md border border-error/40 text-error rounded hover:bg-error hover:text-on-error transition-colors"
        >
          <i className="fa-solid fa-trash" /> Delete
        </button>
        {post.author_id === user?.id && ["DRAFT", "REJECTED"].includes(post.status) && (
          <button
            onClick={handleSubmit}
            disabled={aiChecking}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md bg-primary text-on-primary rounded hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-paper-plane" /> Submit for Review
          </button>
        )}
        {isModerator &&
          post.status === "PENDING" &&
          (user?.role === "ADMIN" || post.author_role === "AUTHOR" ? (
            <>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <i className="fa-solid fa-check" /> Approve &amp; Publish
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md bg-yellow-500 text-black rounded hover:bg-yellow-600 transition-colors"
              >
                <i className="fa-solid fa-rotate-left" /> Send for Changes
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 px-5 py-2.5 text-sm font-label-md text-on-surface-variant">
              <i className="fa-solid fa-lock" /> Requires admin review
            </p>
          ))}
      </div>

      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Send for changes"
        description="This note is sent to the author explaining what needs to change before this can be approved."
        confirmLabel="Send for Changes"
        placeholder="What needs to change?"
        required="true"
      />

      <ReasonModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete this ${TYPE_LABEL[post?.type] || "content item"}?`}
        description={`This ${TYPE_LABEL[post?.type] || "content item"} will be moved to Deleted Items. It can be restored later from Deleted Items.`}
        confirmLabel="Delete"
        placeholder="Why is this being deleted?"
        required="true"
        danger
      />
    </div>
  );
}
