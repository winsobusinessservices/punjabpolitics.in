// Panel task tracker (backend-only module).
//   GET    /tasks                VIEW_TASKS  — list; Editors are scoped to owner/assignee = self
//   GET    /tasks/mine           VIEW_TASKS  — tasks I own or am assigned to
//   GET    /tasks/:id            VIEW_TASKS  — one task; Editors only if they are a participant
//   POST   /tasks                CREATE_TASKS — create; Editors self-assign only, cannot set done
//   PATCH  /tasks/:id            EDIT_TASKS   — update; same Editor restrictions apply
//   DELETE /tasks/:id            DELETE_TASKS — soft-delete; participants (or full access) only

const express = require("express");

const {
  listTasks,
  getRelatedContent,
  getMyTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require("../controllers/tasks/task.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

const { PERMISSIONS } = require("../config/permissions");

// Same check as authorizePermission, but with a task-specific denial message.
// The panel treats the generic "You do not have permission to perform this
// action" 403 as an expired session and redirects to login, which is wrong for
// a signed-in user who simply lacks a task privilege.
const authorizePermission = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (req.user.role === "ADMIN" || requiredPermissions.some((permission) => req.user.permissions?.includes(permission))) return next();
  return res.status(403).json({ success: false, message: "Your account does not have access to this task action. Ask an admin to update your task privileges." });
};

// Status-only endpoint is for Authors and Editors. Uses a task-specific 403
// message so the panel does not mistake it for an expired session.
const authorizeTaskStatusRole = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (["AUTHOR", "EDITOR"].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: "Only Authors and Editors can use the status update. Use Edit Task instead." });
};

const router = express.Router();

/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: List tasks (Editors only see tasks they own or are assigned)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, done]
 *         description: Optionally filter to one status
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 200
 *
 *     responses:
 *       200:
 *         description: Paginated list of tasks, ordered by priority then most recently updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Task"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 50
 *
 *       400:
 *         description: Invalid status value
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks the view_tasks permission
 */
router.get(
  "/tasks",
  authenticate,
  authorizePermission(PERMISSIONS.VIEW_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  listTasks
);

/**
 * @openapi
 * /api/tasks/related-content:
 *   get:
 *     summary: Published articles, blogs and videos written by a user (for the task "Related to" picker)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: assigneeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Content authored by the given user, newest first (empty when assigneeId is missing)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       type: { type: string, enum: [ARTICLE, BLOG, VIDEO] }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       href: { type: string, example: "/news/winter-session" }
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller may not create or edit tasks
 */
router.get(
  "/tasks/related-content",
  authenticate,
  authorizePermission(PERMISSIONS.CREATE_TASKS, PERMISSIONS.EDIT_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  getRelatedContent
);

/**
 * @openapi
 * /api/tasks/mine:
 *   get:
 *     summary: List tasks I own or am assigned to
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 200
 *
 *     responses:
 *       200:
 *         description: Paginated list of the caller's owned or assigned tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Task"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 50
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks the view_tasks permission
 */
router.get(
  "/tasks/mine",
  authenticate,
  authorizePermission(PERMISSIONS.VIEW_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  getMyTasks
);

/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a single task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *
 *     responses:
 *       200:
 *         description: The requested task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks view_tasks or is not the owner/assignee of the task
 *
 *       404:
 *         description: Task not found
 */
router.get(
  "/tasks/:id",
  authenticate,
  authorizePermission(PERMISSIONS.VIEW_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  getTask
);

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     summary: Create a task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *
 *               title:
 *                 type: string
 *                 example: "Draft article on the Winter Session"
 *
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Prepare the article and submit it for review."
 *
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, done]
 *                 default: open
 *                 example: open
 *
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 example: high
 *
 *               type:
 *                 type: string
 *                 enum: [content, website, policy, review, other]
 *                 default: other
 *                 example: content
 *
 *               relatedContent:
 *                 type: string
 *                 nullable: true
 *                 description: Related article, blog, video, page, URL or other content reference.
 *                 example: "https://www.indianrajniti.com/article/winter-session"
 *
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Date and time by which the task should be completed.
 *                 example: "2026-10-15T18:30:00+05:30"
 *
 *               assigneeId:
 *                 type: integer
 *                 nullable: true
 *                 description: Editors may only assign tasks to themselves.
 *                 example: 25
 *
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *
 *       400:
 *         description: Missing title or an invalid status, priority or type value
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks create_tasks, may not assign another user, or is an Editor setting status to done
 */
router.post(
  "/tasks",
  authenticate,
  authorizePermission(PERMISSIONS.CREATE_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  createTask
);

/**
 * @openapi
 * /api/tasks/{id}:
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *
 *               title:
 *                 type: string
 *                 example: "Update Winter Session article"
 *
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Updated task description."
 *
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, done]
 *                 example: in_progress
 *
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: high
 *
 *               type:
 *                 type: string
 *                 enum: [content, website, policy, review, other]
 *                 example: content
 *
 *               relatedContent:
 *                 type: string
 *                 nullable: true
 *                 description: Related article, blog, video, page, URL or other content reference.
 *                 example: "https://www.indianrajniti.com/article/winter-session"
 *
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Date and time by which the task should be completed.
 *                 example: "2026-10-15T18:30:00+05:30"
 *
 *               assigneeId:
 *                 type: integer
 *                 nullable: true
 *                 description: null unassigns; Editors may only assign themselves.
 *                 example: 25
 *
 *     responses:
 *       200:
 *         description: The updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *
 *       400:
 *         description: Invalid status, priority, type or empty title
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks edit_tasks, is not the owner/assignee, may not assign the target user, or is an Editor setting status to done
 *
 *       404:
 *         description: Task not found
 */
router.patch(
  "/tasks/:id",
  authenticate,
  authorizePermission(PERMISSIONS.EDIT_TASKS, PERMISSIONS.UPDATE_TASK_STATUS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  updateTask
);

/**
 * @openapi
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Change only the status of a task (Authors and Editors)
 *     description: Dedicated status endpoint for Authors and Editors. They must be the owner or assignee of the task, and Editors cannot set status to done.
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, done]
 *                 example: in_progress
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Optional note explaining the status change, stored with the task.
 *                 example: "Draft is ready, waiting for review."
 *
 *     responses:
 *       200:
 *         description: The updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *
 *       400:
 *         description: Missing or invalid status, or description longer than 2000 characters
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller is not an Author or Editor, is not the owner/assignee, or is an Editor setting status to done
 *
 *       404:
 *         description: Task not found
 */
router.patch(
  "/tasks/:id/status",
  authenticate,
  authorizeTaskStatusRole,
  updateTaskStatus
);

/**
 * @openapi
 * /api/tasks/{id}:
 *   delete:
 *     summary: Soft-delete a task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *
 *     responses:
 *       200:
 *         description: Task deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Task deleted
 *
 *       401:
 *         description: Missing or invalid token
 *
 *       403:
 *         description: Caller lacks delete_tasks or is not the owner/assignee of the task
 *
 *       404:
 *         description: Task not found
 */
router.delete(
  "/tasks/:id",
  authenticate,
  authorizePermission(PERMISSIONS.DELETE_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT),
  deleteTask
);

module.exports = router;