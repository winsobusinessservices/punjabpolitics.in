const mysql = require("mysql2/promise");
require("dotenv").config();
const ensureBaseSchema = require("./baseSchema");
const { ensureAnalyticsDaily } = require("../services/analyticsDaily.service");

const databaseName = process.env.DB_NAME;
if (!/^[A-Za-z0-9_-]+$/.test(databaseName || "")) {
  throw new Error("DB_NAME must contain only letters, numbers, underscores, or hyphens");
}

const connectionOptions = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const pool = mysql.createPool({
  ...connectionOptions,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.verifyConnection = async () => {
  if (process.env.NODE_ENV !== "production") {
    const bootstrapConnection = await mysql.createConnection(connectionOptions);
    try {
      await bootstrapConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } finally {
      await bootstrapConnection.end();
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.query("SELECT 1");
    await ensureBaseSchema(connection);

    // Task management
    await connection.query(`CREATE TABLE IF NOT EXISTS tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      status ENUM('open','in_progress','done') NOT NULL DEFAULT 'open',
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      type ENUM('content','website','policy','review','other') NOT NULL DEFAULT 'other',
      related_content TEXT NULL,
      due_date DATETIME NULL,
      website_id INT UNSIGNED NOT NULL DEFAULT 1,
      owner_id BIGINT UNSIGNED NOT NULL,
      assignee_id BIGINT UNSIGNED NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      deleted_by BIGINT UNSIGNED NULL,
      delete_reason VARCHAR(500) NULL,
      INDEX idx_tasks_status (status),
      INDEX idx_tasks_owner (owner_id),
      INDEX idx_tasks_assignee (assignee_id),
      INDEX idx_tasks_website (website_id),
      INDEX idx_tasks_deleted (deleted_at)
    ) ENGINE=InnoDB`);
    const [taskColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'updated_by'`
    );
    if (!taskColumns.length) {
      await connection.query("ALTER TABLE tasks ADD COLUMN updated_by BIGINT UNSIGNED NULL AFTER created_by");
    }
    // Note an Author/Editor writes when changing a task's status.
    for (const [column, definition] of [
      ["status_note", "TEXT NULL"],
      ["status_note_by", "BIGINT UNSIGNED NULL"],
      ["status_note_at", "DATETIME NULL"],
    ]) {
      const [existing] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = ?`,
        [column]
      );
      if (!existing.length) await connection.query(`ALTER TABLE tasks ADD COLUMN ${column} ${definition}`);
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS sites (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        slug VARCHAR(120) NOT NULL UNIQUE,
        domain VARCHAR(255) NOT NULL UNIQUE,
        logo_url VARCHAR(2000) NULL,
        primary_color VARCHAR(20) NULL,
        secondary_color VARCHAR(20) NULL,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `INSERT IGNORE INTO sites (id, name, slug, domain, status) VALUES (1, ?, ?, ?, 'ACTIVE')`,
      [
        process.env.SITE_NAME || "Punjab Politics",
        process.env.SITE_SLUG || "punjab-politics",
        process.env.SITE_DOMAIN || "punjabpolitics.com",
      ]
    );
    const [siteServiceColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'services_enabled'`
    );
    if (!siteServiceColumns.length) {
      await connection.query("ALTER TABLE sites ADD COLUMN services_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status");
    }
    const siteBrandColumns = [
      ["subtitle", "VARCHAR(255) NULL AFTER name"],
      ["description", "VARCHAR(1000) NULL AFTER subtitle"],
      ["icon_url", "VARCHAR(2000) NULL AFTER logo_url"],
      ["social_links", "JSON NULL AFTER secondary_color"],
    ];
    for (const [column, definition] of siteBrandColumns) {
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sites' AND COLUMN_NAME = ?`,
        [column]
      );
      if (!columns.length) await connection.query(`ALTER TABLE sites ADD COLUMN \`${column}\` ${definition}`);
    }
    await connection.query("UPDATE sites SET services_enabled = 1 WHERE slug = ?", [process.env.SITE_SLUG || "punjab-politics"]);
    await connection.query(
      `CREATE TABLE IF NOT EXISTS site_reference_visibility (
        site_id INT UNSIGNED NOT NULL,
        reference_type ENUM('PARTY','POLITICIAN','STATE','DISTRICT') NOT NULL,
        reference_id BIGINT UNSIGNED NOT NULL,
        is_visible TINYINT(1) NOT NULL DEFAULT 1,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (site_id, reference_type, reference_id),
        INDEX idx_reference_visibility (site_id, reference_type, is_visible)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      "ALTER TABLE site_reference_visibility MODIFY COLUMN reference_type ENUM('PARTY','POLITICIAN','STATE','DISTRICT') NOT NULL"
    );
    for (const tableName of ["users", "articles", "blogs", "videos", "categories"]) {
      const [siteTables] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      if (!siteTables.length) continue;
      const [siteColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'site_id'`,
        [tableName]
      );
      if (!siteColumns.length) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1`);
        await connection.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`idx_${tableName}_site\` (site_id)`);
      }
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS services (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        site_id INT UNSIGNED NOT NULL,
        title VARCHAR(180) NOT NULL,
        slug VARCHAR(220) NOT NULL,
        summary VARCHAR(800) NULL,
        content LONGTEXT NOT NULL,
        icon VARCHAR(100) NULL,
        image_url VARCHAR(2000) NULL,
        cta_label VARCHAR(100) NULL,
        cta_url VARCHAR(2000) NULL,
        seo_title VARCHAR(200) NULL,
        seo_description VARCHAR(500) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_visible TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_services_site_slug (site_id, slug),
        INDEX idx_services_site_visible_sort (site_id, is_visible, sort_order)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS ads (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        site_id INT UNSIGNED NOT NULL DEFAULT 1,
        advertiser VARCHAR(160) NOT NULL,
        title VARCHAR(180) NOT NULL,
        placement VARCHAR(40) NOT NULL,
        image_url VARCHAR(2000) NOT NULL,
        link_url VARCHAR(2000) NOT NULL,
        alt_text VARCHAR(200) NULL,
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ads_site_placement (site_id, placement, is_active)
      ) ENGINE=InnoDB`
    );
    // Text-card ad fields were added after the first release of the ads table.
    for (const [column, definition] of [
      ["logo_url", "VARCHAR(2000) NULL AFTER alt_text"], ["display_url", "VARCHAR(200) NULL AFTER logo_url"],
      ["headline", "VARCHAR(200) NULL AFTER display_url"], ["description", "VARCHAR(500) NULL AFTER headline"],
      ["cta_label", "VARCHAR(60) NULL AFTER description"],
    ]) {
      const [found] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ads' AND COLUMN_NAME = ?", [column]
      );
      if (!found.length) await connection.query(`ALTER TABLE ads ADD COLUMN ${column} ${definition}`);
    }
    await connection.query("ALTER TABLE ads MODIFY image_url VARCHAR(2000) NULL");
    const [permissionColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'permissions'`
    );
    if (!permissionColumns.length) {
      await connection.query("ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role");
    }
    // Panel access can be switched off without touching website access: a user whose
    // panel_status is INACTIVE signs in as a normal website user.
    const [panelStatusColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'panel_status'`
    );
    if (!panelStatusColumns.length) {
      await connection.query("ALTER TABLE users ADD COLUMN panel_status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER status");
    }
    // Profile page: mobile number and profile picture.
    for (const [column, definition] of [
      ["phone", "VARCHAR(20) NULL"],
      ["profile_picture", "VARCHAR(500) NULL"],
    ]) {
      const [existing] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [column]
      );
      if (!existing.length) await connection.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
    // The mobile number is just contact information (not verified), so it is not unique.
    const [phoneIndex] = await connection.query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_phone'");
    if (phoneIndex.length) await connection.query("ALTER TABLE users DROP INDEX uq_users_phone");
    const [googleSubColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_sub'`
    );
    if (!googleSubColumns.length) {
      await connection.query("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) NULL UNIQUE AFTER password_hash");
    }
    const [acceptedPolicyColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'accepted_policy_ids'`
    );
    if (!acceptedPolicyColumns.length) {
      await connection.query("ALTER TABLE users ADD COLUMN accepted_policy_ids JSON NULL AFTER terms_accepted_at");
    }
    const [roleApplicationTables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_applications'`
    );
    if (roleApplicationTables.length) {
      const [applicantUserColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_applications' AND COLUMN_NAME = 'applicant_user_id'`
      );
      if (!applicantUserColumns.length) {
        await connection.query("ALTER TABLE role_applications ADD COLUMN applicant_user_id BIGINT UNSIGNED NULL AFTER id");
        await connection.query("ALTER TABLE role_applications ADD INDEX idx_role_applications_applicant (applicant_user_id, status)");
      }
      for (const [column, definition] of [["location", "VARCHAR(255) NULL AFTER phone"], ["pan_number", "VARCHAR(10) NULL AFTER location"], ["aadhar_number", "VARCHAR(12) NULL AFTER pan_number"]]) {
        const [columns] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_applications' AND COLUMN_NAME = ?`,
          [column]
        );
        if (!columns.length) await connection.query(`ALTER TABLE role_applications ADD COLUMN \`${column}\` ${definition}`);
      }
      const [passwordColumns] = await connection.query(
        `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_applications' AND COLUMN_NAME = 'password_hash'`
      );
      if (passwordColumns[0]?.IS_NULLABLE === "NO") await connection.query("ALTER TABLE role_applications MODIFY password_hash VARCHAR(255) NULL");
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS editor_author_assignments (
        author_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        editor_id BIGINT UNSIGNED NOT NULL,
        assigned_by BIGINT UNSIGNED NULL,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_editor_author_editor (editor_id)
      ) ENGINE=InnoDB`
    );
    for (const tableName of ["articles", "blogs"]) {
      const [scheduleColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'scheduled_publish_at'`,
        [tableName]
      );
      if (!scheduleColumns.length) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN scheduled_publish_at DATETIME NULL AFTER published_at`);
      }
    }
    for (const tableName of ["articles", "blogs", "videos"]) {
      const [commentSettingColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'comments_enabled'`,
        [tableName]
      );
      if (!commentSettingColumns.length) {
        await connection.query(
          `ALTER TABLE \`${tableName}\` ADD COLUMN comments_enabled TINYINT(1) NOT NULL DEFAULT 1`
        );
      }
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS comments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        site_id INT UNSIGNED NOT NULL DEFAULT 1,
        author_id BIGINT UNSIGNED NOT NULL,
        post_type ENUM('ARTICLE', 'BLOG') NOT NULL,
        post_id VARCHAR(100) NOT NULL,
        post_slug VARCHAR(255) NOT NULL,
        post_title VARCHAR(500) NOT NULL,
        content VARCHAR(1000) NOT NULL,
        status ENUM('VISIBLE', 'HIDDEN') NOT NULL DEFAULT 'VISIBLE',
        hidden_by BIGINT UNSIGNED NULL,
        hidden_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comments_post_status_created (post_slug, status, created_at),
        INDEX idx_comments_author (author_id, created_at)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS content_daily_limits (
        site_id INT UNSIGNED NOT NULL DEFAULT 1,
        role ENUM('AUTHOR', 'EDITOR') NOT NULL,
        content_type ENUM('ARTICLE', 'BLOG', 'VIDEO') NOT NULL,
        daily_limit INT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (site_id, role, content_type)
      ) ENGINE=InnoDB`
    );
    const [commentSiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'site_id'`
    );
    if (!commentSiteColumns.length) {
      await connection.query("ALTER TABLE comments ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id, ADD INDEX idx_comments_site (site_id)");
      await connection.query(
        `UPDATE comments c
         LEFT JOIN articles a ON c.post_type = 'ARTICLE' AND CAST(c.post_id AS UNSIGNED) = a.id
         LEFT JOIN blogs b ON c.post_type = 'BLOG' AND CAST(c.post_id AS UNSIGNED) = b.id
         SET c.site_id = COALESCE(a.site_id, b.site_id, 1)`
      );
    }
    const [contentLimitSiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_daily_limits' AND COLUMN_NAME = 'site_id'`
    );
    if (!contentLimitSiteColumns.length) {
      await connection.query("ALTER TABLE content_daily_limits DROP PRIMARY KEY, ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 FIRST, ADD PRIMARY KEY (site_id, role, content_type)");
    }
    await connection.query(
      `INSERT IGNORE INTO content_daily_limits (site_id, role, content_type, daily_limit)
       SELECT sites.id, defaults.role, defaults.content_type, defaults.daily_limit
       FROM sites CROSS JOIN (
         SELECT 'AUTHOR' role, 'ARTICLE' content_type, 5 daily_limit UNION ALL
         SELECT 'AUTHOR', 'BLOG', 5 UNION ALL SELECT 'AUTHOR', 'VIDEO', 2 UNION ALL
         SELECT 'EDITOR', 'ARTICLE', 10 UNION ALL SELECT 'EDITOR', 'BLOG', 10 UNION ALL
         SELECT 'EDITOR', 'VIDEO', 5
       ) defaults`
    );
    const [roleColumns] = await connection.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
    );
    if (roleColumns[0]?.COLUMN_TYPE?.toUpperCase().startsWith("ENUM(") && !roleColumns[0].COLUMN_TYPE.toUpperCase().includes("SUBADMIN")) {
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('USER','ADMIN','SUBADMIN','EDITOR','AUTHOR','INVESTOR') NOT NULL DEFAULT 'USER'"
      );
    }

    // The Site Data form exposes Party leader as a politician category. Keep
    // existing databases in sync with that dropdown as well as fresh schemas;
    // otherwise MySQL rejects edits with "Data truncated for column category".
    const [politicianCategoryColumns] = await connection.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'politicians' AND COLUMN_NAME = 'category'`
    );
    if (
      politicianCategoryColumns[0]?.COLUMN_TYPE?.toUpperCase().startsWith("ENUM(") &&
      !politicianCategoryColumns[0].COLUMN_TYPE.toUpperCase().includes("PARTY_LEADER")
    ) {
      await connection.query(
        "ALTER TABLE politicians MODIFY COLUMN category ENUM('KEY_FIGURE','FORMER_PM','CHIEF_MINISTER','PARTY_LEADER') NOT NULL"
      );
    }

    const [stateColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'states'
       AND COLUMN_NAME IN ('image_url', 'current_cm_name', 'cm_image_url', 'opposition_leader_name', 'opposition_party', 'opposition_leader_image_url')`
    );
    const existingStateColumns = new Set(stateColumns.map((column) => column.COLUMN_NAME));
    if (!existingStateColumns.has("image_url")) {
      await connection.query("ALTER TABLE states ADD COLUMN image_url VARCHAR(2000) NULL AFTER capital");
    }
    if (!existingStateColumns.has("current_cm_name")) {
      await connection.query("ALTER TABLE states ADD COLUMN current_cm_name VARCHAR(200) NULL AFTER image_url");
    }
    if (!existingStateColumns.has("cm_image_url")) {
      await connection.query("ALTER TABLE states ADD COLUMN cm_image_url VARCHAR(2000) NULL AFTER current_cm_name");
    }
    if (!existingStateColumns.has("opposition_leader_name")) {
      await connection.query("ALTER TABLE states ADD COLUMN opposition_leader_name VARCHAR(200) NULL AFTER cm_image_url");
    }
    if (!existingStateColumns.has("opposition_party")) {
      await connection.query("ALTER TABLE states ADD COLUMN opposition_party VARCHAR(250) NULL AFTER opposition_leader_name");
    }
    if (!existingStateColumns.has("opposition_leader_image_url")) {
      await connection.query("ALTER TABLE states ADD COLUMN opposition_leader_image_url VARCHAR(2000) NULL AFTER opposition_party");
    }

    // Political reference records are editable site content too. Give every
    // website its own copy so editing or deleting a leader, party, or state
    // on one website cannot alter another website.
    for (const tableName of ["politicians", "parties", "states"]) {
      const [referenceSiteColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'site_id'`,
        [tableName]
      );
      if (!referenceSiteColumns.length) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id, ADD INDEX \`idx_${tableName}_site\` (site_id)`);
        const [uniqueIndexes] = await connection.query(
          `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) columns_list, COUNT(*) column_count
           FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'
           GROUP BY INDEX_NAME`,
          [tableName]
        );
        for (const index of uniqueIndexes) {
          if (Number(index.column_count) !== 1) continue;
          const column = String(index.columns_list);
          await connection.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${index.INDEX_NAME}\``);
          await connection.query(`ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`uq_${tableName}_site_${column}\` (site_id, \`${column}\`)`);
        }
        const [copyColumns] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME NOT IN ('id', 'site_id') AND EXTRA NOT LIKE '%auto_increment%'
           ORDER BY ORDINAL_POSITION`,
          [tableName]
        );
        const columnsSql = copyColumns.map((column) => `\`${column.COLUMN_NAME}\``).join(", ");
        const sourceSql = copyColumns.map((column) => `source.\`${column.COLUMN_NAME}\``).join(", ");
        await connection.query(
          `INSERT IGNORE INTO \`${tableName}\` (site_id, ${columnsSql})
           SELECT target.id, ${sourceSql}
           FROM sites target JOIN \`${tableName}\` source ON source.site_id = 1
           WHERE target.id <> 1`
        );
      }
    }
    for (const [tableName, referenceType] of [["politicians", "POLITICIAN"], ["parties", "PARTY"], ["states", "STATE"], ["districts", "DISTRICT"]]) {
      await connection.query(
        `INSERT INTO site_reference_visibility (site_id, reference_type, reference_id, is_visible, updated_by)
         SELECT visibility.site_id, ?, site_copy.id, visibility.is_visible, visibility.updated_by
         FROM site_reference_visibility visibility
         JOIN \`${tableName}\` source ON source.id = visibility.reference_id AND source.site_id = 1
         JOIN \`${tableName}\` site_copy ON site_copy.site_id = visibility.site_id AND site_copy.slug = source.slug
         WHERE visibility.reference_type = ? AND visibility.site_id <> 1
         ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible), updated_by = VALUES(updated_by)`,
        [referenceType, referenceType]
      );
    }



    // Premium subscriptions: one row per purchase of one month. See models/subscription.model.js.
    await connection.query(`
  CREATE TABLE IF NOT EXISTS premium_subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL,
    site_id INT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NULL,
    amount_paise INT UNSIGNED NOT NULL,
    days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    status ENUM('CREATED', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    provider VARCHAR(20) NOT NULL,
    provider_order_id VARCHAR(100) NULL,
    provider_payment_id VARCHAR(100) NULL,
    receipt_number VARCHAR(30) NULL,
    consent_at DATETIME NULL,
    paid_at DATETIME NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_premium_public (public_id),
    UNIQUE KEY uq_premium_receipt (receipt_number),
    UNIQUE KEY uq_premium_payment (provider, provider_payment_id),
    INDEX idx_premium_user (user_id, status, ends_at),
    INDEX idx_premium_order (provider_order_id),
    INDEX idx_premium_site (site_id, status, paid_at)
  ) ENGINE=InnoDB
`);

    {
      const [planColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'premium_subscriptions' AND COLUMN_NAME = 'plan_name'`
      );
      if (!planColumns.length) {
        await connection.query("ALTER TABLE premium_subscriptions ADD COLUMN plan_id VARCHAR(40) NULL AFTER phone, ADD COLUMN plan_name VARCHAR(40) NULL AFTER plan_id");
      }
    }

    {
      // Interest notifications: browser subscriptions, what was sent to whom, which items were already looked at, the
      // on/off switch with the hour sending starts (India time), and the same log for the email channel.
      await connection.query(`
  CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    visitor_id CHAR(36) NULL,
    site_id INT UNSIGNED NOT NULL DEFAULT 1,
    endpoint VARCHAR(2000) NOT NULL,
    endpoint_hash CHAR(64) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth_key VARCHAR(255) NOT NULL,
    topics JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_success_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_push_endpoint (endpoint_hash),
    INDEX idx_push_user (user_id),
    INDEX idx_push_visitor (visitor_id),
    INDEX idx_push_site (site_id, is_active)
  ) ENGINE=InnoDB
`);
      await connection.query(`
  CREATE TABLE IF NOT EXISTS push_notification_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(30) NOT NULL,
    ref VARCHAR(191) NOT NULL,
    title VARCHAR(200) NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_push_log_item (subscription_id, kind, ref),
    INDEX idx_push_log_sent (subscription_id, sent_at)
  ) ENGINE=InnoDB
`);
      await connection.query(`
  CREATE TABLE IF NOT EXISTS push_dispatched_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id INT UNSIGNED NOT NULL,
    kind VARCHAR(30) NOT NULL,
    ref VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_push_item (site_id, kind, ref)
  ) ENGINE=InnoDB
`);
      await connection.query(`
  CREATE TABLE IF NOT EXISTS interest_push_settings (
    site_id INT UNSIGNED PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    send_from_hour TINYINT UNSIGNED NOT NULL DEFAULT 12,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB
`);
      await connection.query(`
  CREATE TABLE IF NOT EXISTS interest_email_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    preference_id BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(30) NOT NULL,
    ref VARCHAR(191) NOT NULL,
    title VARCHAR(200) NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email_log_item (preference_id, kind, ref),
    INDEX idx_email_log_sent (preference_id, sent_at)
  ) ENGINE=InnoDB
`);

      // Interest notifications (only exists when that feature is installed): send from this hour of the day (India time).
      const [pushTable] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'interest_push_settings'`
      );
      if (pushTable.length) {
        const [hourColumns] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'interest_push_settings' AND COLUMN_NAME = 'send_from_hour'`
        );
        if (!hourColumns.length) await connection.query("ALTER TABLE interest_push_settings ADD COLUMN send_from_hour TINYINT UNSIGNED NOT NULL DEFAULT 12 AFTER enabled");
      }
    }

    // Which articles are for Premium members only (null = free). See config/premiumConfig.js for the allowed kinds.
    {
      const [premiumColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'premium_type'`
      );
      if (!premiumColumns.length) await connection.query("ALTER TABLE articles ADD COLUMN premium_type VARCHAR(40) NULL");
    }

    // A "subscribers only" category: its stories count as premium and the category gets a card on /premium.
    {
      const [premiumCategoryColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_premium'`
      );
      if (!premiumCategoryColumns.length) await connection.query("ALTER TABLE categories ADD COLUMN is_premium TINYINT(1) NOT NULL DEFAULT 0");
    }

    // Support (donations): one row per payment. See models/donation.model.js.
    await connection.query(`
  CREATE TABLE IF NOT EXISTS donations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL,
    site_id INT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NULL,
    message VARCHAR(300) NULL,
    show_on_wall TINYINT(1) NOT NULL DEFAULT 0,
    kind ENUM('ONE_TIME', 'MONTHLY') NOT NULL DEFAULT 'ONE_TIME',
    amount_paise INT UNSIGNED NOT NULL,
    status ENUM('CREATED', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
    provider VARCHAR(20) NOT NULL,
    provider_order_id VARCHAR(100) NULL,
    provider_subscription_id VARCHAR(100) NULL,
    provider_payment_id VARCHAR(100) NULL,
    parent_id BIGINT UNSIGNED NULL,
    receipt_number VARCHAR(30) NULL,
    consent_at DATETIME NULL,
    paid_at DATETIME NULL,
    refunded_at DATETIME NULL,
    subscription_ended_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_donation_public (public_id),
    UNIQUE KEY uq_donation_receipt (receipt_number),
    UNIQUE KEY uq_donation_payment (provider, provider_payment_id),
    INDEX idx_donation_site (site_id, status, paid_at),
    INDEX idx_donation_user (user_id, status),
    INDEX idx_donation_order (provider_order_id),
    INDEX idx_donation_subscription (provider_subscription_id)
  ) ENGINE=InnoDB
`);

    // "My interests" survey answers: one row per reader, a signed-in account or an anonymous browser.
    await connection.query(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    visitor_id CHAR(36) NULL,
    site_id INT UNSIGNED NOT NULL DEFAULT 1,
    topics JSON NULL,
    regions JSON NULL,
    parties JSON NULL,
    content_types JSON NULL,
    channels JSON NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
    feedback VARCHAR(1000) NULL,
    email VARCHAR(254) NULL,
    phone VARCHAR(20) NULL,
    ip_hash CHAR(64) NULL,
    notify_consent TINYINT(1) NOT NULL DEFAULT 0,
    notify_consent_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_preferences_user (user_id),
    UNIQUE KEY uq_preferences_visitor (visitor_id),
    INDEX idx_preferences_site (site_id)
  ) ENGINE=InnoDB
`);

    // Messages sent through the Contact page (kept so the sender can see them under My Activity).
    await connection.query(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id INT UNSIGNED NOT NULL DEFAULT 1,
    user_id BIGINT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NULL,
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contact_user (user_id, created_at),
    INDEX idx_contact_email (email, created_at)
  ) ENGINE=InnoDB
`);

    // What the subscription page shows and charges, editable by an admin. One row per website; no row = the defaults.
    await connection.query(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    site_id INT UNSIGNED PRIMARY KEY,
    plans JSON NOT NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB
`);

    await connection.query(
      `CREATE TABLE IF NOT EXISTS categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL UNIQUE,
        is_visible TINYINT(1) NOT NULL DEFAULT 1,
        content LONGTEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_categories_name (name)
      ) ENGINE=InnoDB`
    );
    const [categoryVisibilityColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_visible'`
    );
    if (!categoryVisibilityColumns.length) {
      await connection.query("ALTER TABLE categories ADD COLUMN is_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER slug");
    }
    const [categoryContentColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'content'`
    );
    if (!categoryContentColumns.length) {
      await connection.query("ALTER TABLE categories ADD COLUMN content LONGTEXT NULL AFTER is_visible");
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS policies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(220) NOT NULL UNIQUE,
        title VARCHAR(200) NOT NULL,
        policy_type VARCHAR(100) NOT NULL,
        summary VARCHAR(600) NOT NULL,
        content LONGTEXT NOT NULL,
        status ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
        show_on_registration TINYINT(1) NOT NULL DEFAULT 0,
        created_by BIGINT UNSIGNED NOT NULL,
        published_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_policies_status_published (status, published_at),
        INDEX idx_policies_type (policy_type)
      ) ENGINE=InnoDB`
    );
    const [policyRegistrationColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'policies' AND COLUMN_NAME = 'show_on_registration'`
    );
    if (!policyRegistrationColumns.length) {
      await connection.query("ALTER TABLE policies ADD COLUMN show_on_registration TINYINT(1) NOT NULL DEFAULT 0 AFTER status");
    }
    const [policySiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'policies' AND COLUMN_NAME = 'site_id'`
    );
    if (!policySiteColumns.length) {
      await connection.query("ALTER TABLE policies ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id, ADD INDEX idx_policies_site (site_id)");
      const [policySlugIndexes] = await connection.query(
        `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'policies' AND NON_UNIQUE = 0 AND COLUMN_NAME = 'slug'`
      );
      for (const index of policySlugIndexes) {
        if (index.INDEX_NAME !== "PRIMARY") await connection.query(`ALTER TABLE policies DROP INDEX \`${index.INDEX_NAME}\``);
      }
      await connection.query("ALTER TABLE policies ADD UNIQUE KEY uq_policies_site_slug (site_id, slug)");
    }

    const [careerSiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'career_jobs' AND COLUMN_NAME = 'site_id'`
    );
    if (!careerSiteColumns.length) {
      await connection.query("ALTER TABLE career_jobs ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id, ADD INDEX idx_career_jobs_site (site_id)");
      const [careerSlugIndexes] = await connection.query(
        `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'career_jobs' AND NON_UNIQUE = 0 AND COLUMN_NAME = 'slug'`
      );
      for (const index of careerSlugIndexes) {
        if (index.INDEX_NAME !== "PRIMARY") await connection.query(`ALTER TABLE career_jobs DROP INDEX \`${index.INDEX_NAME}\``);
      }
      await connection.query("ALTER TABLE career_jobs ADD UNIQUE KEY uq_career_jobs_site_slug (site_id, slug)");
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS ui_sections (
        section_key VARCHAR(80) NOT NULL PRIMARY KEY,
        label VARCHAR(120) NOT NULL,
        is_visible TINYINT(1) NOT NULL DEFAULT 1,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    const defaultSections = [
      ["breaking_news", "Breaking News"], ["hero_news", "Hero News"],
      ["top_stories", "Top Stories"], ["vidhan_sabha", "Vidhan Sabha"], ["editorial_opinion", "Editorial Opinion"],
      ["latest_blogs", "Latest Blogs"], ["regional_focus", "Regional Focus"],
      ["in_depth_analysis", "In-Depth Analysis"], ["multimedia_hub", "Multimedia Hub"],
      ["key_figures", "Politicians"], ["former_prime_ministers", "Former Prime Ministers"],
      ["voices_of_nation", "Voices of the Nation"], ["state_leadership", "State Leadership"],
      ["political_parties", "Indian Political Parties"], ["parliament", "Parliament"],
      ["digital_dispatches", "Digital Dispatches"], ["cm_corner", "Chief Minister's Corner"], ["pm_corner", "Prime Minister's Corner"],
      ["press_conferences", "Press Conference Archive"], ["home_sidebar", "Homepage Sidebar"],
      ["popular_tags", "Popular Tags"], ["main_ad", "Homepage Main Advertisement"],
      ["video_highlights", "Video Highlights"], ["x_feed", "X Feed"],
      ["facebook_updates", "Facebook Updates"], ["trending_news", "Trending News"],
      ["follow_us", "Follow Us"], ["poll_of_the_day", "Poll of the Day"],
      ["legislative_tracker", "Legislative Tracker"], ["parliament_strength", "Parliament Strength"],
      ["political_calendar", "Political Calendar"], ["rti_corner", "RTI Corner"],
      ["digital_pulse", "Digital Pulse"], ["opinion_leaders", "Opinion Leaders"],
      ["party_pulse", "Party Pulse"], ["fact_check", "Fact Check"],
      ["the_briefing", "The Briefing"], ["from_the_archives", "From the Archives"],
      ["election_results", "Election Results"], ["sidebar_ad", "Homepage Sidebar Advertisement"],
      ["political_keywords", "Political Keywords"], ["states_keywords", "States Keywords"],
      ["union_territories", "Union Territories"], ["elections_by_state", "Elections by State"],
      ["parties_keywords", "Political Parties Keywords"], ["category_keywords", "Category Keywords"],
      ["constituency_spotlight", "Constituency Spotlight"], ["latest_updates", "Latest Updates"],
      ["more_blogs", "More Blogs"],
    ];
    await connection.query(
      `INSERT IGNORE INTO ui_sections (section_key, label) VALUES ${defaultSections.map(() => "(?, ?)").join(", ")}`,
      defaultSections.flat()
    );
    // "Key Political Figures" was renamed to "Politicians".
    await connection.query("UPDATE ui_sections SET label = 'Politicians' WHERE section_key = 'key_figures' AND label = 'Key Political Figures'");
    const websiteFeatures = [
      ["feature_videos", "Videos"], ["feature_blogs", "Blogs"], ["feature_policies", "Policies"],
      ["feature_parties", "Political Parties"], ["feature_leaders", "Political Leaders"],
      ["feature_states", "States"], ["feature_careers", "Careers"]
      , ["feature_comments", "Comments"]
    ];
    await connection.query(
      `INSERT IGNORE INTO ui_sections (section_key, label) VALUES ${websiteFeatures.map(() => "(?, ?)").join(", ")}`,
      websiteFeatures.flat()
    );

    // Wallet totals are kept separately from the immutable transaction
    // ledger. Point-awarding and withdrawal flows can update both in one
    // database transaction when those features are introduced.
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallets (
        user_id INT NOT NULL PRIMARY KEY,
        available_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
        pending_withdrawal_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
        lifetime_earned_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
        lifetime_withdrawn_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_transactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        direction ENUM('CREDIT', 'DEBIT') NOT NULL,
        category VARCHAR(40) NOT NULL,
        points BIGINT UNSIGNED NOT NULL,
        balance_after BIGINT UNSIGNED NOT NULL,
        status ENUM('PENDING', 'COMPLETED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
        description VARCHAR(255) NOT NULL,
        reference_type VARCHAR(40) NULL,
        reference_id BIGINT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_transactions_user_created (user_id, created_at, id),
        UNIQUE KEY uq_wallet_transaction_reference (user_id, category, reference_type, reference_id)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_withdrawal_access (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_withdrawal_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        withdrawal_day TINYINT UNSIGNED NOT NULL DEFAULT 7,
        minimum_withdrawal_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 1000.00,
        author_minimum_remaining_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 200.00,
        editor_minimum_remaining_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 500.00,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      "INSERT IGNORE INTO wallet_withdrawal_settings (id, withdrawal_day) VALUES (1, 7)"
    );
    const [minimumWithdrawalColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawal_settings'
       AND COLUMN_NAME = 'minimum_withdrawal_inr'`
    );
    if (!minimumWithdrawalColumns.length) {
      await connection.query(
        "ALTER TABLE wallet_withdrawal_settings ADD COLUMN minimum_withdrawal_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 1000.00 AFTER withdrawal_day"
      );
    }
    const [remainingBalanceColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawal_settings'
       AND COLUMN_NAME IN ('author_minimum_remaining_inr', 'editor_minimum_remaining_inr')`
    );
    const existingRemainingBalanceColumns = new Set(remainingBalanceColumns.map((column) => column.COLUMN_NAME));
    if (!existingRemainingBalanceColumns.has("author_minimum_remaining_inr")) {
      await connection.query(
        "ALTER TABLE wallet_withdrawal_settings ADD COLUMN author_minimum_remaining_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 200.00 AFTER minimum_withdrawal_inr"
      );
    }
    if (!existingRemainingBalanceColumns.has("editor_minimum_remaining_inr")) {
      await connection.query(
        "ALTER TABLE wallet_withdrawal_settings ADD COLUMN editor_minimum_remaining_inr DECIMAL(14,2) UNSIGNED NOT NULL DEFAULT 500.00 AFTER author_minimum_remaining_inr"
      );
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_point_rates (
        role ENUM('AUTHOR', 'EDITOR') NOT NULL PRIMARY KEY,
        rupees_per_point DECIMAL(10,4) UNSIGNED NOT NULL DEFAULT 1.0000,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `INSERT IGNORE INTO wallet_point_rates (role, rupees_per_point)
       VALUES ('AUTHOR', 1.0000), ('EDITOR', 1.0000)`
    );
    const [[userRoleDefinition], [walletRateRoleDefinition]] = await Promise.all([
      connection.query(
        `SELECT CHARACTER_SET_NAME, COLLATION_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
         LIMIT 1`
      ),
      connection.query(
        `SELECT CHARACTER_SET_NAME, COLLATION_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_point_rates' AND COLUMN_NAME = 'role'
         LIMIT 1`
      ),
    ]);
    const userRoleCharset = userRoleDefinition[0]?.CHARACTER_SET_NAME;
    const userRoleCollation = userRoleDefinition[0]?.COLLATION_NAME;
    const walletRateRoleCollation = walletRateRoleDefinition[0]?.COLLATION_NAME;
    const safeSqlIdentifier = /^[A-Za-z0-9_]+$/;
    if (
      userRoleCharset
      && userRoleCollation
      && walletRateRoleCollation !== userRoleCollation
      && safeSqlIdentifier.test(userRoleCharset)
      && safeSqlIdentifier.test(userRoleCollation)
    ) {
      await connection.query(
        `ALTER TABLE wallet_point_rates
         MODIFY COLUMN role ENUM('AUTHOR', 'EDITOR')
         CHARACTER SET ${userRoleCharset} COLLATE ${userRoleCollation} NOT NULL`
      );
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_reward_settings (
        role ENUM('AUTHOR', 'EDITOR') NOT NULL,
        content_type ENUM('ARTICLE', 'BLOG', 'VIDEO') NOT NULL,
        points INT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (role, content_type)
      ) ENGINE=InnoDB`
    );
    const [rewardRoleColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_reward_settings'
       AND COLUMN_NAME = 'role'`
    );
    if (!rewardRoleColumns.length) {
      await connection.query("ALTER TABLE wallet_reward_settings DROP PRIMARY KEY");
      await connection.query(
        "ALTER TABLE wallet_reward_settings ADD COLUMN role ENUM('AUTHOR', 'EDITOR') NOT NULL DEFAULT 'AUTHOR' FIRST"
      );
      await connection.query("ALTER TABLE wallet_reward_settings ADD PRIMARY KEY (role, content_type)");
      await connection.query(
        `INSERT IGNORE INTO wallet_reward_settings (role, content_type, points, updated_by)
         SELECT 'EDITOR', content_type, points, updated_by
         FROM wallet_reward_settings WHERE role = 'AUTHOR'`
      );
    }
    await connection.query(
      `INSERT IGNORE INTO wallet_reward_settings (role, content_type, points)
       VALUES
         ('AUTHOR', 'ARTICLE', 10), ('AUTHOR', 'BLOG', 10), ('AUTHOR', 'VIDEO', 5),
         ('EDITOR', 'ARTICLE', 10), ('EDITOR', 'BLOG', 10), ('EDITOR', 'VIDEO', 5)`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS editor_review_reward_settings (
        content_type ENUM('ARTICLE', 'BLOG', 'VIDEO') NOT NULL PRIMARY KEY,
        points INT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `INSERT IGNORE INTO editor_review_reward_settings (content_type, points)
       VALUES ('ARTICLE', 1), ('BLOG', 1), ('VIDEO', 1)`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_bonus_awards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        points INT UNSIGNED NOT NULL,
        reason VARCHAR(500) NOT NULL,
        content_type ENUM('ARTICLE', 'BLOG', 'VIDEO') NOT NULL,
        content_id BIGINT UNSIGNED NOT NULL,
        content_title VARCHAR(500) NOT NULL,
        content_slug VARCHAR(255) NULL,
        recipient_relationship ENUM('CREATOR', 'REVIEWER') NOT NULL,
        awarded_by BIGINT UNSIGNED NOT NULL,
        wallet_transaction_id BIGINT UNSIGNED NULL,
        acknowledged_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bonus_user_created (user_id, created_at),
        INDEX idx_bonus_content (content_type, content_id),
        UNIQUE KEY uq_bonus_transaction (wallet_transaction_id)
      ) ENGINE=InnoDB`
    );
    const [categorySiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'site_id'`
    );
    if (!categorySiteColumns.length) {
      await connection.query("ALTER TABLE categories ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id");
      await connection.query("ALTER TABLE categories ADD INDEX idx_categories_site (site_id)");
    }
    const [categoryUniqueIndexes] = await connection.query(
      `SELECT INDEX_NAME, COUNT(*) column_count
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'
       GROUP BY INDEX_NAME`
    );
    for (const index of categoryUniqueIndexes) {
      if (Number(index.column_count) === 1) await connection.query(`ALTER TABLE categories DROP INDEX \`${index.INDEX_NAME}\``);
    }
    const [categoryCompositeIndexes] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME IN ('uq_categories_site_slug', 'uq_categories_site_name')`
    );
    const categoryIndexNames = new Set(categoryCompositeIndexes.map((index) => index.INDEX_NAME));
    if (!categoryIndexNames.has("uq_categories_site_slug")) await connection.query("ALTER TABLE categories ADD UNIQUE KEY uq_categories_site_slug (site_id, slug)");
    if (!categoryIndexNames.has("uq_categories_site_name")) await connection.query("ALTER TABLE categories ADD UNIQUE KEY uq_categories_site_name (site_id, name)");
    await connection.query(
      `CREATE TABLE IF NOT EXISTS home_widgets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        widget_key VARCHAR(64) NOT NULL UNIQUE,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    const [widgetSiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'home_widgets' AND COLUMN_NAME = 'site_id'`
    );
    if (!widgetSiteColumns.length) {
      await connection.query("ALTER TABLE home_widgets ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id");
      const [widgetUniqueIndexes] = await connection.query(
        `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'home_widgets' AND NON_UNIQUE = 0 AND COLUMN_NAME = 'widget_key'`
      );
      for (const index of widgetUniqueIndexes) {
        if (index.INDEX_NAME !== "PRIMARY") await connection.query(`ALTER TABLE home_widgets DROP INDEX \`${index.INDEX_NAME}\``);
      }
      await connection.query("ALTER TABLE home_widgets ADD UNIQUE KEY uq_home_widgets_site_key (site_id, widget_key)");
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS site_ui_sections (
        site_id INT UNSIGNED NOT NULL,
        section_key VARCHAR(100) NOT NULL,
        label VARCHAR(180) NOT NULL,
        is_visible TINYINT(1) NOT NULL DEFAULT 1,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (site_id, section_key)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `INSERT IGNORE INTO site_ui_sections (site_id, section_key, label, is_visible, updated_by)
       SELECT sites.id, sections.section_key, sections.label, sections.is_visible, sections.updated_by
       FROM sites CROSS JOIN ui_sections sections`
    );
    await connection.query(
      `INSERT IGNORE INTO home_widgets (site_id, widget_key, data) VALUES (1, ?, ?)`,
      ["site_header", JSON.stringify({
        showUpcomingRallies: true,
        showWeather: true,
        showUpcomingEvents: true,
        navItems: {},
        countdown: { enabled: false, title: "Election Results", targetAt: "", link: "/elections", buttonLabel: "View results" },
      })]
    );
    const [bonusAcknowledgementColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_bonus_awards'
         AND COLUMN_NAME = 'acknowledged_at'`
    );
    if (!bonusAcknowledgementColumns.length) {
      await connection.query(
        "ALTER TABLE wallet_bonus_awards ADD COLUMN acknowledged_at TIMESTAMP NULL AFTER wallet_transaction_id"
      );
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS wallet_withdrawals (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        points BIGINT UNSIGNED NOT NULL,
        rupees_per_point DECIMAL(10,4) UNSIGNED NULL,
        amount_inr DECIMAL(14,2) UNSIGNED NULL,
        status ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
        withdrawal_month DATE NULL,
        payout_provider VARCHAR(30) NULL,
        provider_payout_link_id VARCHAR(100) NULL,
        provider_payout_id VARCHAR(100) NULL,
        payout_link_url VARCHAR(2000) NULL,
        provider_status VARCHAR(50) NULL,
        provider_updated_at TIMESTAMP NULL,
        provider_failure_reason VARCHAR(500) NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_by BIGINT UNSIGNED NULL,
        processed_at TIMESTAMP NULL,
        admin_notes VARCHAR(500) NULL,
        UNIQUE KEY uq_wallet_withdrawal_month (user_id, withdrawal_month),
        INDEX idx_wallet_withdrawals_status_date (status, requested_at)
      ) ENGINE=InnoDB`
    );
    const [withdrawalValueColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawals'
       AND COLUMN_NAME IN ('rupees_per_point', 'amount_inr')`
    );
    const existingWithdrawalValueColumns = new Set(withdrawalValueColumns.map((column) => column.COLUMN_NAME));
    if (!existingWithdrawalValueColumns.has("rupees_per_point")) {
      await connection.query(
        "ALTER TABLE wallet_withdrawals ADD COLUMN rupees_per_point DECIMAL(10,4) UNSIGNED NULL AFTER points"
      );
    }
    if (!existingWithdrawalValueColumns.has("amount_inr")) {
      await connection.query(
        "ALTER TABLE wallet_withdrawals ADD COLUMN amount_inr DECIMAL(14,2) UNSIGNED NULL AFTER rupees_per_point"
      );
    }
    // Manual UPI payouts: the contributor's UPI ID, the admin's UTR on payment, and who reviewed it.
    for (const [column, definition] of [
      ["upi_id", "VARCHAR(100) NULL AFTER withdrawal_month"],
      ["utr_number", "VARCHAR(50) NULL AFTER upi_id"],
      ["reviewed_by", "BIGINT UNSIGNED NULL AFTER utr_number"],
    ]) {
      const [found] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawals' AND COLUMN_NAME = ?", [column]
      );
      if (!found.length) await connection.query(`ALTER TABLE wallet_withdrawals ADD COLUMN ${column} ${definition}`);
    }
    const [withdrawalProviderColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawals'
       AND COLUMN_NAME IN ('payout_provider', 'provider_payout_link_id', 'provider_payout_id',
                           'payout_link_url', 'provider_status', 'provider_updated_at', 'provider_failure_reason')`
    );
    const existingWithdrawalProviderColumns = new Set(withdrawalProviderColumns.map((column) => column.COLUMN_NAME));
    const providerColumns = [
      ["payout_provider", "VARCHAR(30) NULL AFTER withdrawal_month"],
      ["provider_payout_link_id", "VARCHAR(100) NULL AFTER payout_provider"],
      ["provider_payout_id", "VARCHAR(100) NULL AFTER provider_payout_link_id"],
      ["payout_link_url", "VARCHAR(2000) NULL AFTER provider_payout_id"],
      ["provider_status", "VARCHAR(50) NULL AFTER payout_link_url"],
      ["provider_updated_at", "TIMESTAMP NULL AFTER provider_status"],
      ["provider_failure_reason", "VARCHAR(500) NULL AFTER provider_updated_at"],
    ];
    for (const [column, definition] of providerColumns) {
      if (!existingWithdrawalProviderColumns.has(column)) {
        await connection.query(`ALTER TABLE wallet_withdrawals ADD COLUMN ${column} ${definition}`);
      }
    }
    await connection.query(
      `ALTER TABLE wallet_withdrawals
       MODIFY COLUMN status ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
       MODIFY COLUMN withdrawal_month DATE NULL`
    );
    const [providerLinkIndexes] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_withdrawals'
         AND INDEX_NAME = 'uq_wallet_provider_payout_link'`
    );
    if (!providerLinkIndexes.length) {
      await connection.query(
        "CREATE UNIQUE INDEX uq_wallet_provider_payout_link ON wallet_withdrawals (provider_payout_link_id)"
      );
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS deletion_audit (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_table VARCHAR(64) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        entity_label VARCHAR(500) NOT NULL,
        owner_id BIGINT UNSIGNED NULL,
        owner_name VARCHAR(200) NULL,
        deleted_by BIGINT UNSIGNED NOT NULL,
        deleted_by_name VARCHAR(200) NOT NULL,
        deleted_by_email VARCHAR(255) NULL,
        deleted_by_role VARCHAR(30) NOT NULL,
        reason VARCHAR(500) NULL,
        snapshot JSON NULL,
        deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        restored_by BIGINT UNSIGNED NULL,
        restored_at TIMESTAMP NULL,
        permanently_deleted_by BIGINT UNSIGNED NULL,
        permanently_deleted_at TIMESTAMP NULL,
        INDEX idx_deletion_audit_active (restored_at, permanently_deleted_at, deleted_at),
        INDEX idx_deletion_audit_entity (entity_table, entity_id)
      ) ENGINE=InnoDB`
    );
    const [deletionSiteColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deletion_audit' AND COLUMN_NAME = 'site_id'`
    );
    if (!deletionSiteColumns.length) {
      await connection.query("ALTER TABLE deletion_audit ADD COLUMN site_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id, ADD INDEX idx_deletion_audit_site (site_id)");
      await connection.query(
        `UPDATE deletion_audit SET site_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.site_id')) AS UNSIGNED)
         WHERE JSON_EXTRACT(snapshot, '$.site_id') IS NOT NULL`
      );
    }
    await connection.query(
      `INSERT IGNORE INTO home_widgets (site_id, widget_key, data)
       SELECT sites.id, defaults.widget_key, defaults.data
       FROM sites CROSS JOIN (SELECT widget_key, data FROM home_widgets WHERE site_id = 1) defaults`
    );
    await connection.query(
      `INSERT IGNORE INTO home_widgets (site_id, widget_key, data)
       SELECT id, 'managed_pages', JSON_OBJECT() FROM sites`
    );
    const perSiteWidgetDefaults = [
      ["voices_of_nation", [
        { id: 1, quote: "The true measure of our progress is not just in economic numbers, but in the empowerment of our most vulnerable citizens.", attribution: "Senior Leader, National Address" },
        { id: 2, quote: "We must prioritize sustainable development to ensure a thriving future for the next generation, regardless of political affiliations.", attribution: "Opposition Spokesperson, Press Meet" },
      ]],
      ["opinion_leaders", [
        { id: 1, quote: "Why the current fiscal policy is a gamble for the middle class." },
        { id: 2, quote: "The silent revolution in rural connectivity and its political cost." },
      ]],
      ["cm_corner", {
        name: "",
        tag: "Chief Minister's Corner",
        quote: "",
        image: "",
        initiatives: [{ title: "", excerpt: "" }],
      }],
      ["site_navigation", {
        more: [
          { label: "Investors", href: "/investors" },
          { label: "Advertise with Us", href: "/advertise-with-us" },
          { label: "Career", href: "/careers", feature: "feature_careers" },
          { label: "Connect As A Sponsor", href: "/connect-as-a-sponsor" },
          { label: "Lok Sabha", href: "/loksabha" },
          { label: "Rajya Sabha", href: "/rajyasabha" },
          { label: "Rallies", href: "/rallies" },
        ],
        legal: [
          { label: "About", href: "/about", pageKey: "about" },
          { label: "Contact", href: "/contact", pageKey: "contact" },
          { label: "Policies", href: "/policies", feature: "feature_policies" },
        ],
      }],
      ["site_footer", {
        sections: [
          {
            title: "Sections", links: [
              { label: "Lok Sabha", href: "/loksabha" }, { label: "Rajya Sabha", href: "/rajyasabha" },
              { label: "Legislative Assembly", href: "/category/assembly-election" }, { label: "Policy Analysis", href: "/policies", feature: "feature_policies" },
            ]
          },
          {
            title: "About", links: [
              { label: "Our History", href: "/about", pageKey: "about" }, { label: "Editorial Team", href: "/editorial-team", pageKey: "editorial-team" },
              { label: "Careers", href: "/careers", feature: "feature_careers" },
            ]
          },
          { title: "Legal", links: [{ label: "Policies", href: "/policies", feature: "feature_policies" }] },
        ],
        directoryTitle: "Explore by Keyword",
        coverageTitle: "Coverage",
        coverageLinks: [
          { label: "Lok Sabha", href: "/loksabha" }, { label: "Rajya Sabha", href: "/rajyasabha" },
          { label: "Elections", href: "/elections" }, { label: "Speeches", href: "/speeches" },
          { label: "Rallies", href: "/rallies" }, { label: "Political Calendar", href: "/political-calendar" },
        ],
      }],
      ["homepage_labels", {
        top_stories: { title: "Top Stories", viewAllHref: "/top-news" }, editorial_opinion: { title: "Editorial Opinion" },
        latest_blogs: { title: "Latest Blogs", viewAllHref: "/blogs" }, regional_focus: { title: "Regional Focus" },
        in_depth_analysis: { title: "In-Depth Analysis" }, multimedia_hub: { title: "Multimedia Hub", viewAllHref: "/videos" },
        key_figures: { title: "Politicians", viewAllHref: "/politicians" }, former_prime_ministers: { title: "Former Prime Ministers", viewAllHref: "/former-prime-ministers" },
        voices_of_nation: { title: "Voices of the Nation" }, state_leadership: { title: "State Leadership", viewAllHref: "/cm" },
        political_parties: { title: "Indian Political Parties", viewAllHref: "/parties" }, parliament: { title: "Parliament" },
        digital_dispatches: { title: "Digital Dispatches" }, video_highlights: { title: "Video Highlights" }, x_feed: { title: "X Feed" }, facebook_updates: { title: "Facebook Updates" },
        cm_corner: { title: "Chief Minister's Corner", viewAllHref: "/cm" }, pm_corner: { title: "Prime Minister's Corner", viewAllHref: "/speeches" }, press_conferences: { title: "Press Conference Archive", viewAllHref: "/press-conferences" },
        follow_us: { title: "Follow Us" }, legislative_tracker: { title: "Legislative Tracker" }, parliament_strength: { title: "Parliament Strength" },
        political_calendar: { title: "Political Calendar" }, rti_corner: { title: "RTI Corner" }, digital_pulse: { title: "Digital Pulse" },
        opinion_leaders: { title: "Opinion Leaders" }, party_pulse: { title: "Party Pulse" }, fact_check: { title: "Fact Check" },
        the_briefing: { title: "The Briefing" }, from_the_archives: { title: "From the Archives" }, election_results: { title: "Election Results" },
        political_keywords: { title: "Political Keywords" }, states_keywords: { title: "States" }, union_territories: { title: "Union Territories" },
        elections_by_state: { title: "Elections by State" }, parties_keywords: { title: "Political Parties" }, category_keywords: { title: "Categories" },
        constituency_spotlight: { title: "Constituency Spotlight" }, latest_updates: { title: "Latest Updates", viewAllHref: "/top-news" },
        more_blogs: { title: "More Blogs", viewAllHref: "/blogs" }, popular_tags: { title: "Popular Tags" }, poll_of_the_day: { title: "Poll of the Day" }, trending_news: { title: "Trending" },
      }],
      ["listing_pages", {
        services: { eyebrow: "What we provide", title: "Our Services", description: "Explore the services offered by our team.", emptyText: "Services will be published here soon.", itemLinkLabel: "View details" },
        policies: { eyebrow: "Policy Analysis", title: "Policies shaping India", description: "Understand major public policies through concise summaries, detailed analysis, and the political context behind each decision.", sectionTitle: "Published policies", emptyTitle: "Policy analysis is being prepared", emptyText: "Published policies will appear here as soon as the editorial team makes them available.", itemLinkLabel: "Read analysis" },
        careers: { title: "Careers", emptyText: "There are no open positions right now — check back soon." },
        blogs: { title: "Blogs" },
        videos: { title: "Videos" },
      }],
      ["homepage_sections", []],
      ["home_video", { enabled: false, title: "Watch", videoUrl: "", posterUrl: "", placement: "above_footer" }],
    ];
    for (const [widgetKey, data] of perSiteWidgetDefaults) {
      await connection.query(
        `INSERT IGNORE INTO home_widgets (site_id, widget_key, data)
         SELECT id, ?, ? FROM sites`,
        [widgetKey, JSON.stringify(data)]
      );
    }
    const requiredMoreLinks = [
      { label: "Investors", href: "/investors" },
      { label: "Advertise with Us", href: "/advertise-with-us" },
    ];
    const [navigationRows] = await connection.query("SELECT id, data FROM home_widgets WHERE widget_key = 'site_navigation'");
    for (const row of navigationRows) {
      const navigation = typeof row.data === "string" ? JSON.parse(row.data) : { ...(row.data || {}) };
      const savedMoreLinks = Array.isArray(navigation.more) ? navigation.more : [];
      const missingLinks = requiredMoreLinks.filter((required) => !savedMoreLinks.some((link) => link?.href === required.href));
      if (missingLinks.length) {
        navigation.more = [...missingLinks, ...savedMoreLinks];
        await connection.query("UPDATE home_widgets SET data = ? WHERE id = ?", [JSON.stringify(navigation), row.id]);
      }
    }
    await connection.query(
      `UPDATE home_widgets
       SET data = JSON_SET(data, '$.cm_corner', JSON_OBJECT('title', 'Chief Minister''s Corner', 'viewAllHref', '/cm'))
       WHERE widget_key = 'homepage_labels' AND JSON_EXTRACT(data, '$.cm_corner') IS NULL`
    );
    // /key-political-figures moved to /politicians; update saved links and menus.
    await connection.query(
      `UPDATE home_widgets SET data = REPLACE(CAST(data AS CHAR), '"/key-political-figures"', '"/politicians"')
       WHERE CAST(data AS CHAR) LIKE '%"/key-political-figures"%'`
    );
    // Rename the old default heading only; custom headings are left alone.
    await connection.query(
      `UPDATE home_widgets
       SET data = JSON_SET(data, '$.key_figures.title', 'Politicians')
       WHERE widget_key = 'homepage_labels' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.key_figures.title')) = 'Key Political Figures'`
    );
    const [siteHeaderRows] = await connection.query(
      `SELECT widgets.id, widgets.data, sites.services_enabled
       FROM home_widgets widgets
       INNER JOIN sites ON sites.id = widgets.site_id
       WHERE widgets.widget_key = 'site_header'`
    );
    const defaultMenuItems = [
      { label: "Home", href: "/", enabled: true },
      { label: "Politics", href: "/parties", enabled: true, feature: "feature_parties" },
      { label: "States", href: "/state", enabled: true, feature: "feature_states" },
      { label: "Districts", href: "/district", enabled: true },
      { label: "Elections", href: "/elections", enabled: true },
      { label: "Blogs", href: "/blogs", enabled: true, feature: "feature_blogs" },
      { label: "Lok Sabha", href: "/loksabha", enabled: true },
      { label: "Rajya Sabha", href: "/rajyasabha", enabled: true },
      { label: "Rallies", href: "/rallies", enabled: true },
      { label: "Speeches", href: "/speeches", enabled: true },
      { label: "Top News", href: "/top-news", enabled: true },
      { label: "Premium", href: "/premium", enabled: true },
    ];
    for (const row of siteHeaderRows) {
      const header = typeof row.data === "string" ? JSON.parse(row.data) : { ...(row.data || {}) };
      if (Array.isArray(header.menuItems)) continue;
      const legacyCustomItems = Array.isArray(header.customNavItems) ? header.customNavItems : [];
      let menuItems = [...defaultMenuItems, ...legacyCustomItems].map((item) => ({
        ...item,
        enabled: item.enabled !== false && header.navItems?.[item.href] !== false,
      }));
      if (row.services_enabled && !menuItems.some((item) => item.href === "/services")) {
        menuItems.push({ label: "Services", href: "/services", enabled: true, requiresServices: true });
      }
      const legacyOrder = Array.isArray(header.navOrder) ? header.navOrder : [];
      menuItems = menuItems.sort((left, right) => {
        const leftIndex = legacyOrder.indexOf(left.href);
        const rightIndex = legacyOrder.indexOf(right.href);
        if (leftIndex < 0 && rightIndex < 0) return 0;
        if (leftIndex < 0) return 1;
        if (rightIndex < 0) return -1;
        return leftIndex - rightIndex;
      });
      header.menuItems = menuItems;
      await connection.query("UPDATE home_widgets SET data = ? WHERE id = ?", [JSON.stringify(header), row.id]);
    }
    for (const row of siteHeaderRows) {
      const header = typeof row.data === "string" ? JSON.parse(row.data) : { ...(row.data || {}) };
      if (!Array.isArray(header.menuItems) || header.menuItems.some((item) => item?.href === "/district")) continue;
      const statesIndex = header.menuItems.findIndex((item) => item?.href === "/state");
      const insertAt = statesIndex >= 0 ? statesIndex + 1 : header.menuItems.length;
      header.menuItems.splice(insertAt, 0, { label: "Districts", href: "/district", enabled: true });
      await connection.query("UPDATE home_widgets SET data = ? WHERE id = ?", [JSON.stringify(header), row.id]);
    }
    // Every website's header gets a Premium menu item for the members' area (shown only to Premium members on the
    // website; admins can rename, hide or move it in Site Management).
    for (const row of siteHeaderRows) {
      const header = typeof row.data === "string" ? JSON.parse(row.data) : { ...(row.data || {}) };
      if (!Array.isArray(header.menuItems)) continue;
      // An earlier version added "Premium" pointing at /subscription; the crown button already opens that page.
      const cleaned = header.menuItems.filter((item) => !(item?.label === "Premium" && item?.href === "/subscription"));
      const hasPremium = cleaned.some((item) => item?.href === "/premium");
      if (cleaned.length === header.menuItems.length && hasPremium) continue;
      header.menuItems = hasPremium ? cleaned : [...cleaned, { label: "Premium", href: "/premium", enabled: true }];
      await connection.query("UPDATE home_widgets SET data = ? WHERE id = ?", [JSON.stringify(header), row.id]);
    }
    const managedPageDefaults = {
      about: {
        enabled: true, eyebrow: "About Us", title: "Politics, explained with clarity", description: "A digital platform dedicated to trustworthy, accessible political coverage.", cardsTitle: "What we do", cards: [
          { title: "Political reporting", text: "Coverage of political developments, elections, institutions, parties and leaders." },
          { title: "Clear analysis", text: "Straightforward explanations with the context readers need." },
          { title: "Public engagement", text: "Reporting that brings citizens closer to democratic institutions and public life." },
        ]
      },
      contact: {
        enabled: true, eyebrow: "Contact Us", title: "We're here to listen", description: "Reach our editorial and support team for questions, feedback, corrections, story ideas and collaboration opportunities.", detailsTitle: "Contact information", detailsDescription: "Choose the most convenient way to reach us. Our team generally responds within two business days.", formEyebrow: "Send a message", formTitle: "Get in Touch", formDescription: "Have a story tip, correction, partnership proposal, or general question? We would be glad to hear from you.", email: "contact@punjabpolitics.com", phone: "+91 98765 43210", location: "Punjab, India", cards: [
          { title: "Editorial enquiries", text: "Include the relevant article URL when reporting a correction or factual concern." },
        ]
      },
      "editorial-team": { enabled: true, eyebrow: "About", title: "Editorial Team", description: "Meet the desks responsible for the website's reporting and analysis.", cards: [] },
      "advertise-with-us": {
        enabled: true, eyebrow: "Partnerships", title: "Advertise with Punjab Politics", description: "Reach readers engaged with Punjab politics, public policy and democratic life through clearly disclosed advertising opportunities.", cardsTitle: "Advertising opportunities", cards: [
          { title: "Display campaigns", text: "Responsive placements across selected news, analysis and category pages with clear advertising labels." },
          { title: "Sponsored features", text: "Clearly identified partner-supported formats produced under defined editorial and disclosure standards." },
          { title: "Campaign enquiries", text: "Share your audience, schedule and campaign goals with our partnerships team.", href: "/contact" },
        ]
      },
      "connect-as-a-sponsor": { enabled: true, eyebrow: "Partnerships", title: "Connect as a Sponsor", description: "Start a conversation about a clearly disclosed sponsorship.", cards: [] },
      investors: {
        enabled: true, eyebrow: "Investor Relations", title: "Invest in independent political journalism", description: "Apply to become a Punjab Politics investor and help build trustworthy, accessible political coverage for readers across Punjab.", cardsTitle: "Why partner with us", formEnabled: true, formEyebrow: "Investor application", formTitle: "Start an investment conversation", formDescription: "Share your profile and investment interest. Our administration team will review your application and contact you.", companyLabel: "Company or organisation", phoneLabel: "Phone number", investmentRangeLabel: "Investment interest", documentLabel: "Investor profile or pitch document", messageLabel: "Tell us about your interest", submitLabel: "Submit investor application", successMessage: "Your investor application has been submitted for admin review.", cards: [
          { title: "Meaningful reach", text: "Support journalism focused on public affairs, democratic institutions and informed citizens." },
          { title: "Transparent process", text: "Every application is reviewed by the administration team before Investor access is granted." },
          { title: "Long-term collaboration", text: "Tell us about your goals so we can evaluate a responsible, aligned partnership." },
        ]
      },
      more: { enabled: true, eyebrow: "Explore", title: "More", description: "Discover more ways to follow and work with this website.", cards: [] },
    };
    const [managedPageRows] = await connection.query("SELECT id, data FROM home_widgets WHERE widget_key = 'managed_pages'");
    for (const row of managedPageRows) {
      const saved = typeof row.data === "string" ? JSON.parse(row.data) : { ...(row.data || {}) };
      if (saved.investors?.title === "Investor Relations" && !(saved.investors.cards || []).length) saved.investors = { ...managedPageDefaults.investors, enabled: saved.investors.enabled !== false };
      if (saved["advertise-with-us"]?.title === "Advertise With Us" && !(saved["advertise-with-us"].cards || []).length) saved["advertise-with-us"] = { ...managedPageDefaults["advertise-with-us"], enabled: saved["advertise-with-us"].enabled !== false };
      const merged = Object.fromEntries(
        Object.entries(managedPageDefaults).map(([pageKey, defaults]) => [
          pageKey,
          { ...defaults, ...(saved[pageKey] || {}) },
        ]),
      );
      for (const [pageKey, page] of Object.entries(saved)) {
        if (!merged[pageKey]) merged[pageKey] = page;
      }
      await connection.query("UPDATE home_widgets SET data = ? WHERE id = ?", [JSON.stringify(merged), row.id]);
    }

    const softDeleteTables = [
      "users", "articles", "blogs", "videos", "comments", "categories", "policies",
      "career_jobs", "role_applications", "politicians", "parties", "states", "districts",
    ];
    for (const tableName of softDeleteTables) {
      const [tables] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      if (!tables.length) continue;
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME IN ('deleted_at', 'deleted_by', 'delete_reason')`,
        [tableName]
      );
      const existing = new Set(columns.map((column) => column.COLUMN_NAME));
      if (!existing.has("deleted_at")) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN deleted_at DATETIME NULL`);
      }
      if (!existing.has("deleted_by")) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN deleted_by BIGINT UNSIGNED NULL`);
      }
      if (!existing.has("delete_reason")) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN delete_reason VARCHAR(500) NULL`);
      }
    }

    // Audience analytics: anonymous/linked visitors, sessions, and the daily activity
    // tables the dashboard reads (created and migrated by ensureAnalyticsDaily).
    await connection.query(
      `CREATE TABLE IF NOT EXISTS analytics_visitors (
        visitor_id CHAR(36) NOT NULL PRIMARY KEY,
        linked_user_id BIGINT UNSIGNED NULL,
        first_seen_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        linked_at DATETIME NULL,
        INDEX idx_analytics_visitors_user (linked_user_id)
      ) ENGINE=InnoDB`
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS analytics_sessions (
        session_id CHAR(36) NOT NULL PRIMARY KEY,
        visitor_id CHAR(36) NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        surface ENUM('PUBLIC', 'PANEL') NOT NULL,
        started_at DATETIME NOT NULL,
        last_activity_at DATETIME NOT NULL,
        INDEX idx_analytics_sessions_visitor (visitor_id),
        INDEX idx_analytics_sessions_activity (last_activity_at)
      ) ENGINE=InnoDB`
    );
    // Legacy per-event log; only read once by the daily-activity migration.
    await connection.query(
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        site_id INT UNSIGNED NOT NULL,
        visitor_id CHAR(36) NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        actor_role VARCHAR(30) NULL,
        surface ENUM('PUBLIC', 'PANEL') NOT NULL,
        occurred_at DATETIME NOT NULL,
        INDEX idx_analytics_events_site_time (site_id, occurred_at)
      ) ENGINE=InnoDB`
    );
    await ensureAnalyticsDaily(connection);
  } finally {
    connection.release();
  }
};

module.exports = pool;
