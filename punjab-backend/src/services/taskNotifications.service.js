const pool = require("../config/db");
const {
  TASK_NOTIFICATION_EMAIL,
  sendTaskAssignedEmail,
  sendTaskStatusChangedEmail,
} = require("./nodemailer.service");

// Task emails are best-effort: a mail failure is logged and never fails (or
// delays) the API request that triggered it.

async function loadUsers(ids) {
  const unique = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return new Map();
  const [rows] = await pool.query(
    "SELECT id, name, email FROM users WHERE id IN (?) AND deleted_at IS NULL",
    [unique]
  );
  return new Map(rows.map((row) => [Number(row.id), row]));
}

const displayName = (user) => user?.name || user?.email || "A team member";

// New task -> assignee (including when the creator assigns it to themself).
async function notifyTaskAssigned(task, actorId) {
  try {
    if (!task?.assignee_id) return;
    const users = await loadUsers([task.assignee_id, actorId]);
    const assignee = users.get(Number(task.assignee_id));
    if (!assignee?.email) return;
    await sendTaskAssignedEmail({
      to: assignee.email,
      assigneeName: displayName(assignee),
      assignedByName: displayName(users.get(Number(actorId))),
      task,
      dueDate: task.due_date,
    });
  } catch (error) {
    console.error("Task assigned email failed:", error.message);
  }
}

// Status change -> the task's creator (unless they made the change) and the
// info mailbox.
async function notifyTaskStatusChanged(task, previousStatus, actorId, note) {
  try {
    if (!task || task.status === previousStatus) return;
    const users = await loadUsers([task.owner_id, actorId]);
    const creator = users.get(Number(task.owner_id));
    const recipients = new Set();
    if (creator?.email && Number(task.owner_id) !== Number(actorId)) recipients.add(creator.email);
    if (TASK_NOTIFICATION_EMAIL) recipients.add(TASK_NOTIFICATION_EMAIL);
    const changedByName = displayName(users.get(Number(actorId)));
    await Promise.all([...recipients].map((to) =>
      sendTaskStatusChangedEmail({ to, task, previousStatus, changedByName, note })
        .catch((error) => console.error(`Task status email to ${to} failed:`, error.message))
    ));
  } catch (error) {
    console.error("Task status email failed:", error.message);
  }
}

module.exports = { notifyTaskAssigned, notifyTaskStatusChanged };
