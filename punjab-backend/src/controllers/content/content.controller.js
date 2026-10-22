// Handlers for /articles, /blogs, /videos. Each has its own table/model
// (different required fields per type), but the same workflow: create ->
// DRAFT -> submit -> AI check -> editor review -> APPROVED/REJECTED.
// `req.contentType` (ARTICLE/BLOG/VIDEO) is set by content.routes.js.
const Article = require("../../models/article.model");
const Blog = require("../../models/blog.model");
const Video = require("../../models/video.model");
const DeletionAudit = require("../../models/deletionAudit.model");
const User = require("../../models/user.model");
const { fileUrl } = require("../../middleware/upload.middleware");
const { deriveExternalThumbnail } = require("../../utils/videoThumbnail");
const { joinContentMedia } = require("../../utils/contentMedia");
const { sanitizeRichText } = require("../../utils/richText");
const { creditContentReward, creditEditorReviewReward } = require("../../services/walletRewards.service");
const { sendError } = require("../../utils/httpError");

const { PERMISSIONS } = require("../../config/permissions");
const isModerator = (user) => user.role === "ADMIN" || user.permissions?.includes(PERMISSIONS.REVIEW_CONTENT);

const MODEL = { ARTICLE: Article, BLOG: Blog, VIDEO: Video };
const TYPE_LABEL = { ARTICLE: "Article", BLOG: "Blog", VIDEO: "Video" };

function managedContentSiteId(req) {
  if (req.user.role !== "ADMIN") return Number(req.user.siteId);
  const requested = Number(req.get("x-management-site-id") || req.query?.siteId || req.body?.siteId || req.user.siteId);
  return Number.isInteger(requested) && requested > 0 ? requested : Number(req.user.siteId);
}

// Manager rule: a creator's content belongs to their assigned manager (Editor or
// Subadmin) and to Admins. Creators with no manager are handled by Admins and
// Subadmins only; Editors never see unassigned creators.
async function canAccessAuthor(user, authorId) {
  if (!["EDITOR", "SUBADMIN"].includes(user.role)) return true;
  const managerId = await User.getManagerId(authorId);
  if (managerId !== null) return managerId === Number(user.userId);
  return user.role === "SUBADMIN";
}

// Each type has different required fields and a different subset of the
// request body maps onto its model's create/update payload.
const REQUIRED_FIELDS = {
  ARTICLE: ["title", "excerpt", "content", "featuredImage", "category"],
  BLOG: ["title", "content", "featuredImage", "category"],
  VIDEO: ["title", "description", "videoSource", "videoUrl", "thumbnail", "category"],
};

// Uploaded files (multer, keyed by field name) win over any same-named body
// field. On create there's no body fallback, so the field is simply empty
// and required-field validation catches it. On edit, the frontend sends the
// post's *existing* path as that body field when the author didn't pick a
// new file, so the image/video is preserved instead of getting wiped out.
function pickFile(files, field) {
  return files?.[field]?.[0];
}

function orUndefined(value) {
  return value || undefined;
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

function parseImageUrls(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractFields(type, body, files = {}) {
  const tags = parseTags(body.tags);

  if (type === "ARTICLE") {
    const { title, excerpt, content, category } = body;
    const featuredImageFile = pickFile(files, "featuredImage");
    const featuredImage = featuredImageFile ? fileUrl(type, featuredImageFile) : body.featuredImage;
    return {
      title,
      excerpt,
      content: joinContentMedia(sanitizeRichText(content), [
        ...parseImageUrls(body.existingAdditionalImages),
        ...(files.additionalImages || []).map((file) => fileUrl(type, file)),
      ]),
      featuredImage,
      category,
      state: orUndefined(body.state),
      tags,
      relatedPolitician: orUndefined(body.relatedPolitician),
      relatedElection: orUndefined(body.relatedElection),
    };
  }
  if (type === "BLOG") {
    const { title, content, category } = body;
    const featuredImageFile = pickFile(files, "featuredImage");
    const featuredImage = featuredImageFile ? fileUrl(type, featuredImageFile) : body.featuredImage;
    return {
      title,
      excerpt: orUndefined(body.excerpt),
      content: joinContentMedia(sanitizeRichText(content), [
        ...parseImageUrls(body.existingAdditionalImages),
        ...(files.additionalImages || []).map((file) => fileUrl(type, file)),
      ]),
      featuredImage,
      category,
      tags,
      relatedArticleId: orUndefined(body.relatedArticleId),
    };
  }
  // VIDEO
  const { title, description, videoSource, category } = body;
  const videoFile = pickFile(files, "videoFile");
  const videoUrl = videoSource === "UPLOAD" && videoFile ? fileUrl(type, videoFile) : body.videoUrl;
  const thumbnailFile = pickFile(files, "thumbnail");
  // An author linking a YouTube/Vimeo video isn't required to also upload a
  // thumbnail — fall back to the provider's own thumbnail, derived straight
  // from the URL, before the required-field check below runs. An UPLOAD
  // video has no URL to derive from, so it still needs a manual thumbnail.
  const thumbnail = thumbnailFile ? fileUrl(type, thumbnailFile) : body.thumbnail || deriveExternalThumbnail(videoUrl);
  return {
    title,
    description: sanitizeRichText(description),
    videoSource,
    videoUrl,
    thumbnail,
    category,
    state: orUndefined(body.state),
    tags,
    relatedArticleId: orUndefined(body.relatedArticleId),
    relatedPolitician: orUndefined(body.relatedPolitician),
  };
}

function validateRequired(type, fields) {
  const missing = REQUIRED_FIELDS[type].filter((key) => !fields[key]);
  if (missing.length) {
    return `Missing required field(s): ${missing.join(", ")}`;
  }
  return null;
}

function requiredFieldErrors(type, fields) {
  const labels = { title: "Title", excerpt: "Excerpt", content: "Content", featuredImage: "Featured image", category: "Category", description: "Description", videoSource: "Video source", videoUrl: "Video URL or file", thumbnail: "Thumbnail" };
  return Object.fromEntries(REQUIRED_FIELDS[type].filter((key) => !fields[key]).map((key) => [key, `${labels[key] || key} is required.`]));
}

// The `type` isn't a column — each table IS a type — but the frontend needs
// it to know which resource a row came from once articles/blogs/videos are
// merged into one list, or which endpoint to hit next for edit/delete/etc.
function tagType(type, item) {
  return Array.isArray(item) ? item.map((row) => ({ ...row, type })) : { ...item, type };
}

async function loadOwnedContent(req, res) {
  const Model = MODEL[req.contentType];
  const item = await Model.findById(req.params.id);
  if (!item) {
    res.status(404).json({ success: false, message: `${TYPE_LABEL[req.contentType]} not found` });
    return null;
  }
  if (Number(item.site_id || 1) !== managedContentSiteId(req)) {
    res.status(403).json({ success: false, message: "This content belongs to another website" });
    return null;
  }
  if (item.author_id !== req.user.userId && !isModerator(req.user)) {
    res.status(403).json({ success: false, message: "You do not have permission to access this content" });
    return null;
  }
  if (item.author_id !== req.user.userId && !(await canAccessAuthor(req.user, item.author_id))) {
    res.status(403).json({ success: false, message: "This creator is assigned to another reviewer" });
    return null;
  }
  return item;
}

const createContent = async (req, res) => {
  try {
    const Model = MODEL[req.contentType];
    const fields = extractFields(req.contentType, req.body, req.files);

    const validationError = validateRequired(req.contentType, fields);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError, code: "VALIDATION_ERROR", fieldErrors: requiredFieldErrors(req.contentType, fields) });
    }

    const item = await Model.create({ authorId: req.user.userId, siteId: managedContentSiteId(req), ...fields });
    return res.status(201).json({
      success: true,
      message: `${TYPE_LABEL[req.contentType]} draft created`,
      post: tagType(req.contentType, item),
    });
  } catch (error) {
    console.error(`Create ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} could not be created. Please try again.`);
  }
};

const listContent = async (req, res) => {
  try {
    const Model = MODEL[req.contentType];
    const { status } = req.query;
    const posts = await Model.findForUser({ ...req.user, siteId: managedContentSiteId(req) }, { status });
    return res.status(200).json({ success: true, posts: tagType(req.contentType, posts) });
  } catch (error) {
    console.error(`List ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} content could not be loaded.`);
  }
};

// Moderator-only: every author's content, not just the caller's own — backs
// the review queue (status=PENDING) and the content history page.
const listAllContent = async (req, res) => {
  try {
    const Model = MODEL[req.contentType];
    const { status } = req.query;
    const posts = await Model.findAll({ status, siteId: managedContentSiteId(req) });
    let visiblePosts = posts;
    if (["EDITOR", "SUBADMIN"].includes(req.user.role)) {
      const mine = new Set(await User.getAssignedAuthorIds(req.user.userId));
      const managed = req.user.role === "SUBADMIN" ? new Set(await User.getAllAssignedAuthorIds()) : null;
      visiblePosts = posts.filter((post) => {
        const authorId = Number(post.author_id);
        return mine.has(authorId) || (managed !== null && !managed.has(authorId));
      });
    }
    console.log(`List all ${req.contentType} for ${req.user.role}:`, visiblePosts.length, "items");
    return res.status(200).json({ success: true, posts: tagType(req.contentType, visiblePosts) });
  } catch (error) {
    console.error(`List all ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} review content could not be loaded.`);
  }
};

const getContentById = async (req, res) => {
  try {
    const item = await loadOwnedContent(req, res);
    if (!item) return;
    return res.status(200).json({ success: true, post: tagType(req.contentType, item) });
  } catch (error) {
    console.error(`Get ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} could not be opened.`);
  }
};

const updateCommentSetting = async (req, res) => {
  try {
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be true or false" });
    }

    const Model = MODEL[req.contentType];
    const item = await Model.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: `${TYPE_LABEL[req.contentType]} not found` });
    }

    const updated = await Model.setCommentsEnabled(item.id, req.body.enabled);
    return res.status(200).json({
      success: true,
      message: `Comments ${req.body.enabled ? "enabled" : "disabled"}`,
      post: tagType(req.contentType, updated),
    });
  } catch (error) {
    console.error(`Update ${req.contentType} comment setting error:`, error);
    return res.status(500).json({ success: false, message: "Comment setting could not be updated" });
  }
};

const updateContent = async (req, res) => {
  try {
    const item = await loadOwnedContent(req, res);
    if (!item) return;

    // loadOwnedContent lets any moderator through (for viewing/deleting/
    // reviewing another author's content), but editing the actual content is
    // narrower: an editor may only edit their own work. Admins are exempt —
    // they have full access, same as the review-permission rule.
    if (req.user.role === "EDITOR" && item.author_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Editors cannot edit another author's content.",
      });
    }

    const Model = MODEL[req.contentType];
    const fields = extractFields(req.contentType, req.body, req.files);
    const validationError = validateRequired(req.contentType, fields);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError, code: "VALIDATION_ERROR", fieldErrors: requiredFieldErrors(req.contentType, fields) });
    }

    const updated = await Model.update(item.id, fields);
    return res.status(200).json({
      success: true,
      message: `${TYPE_LABEL[req.contentType]} updated and moved back to draft`,
      post: tagType(req.contentType, updated),
    });
  } catch (error) {
    console.error(`Update ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} could not be updated. Please try again.`);
  }
};

const deleteContent = async (req, res) => {
  try {
    const item = await loadOwnedContent(req, res);
    if (!item) return;

    // Authors and editors may delete content in any workflow state (including
    // APPROVED) only when they created it. Administrators retain site-wide
    // deletion authority.
    if (req.user.role !== "ADMIN" && Number(item.author_id) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "Authors and editors can only delete their own content.",
      });
    }

    // No audit-log table exists yet, so this is recorded to the server log
    // rather than persisted — good enough for now, but if this needs to
    // survive a restart or reach the author, it'll need a real audit table.
    await DeletionAudit.softDelete({
      entityType: req.contentType,
      entityId: item.id,
      deletedBy: req.user.userId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ success: true, message: `${TYPE_LABEL[req.contentType]} moved to deleted items` });
  } catch (error) {
    console.error(`Delete ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} could not be moved to deleted items.`);
  }
};

const submitContent = async (req, res) => {
  try {
    const item = await loadOwnedContent(req, res);
    if (!item) return;

    if (!["DRAFT", "REJECTED"].includes(item.status)) {
      return res.status(400).json({
        success: false,
        message: `Only drafts or rejected ${TYPE_LABEL[req.contentType].toLowerCase()}s can be submitted (current status: ${item.status})`,
      });
    }
    const updated = await MODEL[req.contentType].submit(item.id);
    return res.status(200).json({
      success: true,
      message: `${TYPE_LABEL[req.contentType]} submitted for review`,
      post: tagType(req.contentType, updated),
    });
  } catch (error) {
    console.error(`Submit ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} could not be submitted for review.`);
  }
};

const getContentStatus = async (req, res) => {
  try {
    const item = await loadOwnedContent(req, res);
    if (!item) return;

    return res.status(200).json({
      success: true,
      status: {
        workflowStatus: item.status,
        aiStatus: item.ai_status,
        aiNotes: item.ai_notes,
        aiNotesSummary: item.ai_summary,
        aiGrammarIssues: item.ai_grammar_issues ? JSON.parse(item.ai_grammar_issues) : null,
        aiCorrectedContent: item.ai_corrected_content,
        aiQualityScore: item.ai_quality_score,
        aiRecommendation: item.ai_recommendation,
        reviewerId: item.reviewer_id,
        reviewNotes: item.review_notes,
        submittedAt: item.submitted_at,
        reviewedAt: item.reviewed_at,
        publishedAt: item.published_at,
        scheduledPublishAt: item.scheduled_publish_at,
      },
    });
  } catch (error) {
    console.error(`Get ${req.contentType} status error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} status could not be loaded.`);
  }
};

// Admins and Subadmins can review every creator. Editors can review content
// from Authors or other Editors only when the creator is assigned to them;
// canAccessAuthor enforces that assignment.
function canReview(reviewerRole, authorRole) {
  if (["ADMIN", "SUBADMIN"].includes(reviewerRole)) return true;
  return reviewerRole === "EDITOR" && ["AUTHOR", "EDITOR"].includes(authorRole);
}

const reviewContent = async (req, res) => {
  try {
    const Model = MODEL[req.contentType];
    const item = await Model.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: `${TYPE_LABEL[req.contentType]} not found` });
    }

    if (!canReview(req.user.role, item.author_role)) {
      return res.status(403).json({
        success: false,
        message: "Editors can review only assigned Author or Editor content. Admin and Subadmin content requires an Admin or Subadmin reviewer.",
      });
    }
    if (!(await canAccessAuthor(req.user, item.author_id))) {
      return res.status(403).json({ success: false, message: "This creator is assigned to another reviewer" });
    }

    const { action, notes } = req.body;
    if (!["APPROVE", "REJECT", "UPDATE", "SCHEDULE"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be one of APPROVE, REJECT, UPDATE, or SCHEDULE" });
    }
    let scheduledPublishAt = null;
    if (action === "SCHEDULE") {
      scheduledPublishAt = new Date(req.body?.scheduledPublishAt);
      if (Number.isNaN(scheduledPublishAt.getTime()) || scheduledPublishAt.getTime() <= Date.now()) {
        return res.status(400).json({ success: false, message: "Choose a future publication date and time" });
      }
    }

    const fields = action === "UPDATE" ? extractFields(req.contentType, req.body) : {};
    if (action === "UPDATE") {
      const validationError = validateRequired(req.contentType, { ...item, ...fields });
      if (validationError) {
        return res.status(400).json({ success: false, message: validationError, code: "VALIDATION_ERROR", fieldErrors: requiredFieldErrors(req.contentType, { ...item, ...fields }) });
      }
    }

    const updated = await Model.review(item.id, { reviewerId: req.user.userId, action, notes, scheduledPublishAt, ...fields });
    let awardedPoints = 0;
    let editorAwardedPoints = 0;
    const isPublishedNow = !updated.published_at || new Date(updated.published_at).getTime() <= Date.now();
    if (action === "APPROVE" && isPublishedNow && ["AUTHOR", "EDITOR"].includes(updated.author_role)) {
      const reward = await creditContentReward({
        userId: updated.author_id,
        contributorRole: updated.author_role,
        contentType: req.contentType,
        contentId: updated.id,
        title: updated.title,
        publishedAt: updated.published_at,
      });
      if (reward.credited) awardedPoints = reward.points;
    }
    if (action === "APPROVE" && isPublishedNow && req.user.role === "EDITOR") {
      const reward = await creditEditorReviewReward({
        editorId: req.user.userId,
        contentType: req.contentType,
        contentId: updated.id,
        title: updated.title,
        publishedAt: updated.published_at,
      });
      if (reward.credited) editorAwardedPoints = reward.points;
    }

    return res.status(200).json({
      success: true,
      message: action === "SCHEDULE"
        ? `${TYPE_LABEL[req.contentType]} scheduled for automatic approval and publication`
        : `${TYPE_LABEL[req.contentType]} ${action.toLowerCase()}d${awardedPoints ? ` and ${awardedPoints} creator points awarded` : ""}${editorAwardedPoints ? `; you earned ${editorAwardedPoints} approval points` : ""}`,
      post: tagType(req.contentType, updated),
      awardedPoints,
      editorAwardedPoints,
    });
  } catch (error) {
    console.error(`Review ${req.contentType} error:`, error);
    return sendError(res, error, `${TYPE_LABEL[req.contentType]} review could not be saved.`);
  }
};

const bulkModerateContent = async (req, res) => {
  try {
    const action = String(req.body?.action || "").toUpperCase();
    const notes = String(req.body?.notes || req.body?.reason || "").trim();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!["APPROVE", "REJECT", "DELETE"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be APPROVE, REJECT, or DELETE" });
    }
    if (!rawItems.length || rawItems.length > 100) {
      return res.status(400).json({ success: false, message: "Select between 1 and 100 content items" });
    }
    if (["REJECT", "DELETE"].includes(action) && !notes) {
      return res.status(400).json({ success: false, message: `A reason is required to ${action.toLowerCase()} content` });
    }

    const seen = new Set();
    const items = [];
    for (const rawItem of rawItems) {
      const type = String(rawItem?.type || "").toUpperCase();
      const id = Number(rawItem?.id);
      const key = `${type}:${id}`;
      if (!MODEL[type] || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "Every selected item must have a valid type and ID" });
      }
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ type, id, Model: MODEL[type] });
      }
    }

    // Resolve and authorize the complete batch before changing anything.
    // This avoids approving early rows and then failing halfway through on
    // an editor-owned row that requires an administrator.
    for (const item of items) {
      item.post = await item.Model.findById(item.id);
      if (!item.post) {
        return res.status(404).json({ success: false, message: `${TYPE_LABEL[item.type]} ${item.id} not found` });
      }
      if (!(await canAccessAuthor(req.user, item.post.author_id))) {
        return res.status(403).json({
          success: false,
          message: "One or more selected items belong to a creator assigned to another reviewer.",
        });
      }
      if (
        action === "DELETE"
        && req.user.role !== "ADMIN"
        && Number(item.post.author_id) !== Number(req.user.userId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Authors and editors can only delete their own content. Remove other creators' items from the selection.",
        });
      }
      if (action !== "DELETE" && !canReview(req.user.role, item.post.author_role)) {
        return res.status(403).json({
          success: false,
          message: "Editors can approve or reject only assigned Author or Editor content. Remove restricted items from the selection.",
        });
      }
    }

    let awardedPoints = 0;
    let editorAwardedPoints = 0;
    for (const item of items) {
      if (action === "DELETE") {
        await DeletionAudit.softDelete({
          entityType: item.type,
          entityId: item.id,
          deletedBy: req.user.userId,
          reason: notes,
        });
        continue;
      }

      const updated = await item.Model.review(item.id, {
        reviewerId: req.user.userId,
        action,
        notes: notes || undefined,
      });
      const isPublishedNow = !updated.published_at || new Date(updated.published_at).getTime() <= Date.now();
      if (action === "APPROVE" && isPublishedNow && ["AUTHOR", "EDITOR"].includes(updated.author_role)) {
        const reward = await creditContentReward({
          userId: updated.author_id,
          contributorRole: updated.author_role,
          contentType: item.type,
          contentId: updated.id,
          title: updated.title,
          publishedAt: updated.published_at,
        });
        if (reward.credited) awardedPoints += reward.points;
      }
      if (action === "APPROVE" && isPublishedNow && req.user.role === "EDITOR") {
        const reward = await creditEditorReviewReward({
          editorId: req.user.userId,
          contentType: item.type,
          contentId: updated.id,
          title: updated.title,
          publishedAt: updated.published_at,
        });
        if (reward.credited) editorAwardedPoints += reward.points;
      }
    }

    return res.status(200).json({
      success: true,
      message: `${items.length} item${items.length === 1 ? "" : "s"} ${action.toLowerCase()}d`,
      processed: items.map(({ type, id }) => ({ type, id })),
      awardedPoints,
      editorAwardedPoints,
    });
  } catch (error) {
    console.error("Bulk content moderation error:", error);
    return res.status(500).json({ success: false, message: "Bulk action could not be completed" });
  }
};

module.exports = {
  createContent,
  listContent,
  listAllContent,
  getContentById,
  updateCommentSetting,
  updateContent,
  deleteContent,
  submitContent,
  getContentStatus,
  reviewContent,
  bulkModerateContent,
};
