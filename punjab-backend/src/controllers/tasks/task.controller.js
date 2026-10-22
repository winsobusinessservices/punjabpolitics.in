const Task = require('../../models/task.model');
const Article = require('../../models/article.model');
const Blog = require('../../models/blog.model');
const Video = require('../../models/video.model');
const { PERMISSIONS } = require('../../config/permissions');
const User = require('../../models/user.model');
const { notifyTaskAssigned, notifyTaskStatusChanged } = require('../../services/taskNotifications.service');

const STATUSES = ['open', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const TYPES = ['content', 'website', 'policy', 'review', 'other'];

function hasAnyPermission(user, permissions) {
  return user.role === 'ADMIN' || permissions.some((permission) => (user.permissions || []).includes(permission));
}

// Only an Admin sees every task on the site. Everyone else - Subadmins included,
// even with the assign/manage task privileges - sees only the tasks they created
// or that are assigned to them (the same rule applies to opening, editing,
// changing the status of and deleting a task).
function canSeeAll(user) {
  return user.role === 'ADMIN';
}

// Users holding only update_task_status may change a task's status and nothing else.
function canEditAllFields(user) {
  return hasAnyPermission(user, [PERMISSIONS.EDIT_TASKS, PERMISSIONS.MANAGE_TASK_MANAGEMENT]);
}

function isParticipant(task, user) {
  return Number(task.owner_id) === Number(user.id) || Number(task.assignee_id) === Number(user.id);
}

function canAssignTo(user, targetId) {
  if (Number(targetId) === Number(user.id)) return true;
  return user.role === 'ADMIN' || (user.permissions || []).includes(PERMISSIONS.ASSIGN_TASKS);
}

// A task can only go to someone who can actually open it: an existing team member on this
// website whose account and panel access are both active.
async function assigneeProblem(actor, targetId, siteId) {
  if (Number(targetId) === Number(actor.id)) return null;
  const target = await User.findById(targetId);
  if (!target) return 'That team member could not be found';
  if (Number(target.site_id) !== Number(siteId)) return 'That team member belongs to another website';
  if (!User.PANEL_ROLES.includes(target.role)) return 'Tasks can only be assigned to team members';
  if (target.status !== 'ACTIVE') return `${target.name || 'This user'} is inactive and cannot be assigned tasks`;
  if (target.panel_status === 'INACTIVE') return `${target.name || 'This user'} has no panel access, so they cannot see assigned tasks`;
  return null;
}

function pagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function fail(res, status, message, code) {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(status).json(body);
}

function validateBody(body) {
  const { title, status, priority, type } = body || {};
  if (title !== undefined && !String(title).trim()) return 'Title cannot be empty';
  if (status !== undefined && status !== null && !STATUSES.includes(status)) {
    return 'Invalid status. Must be one of: open, in_progress, done';
  }
  if (priority !== undefined && priority !== null && !PRIORITIES.includes(priority)) {
    return 'Invalid priority. Must be one of: low, medium, high';
  }
  if (type !== undefined && type !== null && !TYPES.includes(type)) {
    return 'Invalid type. Must be one of: content, website, policy, review, other';
  }
  return null;
}

async function listTasks(req, res) {
  try {
    const { page, limit, offset } = pagination(req.query);
    const status = req.query.status ? String(req.query.status) : null;
    if (status && !STATUSES.includes(status)) {
      return fail(res, 400, 'Invalid status. Must be one of: open, in_progress, done', 'VALIDATION_ERROR');
    }
    const siteId = Number(req.site?.id || req.user?.site_id || 1);
    const tasks = await Task.findByStatus(status || null, {
      siteId,
      scopeUserId: canSeeAll(req.user) ? null : Number(req.user.id),
      limit,
      offset
    });
    return res.status(200).json({ success: true, tasks, page, limit });
  } catch (error) {
    console.error('List tasks error:', error);
    return fail(res, 500, 'Tasks could not be loaded');
  }
}

async function getMyTasks(req, res) {
  try {
    const { page, limit, offset } = pagination(req.query);
    const siteId = Number(req.site?.id || req.user?.site_id || 1);
    const tasks = await Task.findMine({ siteId, userId: Number(req.user.id), limit, offset });
    return res.status(200).json({ success: true, tasks, page, limit });
  } catch (error) {
    console.error('List my tasks error:', error);
    return fail(res, 500, 'Tasks could not be loaded');
  }
}

// Published articles, blogs and videos written by one user. Backs the task
// form's "Related to" picker, which only offers the assignee's own content.
async function getRelatedContent(req, res) {
  try {
    const assigneeId = Number(req.query.assigneeId);
    if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
      return res.status(200).json({ success: true, posts: [] });
    }
    const siteId = Number(req.site?.id || req.user?.siteId || req.user?.site_id || 1);
    const sources = [['ARTICLE', Article], ['BLOG', Blog], ['VIDEO', Video]];
    const lists = await Promise.all(
      sources.map(async ([type, Model]) => {
        const rows = await Model.findAll({ status: 'APPROVED', siteId });
        return rows
          .filter((row) => Number(row.author_id) === assigneeId && row.slug)
          .map((row) => ({
            id: row.id,
            type,
            title: row.title,
            slug: row.slug,
            href: `/news/${row.slug}`,
            published_at: row.published_at || row.created_at || null
          }));
      })
    );
    const posts = lists
      .flat()
      .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
      .slice(0, 200);
    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('Related content error:', error);
    return fail(res, 500, 'Related content could not be loaded');
  }
}

async function getTask(req, res) {
  try {
    const task = await Task.findById(Number(req.params.id));
    if (!task) return fail(res, 404, 'Task not found');
    if (!canSeeAll(req.user) && !isParticipant(task, req.user)) {
      return fail(res, 403, 'You can only view your own tasks');
    }
    return res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('Get task error:', error);
    return fail(res, 500, 'Task could not be loaded');
  }
}

async function createTask(req, res) {
  try {
    const { title, description, status, priority, type, relatedContent, dueDate, assigneeId } = req.body || {};
    if (!title || !String(title).trim()) {
      return fail(res, 400, 'Title is required', 'VALIDATION_ERROR');
    }
    const invalid = validateBody(req.body);
    if (invalid) return fail(res, 400, invalid, 'VALIDATION_ERROR');

    const userId = Number(req.user.id);
    const target = assigneeId === undefined || assigneeId === null ? userId : Number(assigneeId);
    if (!canAssignTo(req.user, target)) {
      return fail(res, 403, 'You can only assign tasks to yourself');
    }
    const createProblem = await assigneeProblem(req.user, target, Number(req.site?.id || req.user?.siteId || req.user?.site_id || 1));
    if (createProblem) return fail(res, 400, createProblem, 'VALIDATION_ERROR');

    const task = await Task.create({
      title: String(title).trim(),
      description: description ? String(description) : null,
      status: status || 'open',
      priority: priority || 'medium',
      type: type || 'other',
      relatedContent: relatedContent || null,
      dueDate: dueDate || null,
      websiteId: Number(req.site?.id || req.user?.site_id || 1),
      ownerId: userId,
      assigneeId: target,
      createdBy: userId
    });
    notifyTaskAssigned(task, userId); // fire-and-forget email to the assignee
    return res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Create task error:', error);
    return fail(res, 500, 'Task could not be created');
  }
}

async function updateTask(req, res) {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findById(taskId);
    if (!task) return fail(res, 404, 'Task not found');

    const user = req.user;
    if (!canSeeAll(user) && !isParticipant(task, user)) {
      return fail(res, 403, 'You can only edit your own tasks');
    }

    const { title, description, status, priority, type, relatedContent, dueDate, assigneeId } = req.body || {};
    const invalid = validateBody(req.body);
    if (invalid) return fail(res, 400, invalid, 'VALIDATION_ERROR');

    if (!canEditAllFields(user)) {
      const otherFields = { title, description, priority, type, relatedContent, dueDate, assigneeId };
      if (Object.values(otherFields).some((value) => value !== undefined)) {
        return fail(res, 403, 'You can only change the status of a task');
      }
    }

    const userId = Number(user.id);

    if (assigneeId !== undefined) {
      const target = assigneeId === null ? null : Number(assigneeId);
      if (target !== null && !canAssignTo(user, target)) {
        return fail(res, 403, 'You can only assign tasks to yourself');
      }
      // Re-saving a task whose current assignee was deactivated later must still work.
      if (target !== null && Number(target) !== Number(task.assignee_id)) {
        const updateProblem = await assigneeProblem(user, target, Number(req.site?.id || user.siteId || user.site_id || 1));
        if (updateProblem) return fail(res, 400, updateProblem, 'VALIDATION_ERROR');
      }
      await Task.assign(taskId, target, userId);
    }

    if (status !== undefined && status !== null) {
      await Task.updateStatus(taskId, status, userId);
    }

    const fields = {};
    if (title !== undefined) fields.title = String(title).trim();
    if (description !== undefined) fields.description = description ? String(description) : null;
    if (priority !== undefined && priority !== null) fields.priority = priority;
    if (type !== undefined && type !== null) fields.type = type;
    if (relatedContent !== undefined) fields.related_content = relatedContent || null;
    if (dueDate !== undefined) fields.due_date = dueDate || null;
    if (Object.keys(fields).length) {
      await Task.update(taskId, fields, userId);
    }

    const updated = await Task.findById(taskId);
    notifyTaskStatusChanged(updated, task.status, userId); // no-op when the status did not change
    return res.status(200).json({ success: true, task: updated });
  } catch (error) {
    console.error('Update task error:', error);
    return fail(res, 500, 'Task could not be updated');
  }
}

// Status-only change for Authors and Editors (route is role-gated). They may only
// touch tasks they own or are assigned.
async function updateTaskStatus(req, res) {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return fail(res, 400, 'Invalid status. Must be one of: open, in_progress, done', 'VALIDATION_ERROR');
    }
    const rawNote = req.body?.description ?? req.body?.note;
    const note = rawNote === undefined || rawNote === null ? '' : String(rawNote).trim();
    if (note.length > 2000) {
      return fail(res, 400, 'Description must be 2000 characters or fewer', 'VALIDATION_ERROR');
    }
    const task = await Task.findById(taskId);
    if (!task) return fail(res, 404, 'Task not found');
    if (!isParticipant(task, req.user)) {
      return fail(res, 403, 'You can only change the status of your own tasks');
    }
    const updated = await Task.updateStatus(taskId, status, Number(req.user.id), note || null);
    notifyTaskStatusChanged(updated, task.status, Number(req.user.id), note || null); // no-op when unchanged
    return res.status(200).json({ success: true, task: updated });
  } catch (error) {
    console.error('Update task status error:', error);
    return fail(res, 500, 'Task status could not be updated');
  }
}

async function deleteTask(req, res) {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findById(taskId);
    if (!task) return fail(res, 404, 'Task not found');
    if (!canSeeAll(req.user) && !isParticipant(task, req.user)) {
      return fail(res, 403, 'You can only delete your own tasks');
    }
    await Task.deleteWithTrash(taskId, Number(req.user.id), 'deleted by user');
    return res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    return fail(res, 500, 'Task could not be deleted');
  }
}

module.exports = { listTasks, getRelatedContent, getMyTasks, getTask, createTask, updateTask, updateTaskStatus, deleteTask };
