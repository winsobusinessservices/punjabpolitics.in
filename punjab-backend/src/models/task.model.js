const pool = require('../config/db');

const PUBLIC_COLUMNS =
  'id, title, description, status, priority, type, related_content, due_date, website_id, owner_id, assignee_id, created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, delete_reason, status_note, status_note_by, status_note_at';

const SELECT_TASK =
  'SELECT ' + PUBLIC_COLUMNS.split(', ').map((c) => 't.' + c).join(', ') +
  ', u.name AS assignee_name, nu.name AS status_note_by_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN users nu ON nu.id = t.status_note_by';

function parseTask(row) {
  if (!row) return null;
  return { ...row };
}

const Task = {

  async ensureSchema(connection) {
    const [tables] = await connection.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      ['tasks']
    );
    if (!tables.length) {
      await connection.query(
        'CREATE TABLE IF NOT EXISTS tasks (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(500) NOT NULL, description TEXT NULL, status ENUM("open","in_progress","done") NOT NULL DEFAULT "open", priority ENUM("low","medium","high") NOT NULL DEFAULT "medium", type ENUM("content","website","policy","review","other") NOT NULL DEFAULT "other", related_content TEXT NULL, due_date DATETIME NULL, website_id INT UNSIGNED NOT NULL DEFAULT 1, owner_id BIGINT UNSIGNED NOT NULL, assignee_id BIGINT UNSIGNED NULL, created_by BIGINT UNSIGNED NOT NULL, updated_by BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, deleted_at DATETIME NULL, deleted_by BIGINT UNSIGNED NULL, delete_reason VARCHAR(500) NULL, INDEX idx_tasks_status (status), INDEX idx_tasks_owner (owner_id), INDEX idx_tasks_assignee (assignee_id), INDEX idx_tasks_website (website_id), INDEX idx_tasks_deleted (deleted_at)) ENGINE=InnoDB'
      );
      return;
    }
    const [updatedByColumns] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['tasks', 'updated_by']
    );
    if (!updatedByColumns.length) {
      await connection.query('ALTER TABLE tasks ADD COLUMN updated_by BIGINT UNSIGNED NULL AFTER created_by');
    }
  },

  async findByStatus(status, { siteId, scopeUserId, limit = 50, offset = 0 } = {}) {
    const where = ['t.deleted_at IS NULL'];
    const params = [];
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }
    if (siteId) {
      where.push('t.website_id = ?');
      params.push(siteId);
    }
    if (scopeUserId) {
      where.push('(t.owner_id = ? OR t.assignee_id = ?)');
      params.push(scopeUserId, scopeUserId);
    }
    params.push(Number(limit), Number(offset));
    const [rows] = await pool.query(
      SELECT_TASK + ' WHERE ' + where.join(' AND ') +
        ' ORDER BY CASE t.priority WHEN "high" THEN 0 WHEN "medium" THEN 1 ELSE 2 END, t.updated_at DESC LIMIT ? OFFSET ?',
      params
    );
    return rows.map(parseTask);
  },

  async findMine({ siteId, userId, limit = 50, offset = 0 } = {}) {
    const where = ['t.deleted_at IS NULL', '(t.owner_id = ? OR t.assignee_id = ?)'];
    const params = [userId, userId];
    if (siteId) {
      where.push('t.website_id = ?');
      params.push(siteId);
    }
    params.push(Number(limit), Number(offset));
    const [rows] = await pool.query(
      SELECT_TASK + ' WHERE ' + where.join(' AND ') + ' ORDER BY t.updated_at DESC LIMIT ? OFFSET ?',
      params
    );
    return rows.map(parseTask);
  },

  async findById(id) {
    const [rows] = await pool.query(
      SELECT_TASK + ' WHERE t.id = ? AND t.deleted_at IS NULL',
      [id]
    );
    return parseTask(rows[0]);
  },

  async create({ title, description, status = 'open', priority = 'medium', type = 'other', relatedContent, dueDate, websiteId, ownerId, assigneeId, createdBy }) {
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, status, priority, type, related_content, due_date, website_id, owner_id, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, status, priority, type, relatedContent, dueDate, websiteId, ownerId, assigneeId, createdBy]
    );
    return Task.findById(result.insertId);
  },

  async updateStatus(id, status, updatedBy, note) {
    if (note !== undefined) {
      await pool.query(
        'UPDATE tasks SET status = ?, status_note = ?, status_note_by = ?, status_note_at = NOW(), updated_at = NOW(), updated_by = ? WHERE id = ? AND deleted_at IS NULL',
        [status, note, note ? updatedBy : null, updatedBy, id]
      );
      return Task.findById(id);
    }
    await pool.query(
      'UPDATE tasks SET status = ?, updated_at = NOW(), updated_by = ? WHERE id = ? AND deleted_at IS NULL',
      [status, updatedBy, id]
    );
    return Task.findById(id);
  },

  async update(id, fields, updatedBy) {
    const allowed = ['title', 'description', 'priority', 'type', 'related_content', 'due_date'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(key + ' = ?');
        params.push(fields[key]);
      }
    }
    if (!sets.length) return Task.findById(id);
    sets.push('updated_at = NOW()', 'updated_by = ?');
    params.push(updatedBy, id);
    await pool.query(
      'UPDATE tasks SET ' + sets.join(', ') + ' WHERE id = ? AND deleted_at IS NULL',
      params
    );
    return Task.findById(id);
  },

  async assign(taskId, assigneeId, updatedBy) {
    await pool.query(
      'UPDATE tasks SET assignee_id = ?, updated_at = NOW(), updated_by = ? WHERE id = ? AND deleted_at IS NULL',
      [assigneeId, updatedBy, taskId]
    );
    return Task.findById(taskId);
  },

  async deleteWithTrash(id, deletedBy, reason = 'deleted by user') {
    const task = await Task.findById(id);
    if (!task) return null;
    await pool.query(
      'UPDATE tasks SET deleted_at = NOW(), deleted_by = ?, delete_reason = ? WHERE id = ? AND deleted_at IS NULL',
      [deletedBy, reason, id]
    );
    return task;
  },

};

module.exports = Task;
