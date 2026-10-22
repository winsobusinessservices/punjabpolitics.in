// Daily activity is sufficient for unique users, streaks and exact-day retention.
// Preserve separate anonymous/authenticated identities and roles during login changes.
async function ensureAnalyticsDaily(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS analytics_daily_activity (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id INT UNSIGNED NOT NULL,
    visitor_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    user_key BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(user_id, 0)) STORED,
    actor_role VARCHAR(30) NOT NULL DEFAULT '',
    surface ENUM('PUBLIC', 'PANEL') NOT NULL,
    activity_date DATE NOT NULL,
    occurred_at DATETIME NOT NULL,
    last_activity_at DATETIME NOT NULL,
    UNIQUE KEY uq_daily_identity (site_id, visitor_id, user_key, actor_role, surface, activity_date),
    INDEX idx_daily_site_date (site_id, activity_date),
    INDEX idx_daily_site_first (site_id, occurred_at),
    INDEX idx_daily_user (site_id, user_id, activity_date)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS analytics_migrations (
    name VARCHAR(100) PRIMARY KEY, completed_at DATETIME NULL
  ) ENGINE=InnoDB`);
  await connection.query("INSERT IGNORE INTO analytics_migrations (name) VALUES ('daily_activity_v1')");
  await connection.beginTransaction();
  try {
    const [[migration]] = await connection.query("SELECT completed_at FROM analytics_migrations WHERE name = 'daily_activity_v1' FOR UPDATE");
    if (!migration.completed_at) {
      await connection.query(`INSERT INTO analytics_daily_activity
        (site_id, visitor_id, user_id, actor_role, surface, activity_date, occurred_at, last_activity_at)
        SELECT site_id, visitor_id, user_id, COALESCE(actor_role, ''), surface,
          DATE(DATE_ADD(occurred_at, INTERVAL 330 MINUTE)), MIN(occurred_at), MAX(occurred_at)
        FROM analytics_events
        GROUP BY site_id, visitor_id, user_id, COALESCE(actor_role, ''), surface,
          DATE(DATE_ADD(occurred_at, INTERVAL 330 MINUTE))
        ON DUPLICATE KEY UPDATE occurred_at = LEAST(occurred_at, VALUES(occurred_at)),
          last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at))`);
      await connection.query("UPDATE analytics_migrations SET completed_at = UTC_TIMESTAMP() WHERE name = 'daily_activity_v1'");
    }
    await connection.commit();
    await ensureUserDaily(connection);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

module.exports = { ensureAnalyticsDaily };

async function ensureUserDaily(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS analytics_user_daily (
    site_id INT UNSIGNED NOT NULL,
    identity_key VARCHAR(50) NOT NULL,
    visitor_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    activity_date DATE NOT NULL,
    public_at DATETIME NULL,
    panel_active TINYINT UNSIGNED NOT NULL DEFAULT 0,
    role_flags INT UNSIGNED NOT NULL DEFAULT 0,
    occurred_at DATETIME NOT NULL,
    last_activity_at DATETIME NOT NULL,
    PRIMARY KEY (site_id, identity_key, activity_date),
    INDEX idx_user_daily_date (site_id, occurred_at),
    INDEX idx_user_daily_public (site_id, public_at)
  ) ENGINE=InnoDB`);
  await connection.query("INSERT IGNORE INTO analytics_migrations (name) VALUES ('user_daily_v2')");
  await connection.beginTransaction();
  try {
    const [[migration]] = await connection.query("SELECT completed_at FROM analytics_migrations WHERE name = 'user_daily_v2' FOR UPDATE");
    if (!migration.completed_at) {
      await connection.query(`INSERT INTO analytics_user_daily
        (site_id, identity_key, visitor_id, user_id, activity_date, public_at,
         panel_active, role_flags, occurred_at, last_activity_at)
        SELECT site_id, CASE WHEN user_id IS NOT NULL THEN CONCAT('USER:', user_id)
          ELSE CONCAT('ANON:', visitor_id) END, MIN(visitor_id), user_id, activity_date,
          MIN(CASE WHEN surface = 'PUBLIC' THEN occurred_at END), MAX(surface = 'PANEL'),
          BIT_OR(CASE actor_role WHEN 'AUTHOR' THEN 1 WHEN 'EDITOR' THEN 2
            WHEN 'INVESTOR' THEN 4 WHEN 'ADMIN' THEN 8 WHEN 'SUBADMIN' THEN 8 ELSE 0 END),
          MIN(occurred_at), MAX(last_activity_at)
        FROM analytics_daily_activity
        GROUP BY site_id, CASE WHEN user_id IS NOT NULL THEN CONCAT('USER:', user_id)
          ELSE CONCAT('ANON:', visitor_id) END, user_id, activity_date
        ON DUPLICATE KEY UPDATE
          public_at = COALESCE(LEAST(public_at, VALUES(public_at)), public_at, VALUES(public_at)),
          panel_active = panel_active | VALUES(panel_active),
          role_flags = role_flags | VALUES(role_flags),
          occurred_at = LEAST(occurred_at, VALUES(occurred_at)),
          last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at))`);
      await connection.query("UPDATE analytics_migrations SET completed_at = UTC_TIMESTAMP() WHERE name = 'user_daily_v2'");
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
