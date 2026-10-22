// Builds identical route sets for /articles, /blogs, and /videos — same
// draft -> submit -> AI check -> editor review workflow for all three, per
// the content.controller.js handlers.
//
// Shared shape (swagger docs written once here rather than tripled):
//   POST   /:resource              create a draft                     (AUTHOR/EDITOR/ADMIN)
//   GET    /:resource               list — own content only, regardless of role
//   GET    /:resource/history       every author's content, any status  (EDITOR/ADMIN)
//   GET    /:resource/:id           get one (owner, or EDITOR/ADMIN)
//   PUT    /:resource/:id           edit — resets status back to DRAFT
//   DELETE /:resource/:id           delete (owner, or EDITOR/ADMIN)
//   POST   /:resource/:id/submit    DRAFT/REJECTED -> PENDING, runs the AI check
//   GET    /:resource/:id/status    workflow/AI/editor status snapshot
//   POST   /:resource/:id/review    EDITOR/ADMIN: { action: APPROVE|REJECT|UPDATE, notes, ... }
const express = require("express");
const {
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
} = require("../controllers/content/content.controller");
const { authenticate, authorize, authorizePermission, authorizeRoleOrPermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const { uploadFields } = require("../middleware/upload.middleware");
const { enforceDailyContentLimit } = require("../middleware/contentLimit.middleware");

const CREATE_PERMISSION = {
  ARTICLE: PERMISSIONS.CREATE_ARTICLE,
  BLOG: PERMISSIONS.CREATE_BLOG,
  VIDEO: PERMISSIONS.CREATE_VIDEO,
};

const setContentType = (type) => (req, res, next) => {
  req.contentType = type;
  next();
};

// Articles/blogs upload one featured image and up to ten body/gallery images;
// videos upload a thumbnail and, when videoSource is UPLOAD, the video file.
function mediaFieldsFor(type) {
  if (type === "VIDEO") {
    return [{ name: "thumbnail", maxCount: 1 }, { name: "videoFile", maxCount: 1 }];
  }
  return [{ name: "featuredImage", maxCount: 1 }, { name: "additionalImages", maxCount: 10 }];
}

function buildResourceRoutes(resource, type) {
  const router = express.Router();
  const withType = setContentType(type);
  const withUpload = uploadFields(mediaFieldsFor(type));

  router.post(
    `/${resource}`,
    authenticate,
    authorizePermission(CREATE_PERMISSION[type]),
    withType,
    enforceDailyContentLimit,
    withUpload,
    createContent
  );
  router.get(`/${resource}`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT), withType, listContent);
  // Must come before /:id — otherwise Express would match "history" as the
  // :id param and this route would never be reached.
  router.get(`/${resource}/history`, authenticate, authorizeRoleOrPermission(["INVESTOR"], PERMISSIONS.CONTENT_HISTORY, PERMISSIONS.REVIEW_CONTENT), withType, listAllContent);
  router.patch(`/${resource}/:id/comments`, authenticate, authorizePermission(PERMISSIONS.MANAGE_COMMENTS), withType, updateCommentSetting);
  router.get(`/${resource}/:id`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT, PERMISSIONS.REVIEW_CONTENT, PERMISSIONS.CONTENT_HISTORY), withType, getContentById);
  router.put(`/${resource}/:id`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT), withType, withUpload, updateContent);
  router.delete(`/${resource}/:id`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT, PERMISSIONS.REVIEW_CONTENT), withType, deleteContent);
  router.post(`/${resource}/:id/submit`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT), withType, submitContent);
  router.get(`/${resource}/:id/status`, authenticate, authorizePermission(PERMISSIONS.MY_CONTENT, PERMISSIONS.REVIEW_CONTENT), withType, getContentStatus);
  router.post(`/${resource}/:id/review`, authenticate, authorizePermission(PERMISSIONS.REVIEW_CONTENT), withType, reviewContent);

  return router;
}

const routes = express.Router();

/**
 * @openapi
 * /api/content/bulk:
 *   post:
 *     summary: Moderate multiple content items
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, items]
 *             properties:
 *               action: { type: string, enum: [APPROVE, REJECT, DELETE] }
 *               notes: { type: string }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [type, id]
 *                   properties:
 *                     type: { type: string, enum: [ARTICLE, BLOG, VIDEO] }
 *                     id: { type: integer }
 *     responses:
 *       200: { description: Bulk moderation completed }
 *       400: { description: Invalid action or content items }
 *       401: { description: Authentication required }
 *       403: { description: Review permission required }
 *       500: { description: Internal server error }
 */
routes.post(
  "/content/bulk",
  authenticate,
  authorizePermission(PERMISSIONS.REVIEW_CONTENT),
  bulkModerateContent
);

/**
 * @openapi
 * /api/articles:
 *   post:
 *     summary: Create an article draft
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, excerpt, content, featuredImage, category]
 *             properties:
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               featuredImage: { type: string, format: binary }
 *               category: { type: string }
 *               state: { type: string, description: Indian state this story is about, if regional }
 *               tags: { type: string, description: JSON array or comma-separated list of tags }
 *               relatedPolitician: { type: string }
 *               relatedElection: { type: string }
 *     responses:
 *       201:
 *         description: Article draft created
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *   get:
 *     summary: List the caller's own articles
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *         description: Optionally filter to one status
 *     responses:
 *       200:
 *         description: The caller's articles
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *
 * /api/articles/history:
 *   get:
 *     summary: List every author's articles, any status (editor/admin only)
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *         description: Optionally filter to one status — used by the review queue (status=PENDING)
 *     responses:
 *       200:
 *         description: Articles from every author
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an editor or admin
 *
 * /api/articles/{id}:
 *   get:
 *     summary: Get a single article
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The matching article
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this article and is not a moderator
 *       404:
 *         description: Article not found
 *   put:
 *     summary: Edit an article
 *     description: Resets the article's workflow status back to DRAFT. Editors may only edit their own articles; admins may edit any.
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, excerpt, content, featuredImage, category]
 *             properties:
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               featuredImage: { type: string, format: binary, description: Omit and resend the existing image URL as a form field to keep the current image }
 *               category: { type: string }
 *               state: { type: string }
 *               tags: { type: string }
 *               relatedPolitician: { type: string }
 *               relatedElection: { type: string }
 *     responses:
 *       200:
 *         description: Article updated and moved back to draft
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this article, or an editor tried to edit another author's work
 *       404:
 *         description: Article not found
 *   delete:
 *     summary: Delete an article
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Optional — recorded to the server log }
 *     responses:
 *       200:
 *         description: Article deleted
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this article and is not a moderator
 *       404:
 *         description: Article not found
 *
 * /api/articles/{id}/submit:
 *   post:
 *     summary: Submit a draft/rejected article for review
 *     description: Only DRAFT or REJECTED articles can be submitted. Runs the automated AI check as part of the transition to PENDING.
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Article submitted for review
 *       400:
 *         description: Article is not in DRAFT or REJECTED status
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this article and is not a moderator
 *       404:
 *         description: Article not found
 *
 * /api/articles/{id}/status:
 *   get:
 *     summary: Get an article's workflow/AI/editor status snapshot
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status snapshot (workflowStatus, aiStatus, aiNotes, reviewerId, reviewNotes, submittedAt, reviewedAt, publishedAt, etc.)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this article and is not a moderator
 *       404:
 *         description: Article not found
 *
 * /api/articles/{id}/review:
 *   post:
 *     summary: Approve, reject, or update-and-decide an article (editor/admin only)
 *     description: Editors can review assigned Author or Editor articles. Admin and Subadmin content requires an Admin or Subadmin reviewer. UPDATE also accepts the same fields as create/edit and re-validates required fields.
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [APPROVE, REJECT, UPDATE] }
 *               notes: { type: string }
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               category: { type: string }
 *               state: { type: string }
 *               tags: { type: string }
 *               relatedPolitician: { type: string }
 *               relatedElection: { type: string }
 *     responses:
 *       200:
 *         description: Article reviewed
 *       400:
 *         description: Invalid action, or missing required field(s) for an UPDATE
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Editor tried to review editor/admin-authored content
 *       404:
 *         description: Article not found
 */
routes.use(buildResourceRoutes("articles", "ARTICLE"));

/**
 * @openapi
 * /api/blogs:
 *   post:
 *     summary: Create a blog draft
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content, featuredImage, category]
 *             properties:
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               featuredImage: { type: string, format: binary }
 *               category: { type: string }
 *               tags: { type: string, description: JSON array or comma-separated list of tags }
 *               relatedArticleId: { type: integer }
 *     responses:
 *       201:
 *         description: Blog draft created
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *   get:
 *     summary: List the caller's own blog posts
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: The caller's blog posts
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *
 * /api/blogs/history:
 *   get:
 *     summary: List every author's blog posts, any status (editor/admin only)
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: Blog posts from every author
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an editor or admin
 *
 * /api/blogs/{id}:
 *   get:
 *     summary: Get a single blog post
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The matching blog post
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this blog post and is not a moderator
 *       404:
 *         description: Blog post not found
 *   put:
 *     summary: Edit a blog post
 *     description: Resets the post's workflow status back to DRAFT. Editors may only edit their own posts; admins may edit any.
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content, featuredImage, category]
 *             properties:
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               featuredImage: { type: string, format: binary, description: Omit and resend the existing image URL as a form field to keep the current image }
 *               category: { type: string }
 *               tags: { type: string }
 *               relatedArticleId: { type: integer }
 *     responses:
 *       200:
 *         description: Blog post updated and moved back to draft
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this blog post, or an editor tried to edit another author's work
 *       404:
 *         description: Blog post not found
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Optional — recorded to the server log }
 *     responses:
 *       200:
 *         description: Blog post deleted
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this blog post and is not a moderator
 *       404:
 *         description: Blog post not found
 *
 * /api/blogs/{id}/submit:
 *   post:
 *     summary: Submit a draft/rejected blog post for review
 *     description: Only DRAFT or REJECTED posts can be submitted. Runs the automated AI check as part of the transition to PENDING.
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Blog post submitted for review
 *       400:
 *         description: Post is not in DRAFT or REJECTED status
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this blog post and is not a moderator
 *       404:
 *         description: Blog post not found
 *
 * /api/blogs/{id}/status:
 *   get:
 *     summary: Get a blog post's workflow/AI/editor status snapshot
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status snapshot (workflowStatus, aiStatus, aiNotes, reviewerId, reviewNotes, submittedAt, reviewedAt, publishedAt, etc.)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this blog post and is not a moderator
 *       404:
 *         description: Blog post not found
 *
 * /api/blogs/{id}/review:
 *   post:
 *     summary: Approve, reject, or update-and-decide a blog post (editor/admin only)
 *     description: Editors can review assigned Author or Editor posts. Admin and Subadmin content requires an Admin or Subadmin reviewer. UPDATE also accepts the same fields as create/edit and re-validates required fields.
 *     tags: [Blogs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [APPROVE, REJECT, UPDATE] }
 *               notes: { type: string }
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               category: { type: string }
 *               tags: { type: string }
 *               relatedArticleId: { type: integer }
 *     responses:
 *       200:
 *         description: Blog post reviewed
 *       400:
 *         description: Invalid action, or missing required field(s) for an UPDATE
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Editor tried to review editor/admin-authored content
 *       404:
 *         description: Blog post not found
 */
routes.use(buildResourceRoutes("blogs", "BLOG"));

/**
 * @openapi
 * /api/videos:
 *   post:
 *     summary: Create a video draft
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, videoSource, videoUrl, thumbnail, category]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               videoSource: { type: string, description: e.g. UPLOAD for an uploaded file, or an external source name }
 *               videoUrl: { type: string, description: External video URL — ignored (and derived from videoFile instead) when videoSource is UPLOAD and a videoFile is attached }
 *               videoFile: { type: string, format: binary, description: Required when videoSource is UPLOAD }
 *               thumbnail: { type: string, format: binary }
 *               category: { type: string }
 *               state: { type: string }
 *               tags: { type: string, description: JSON array or comma-separated list of tags }
 *               relatedArticleId: { type: integer }
 *               relatedPolitician: { type: string }
 *     responses:
 *       201:
 *         description: Video draft created
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *   get:
 *     summary: List the caller's own videos
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: The caller's videos
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an author, editor, or admin
 *
 * /api/videos/history:
 *   get:
 *     summary: List every author's videos, any status (editor/admin only)
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: Videos from every author
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an editor or admin
 *
 * /api/videos/{id}:
 *   get:
 *     summary: Get a single video
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The matching video
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this video and is not a moderator
 *       404:
 *         description: Video not found
 *   put:
 *     summary: Edit a video
 *     description: Resets the video's workflow status back to DRAFT. Editors may only edit their own videos; admins may edit any.
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, videoSource, videoUrl, thumbnail, category]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               videoSource: { type: string }
 *               videoUrl: { type: string }
 *               videoFile: { type: string, format: binary }
 *               thumbnail: { type: string, format: binary, description: Omit and resend the existing thumbnail URL as a form field to keep the current thumbnail }
 *               category: { type: string }
 *               state: { type: string }
 *               tags: { type: string }
 *               relatedArticleId: { type: integer }
 *               relatedPolitician: { type: string }
 *     responses:
 *       200:
 *         description: Video updated and moved back to draft
 *       400:
 *         description: Missing required field(s)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this video, or an editor tried to edit another author's work
 *       404:
 *         description: Video not found
 *   delete:
 *     summary: Delete a video
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Optional — recorded to the server log }
 *     responses:
 *       200:
 *         description: Video deleted
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this video and is not a moderator
 *       404:
 *         description: Video not found
 *
 * /api/videos/{id}/submit:
 *   post:
 *     summary: Submit a draft/rejected video for review
 *     description: Only DRAFT or REJECTED videos can be submitted. Runs the automated AI check as part of the transition to PENDING.
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Video submitted for review
 *       400:
 *         description: Video is not in DRAFT or REJECTED status
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this video and is not a moderator
 *       404:
 *         description: Video not found
 *
 * /api/videos/{id}/status:
 *   get:
 *     summary: Get a video's workflow/AI/editor status snapshot
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status snapshot (workflowStatus, aiStatus, aiNotes, reviewerId, reviewNotes, submittedAt, reviewedAt, publishedAt, etc.)
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller does not own this video and is not a moderator
 *       404:
 *         description: Video not found
 *
 * /api/videos/{id}/review:
 *   post:
 *     summary: Approve, reject, or update-and-decide a video (editor/admin only)
 *     description: Editors can review assigned Author or Editor videos. Admin and Subadmin content requires an Admin or Subadmin reviewer. UPDATE also accepts the same fields as create/edit and re-validates required fields.
 *     tags: [Videos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [APPROVE, REJECT, UPDATE] }
 *               notes: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               videoSource: { type: string }
 *               videoUrl: { type: string }
 *               category: { type: string }
 *               state: { type: string }
 *               tags: { type: string }
 *               relatedArticleId: { type: integer }
 *               relatedPolitician: { type: string }
 *     responses:
 *       200:
 *         description: Video reviewed
 *       400:
 *         description: Invalid action, or missing required field(s) for an UPDATE
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Editor tried to review editor/admin-authored content
 *       404:
 *         description: Video not found
 */
routes.use(buildResourceRoutes("videos", "VIDEO"));

module.exports = routes;
