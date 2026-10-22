const Article = require("../../models/article.model");
const Blog = require("../../models/blog.model");
const Comment = require("../../models/comment.model");
const DeletionAudit = require("../../models/deletionAudit.model");
const UiSection = require("../../models/uiSection.model");
const { checkCommentContent } = require("../../utils/contentModeration");
const { PERMISSIONS } = require("../../config/permissions");

const MAX_COMMENT_LENGTH = 1000;
const managedSiteId = (req) => Number(
  (req.user?.role === "ADMIN" && (req.get("x-management-site-id") || req.query?.siteId || req.body?.siteId))
  || req.user?.siteId
  || req.site?.id
  || 1
);
const commentsEnabled = async (siteId) => (await UiSection.visibilityMap(siteId)).feature_comments !== false;

async function findPublishedPost(slug, siteId = 1) {
  const article = await Article.findPublishedBySlug(slug, siteId);
  if (article) return { type: "ARTICLE", post: article };

  const blog = await Blog.findPublishedBySlug(slug, siteId);
  if (blog) return { type: "BLOG", post: blog };

  return null;
}

function modelForPostType(postType) {
  if (postType === "ARTICLE") return Article;
  if (postType === "BLOG") return Blog;
  return null;
}

async function canDeleteComment(user, comment, resolvedPost = null) {
  if (!user) return false;
  if (user.role === "ADMIN" || user.permissions?.includes(PERMISSIONS.MANAGE_COMMENTS) || Number(comment.authorId) === Number(user.userId)) return true;

  let post = resolvedPost?.post;
  if (!post) {
    const Model = modelForPostType(comment.postType);
    if (!Model) return false;
    post = await Model.findById(comment.postId);
  }

  return Boolean(post) && (
    Number(post.author_id) === Number(user.userId)
    || Number(post.reviewer_id) === Number(user.userId)
  );
}

const listPostComments = async (req, res) => {
  try {
    if (!(await commentsEnabled(req.site.id))) return res.status(200).json({ success: true, comments: [], disabled: true });
    const comments = await Comment.findForPost(req.params.slug, req.user || null, req.site.id);
    const resolvedPost = req.user ? await findPublishedPost(req.params.slug, req.site.id) : null;
    const commentsWithPermissions = await Promise.all(comments.map(async (comment) => ({
      ...comment,
      canDelete: await canDeleteComment(req.user, comment, resolvedPost),
    })));
    return res.status(200).json({ success: true, comments: commentsWithPermissions });
  } catch (error) {
    console.error("List comments error:", error);
    return res.status(500).json({ success: false, message: "Comments could not be loaded" });
  }
};

const createComment = async (req, res) => {
  try {
    if (!(await commentsEnabled(req.site.id))) return res.status(403).json({ success: false, message: "Comments are disabled for this website" });
    const postSlug = String(req.body?.postSlug || "").trim();
    const content = String(req.body?.content || "").trim();
    if (!postSlug) return res.status(400).json({ success: false, message: "Article is required" });
    if (!content) return res.status(400).json({ success: false, message: "Write a comment before posting." });
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, message: `Comments cannot exceed ${MAX_COMMENT_LENGTH} characters.` });
    }

    const moderation = checkCommentContent(content);
    if (!moderation.isAllowed) {
      return res.status(422).json({ success: false, message: moderation.message });
    }

    const resolved = await findPublishedPost(postSlug, req.site.id);
    if (!resolved) return res.status(404).json({ success: false, message: "Published article not found" });
    if (resolved.post.comments_enabled === 0) {
      return res.status(403).json({ success: false, message: "Comments are disabled for this article." });
    }

    const comment = await Comment.create({
      siteId: req.site.id,
      authorId: req.user.userId,
      postType: resolved.type,
      postId: resolved.post.id,
      postSlug: resolved.post.slug,
      postTitle: resolved.post.title,
      content,
    });
    return res.status(201).json({
      success: true,
      message: "Comment posted",
      comment: { ...comment, canDelete: true },
    });
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({ success: false, message: "Comment could not be posted" });
  }
};

const listAllComments = async (req, res) => {
  try {
    const comments = await Comment.findAll(managedSiteId(req));
    return res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error("List all comments error:", error);
    return res.status(500).json({ success: false, message: "Comments could not be loaded" });
  }
};

const updateCommentVisibility = async (req, res) => {
  try {
    if (typeof req.body?.hidden !== "boolean") {
      return res.status(400).json({ success: false, message: "hidden must be true or false" });
    }
    const siteId = managedSiteId(req);
    const existing = await Comment.findById(req.params.id, siteId);
    if (!existing) return res.status(404).json({ success: false, message: "Comment not found" });

    const comment = await Comment.setHidden(existing.id, req.body.hidden, req.user.userId, siteId);
    return res.status(200).json({
      success: true,
      message: req.body.hidden ? "Comment hidden" : "Comment shown",
      comment,
    });
  } catch (error) {
    console.error("Update comment visibility error:", error);
    return res.status(500).json({ success: false, message: "Comment visibility could not be updated" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const siteId = managedSiteId(req);
    const comment = await Comment.findById(req.params.id, siteId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
    if (!(await canDeleteComment(req.user, comment))) {
      return res.status(403).json({
        success: false,
        message: "Only the commenter, article author, approving editor, or an administrator can delete this comment",
      });
    }

    await DeletionAudit.softDelete({
      entityType: "COMMENT",
      entityId: comment.id,
      deletedBy: req.user.userId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ success: true, message: "Comment moved to deleted items" });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({ success: false, message: "Comment could not be deleted" });
  }
};

module.exports = {
  listPostComments,
  createComment,
  listAllComments,
  updateCommentVisibility,
  deleteComment,
};
