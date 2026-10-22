const pool = require("../config/db");

const Analytics = {
  async getRetention({ siteId }) {
    const [rows] = await pool.query(
      `WITH active_dates AS (
        SELECT DISTINCT
          CASE WHEN e.user_id IS NOT NULL THEN CONCAT('USER:', e.user_id)
            WHEN v.linked_user_id IS NOT NULL THEN CONCAT('USER:', v.linked_user_id)
            ELSE CONCAT('ANON:', e.visitor_id) END AS identity_key,
          DATE(DATE_ADD(e.public_at, INTERVAL 330 MINUTE)) AS active_day
        FROM analytics_user_daily e
        LEFT JOIN analytics_visitors v ON v.visitor_id = e.visitor_id
        WHERE e.site_id = ? AND e.public_at IS NOT NULL AND e.public_at <= UTC_TIMESTAMP()
      ), first_visits AS (
        SELECT identity_key, MIN(active_day) AS first_day FROM active_dates GROUP BY identity_key
      ), horizons AS (
        SELECT 7 AS day UNION ALL SELECT 30 UNION ALL SELECT 90
      )
      SELECT h.day, COUNT(f.identity_key) AS eligible_users,
        COUNT(returned.identity_key) AS retained_users
      FROM horizons h
      LEFT JOIN first_visits f ON DATE_ADD(f.first_day, INTERVAL h.day DAY)
        < DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))
      LEFT JOIN active_dates returned ON returned.identity_key = f.identity_key
        AND returned.active_day = DATE_ADD(f.first_day, INTERVAL h.day DAY)
      GROUP BY h.day ORDER BY h.day`,
      [siteId]
    );
    return rows.map((row) => {
      const eligible = Number(row.eligible_users);
      const retained = Number(row.retained_users);
      return { day: Number(row.day), eligible_users: eligible, retained_users: retained,
        retention_rate: eligible ? Math.round(retained / eligible * 10000) / 100 : null };
    });
  },

  async recordEvent({
    siteId,
    visitorId,
    sessionId,
    userId,
    actorRole,
    surface,
  }) {
    // One account/day across browsers; preserve surface and role membership as flags.
    const roleFlags = { AUTHOR: 1, EDITOR: 2, INVESTOR: 4, ADMIN: 8, SUBADMIN: 8 };
    await pool.query(
      `INSERT INTO analytics_user_daily
        (site_id, identity_key, visitor_id, user_id, activity_date, public_at,
         panel_active, role_flags, occurred_at, last_activity_at)
       VALUES (?, ?, ?, ?, DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)),
         IF(? = 'PUBLIC', UTC_TIMESTAMP(), NULL), ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         public_at = COALESCE(public_at, VALUES(public_at)),
         panel_active = panel_active | VALUES(panel_active),
         role_flags = role_flags | VALUES(role_flags),
         last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at))`,
      [siteId, userId ? 'USER:' + userId : 'ANON:' + visitorId, visitorId,
        userId || null, surface, surface === "PANEL" ? 1 : 0, roleFlags[actorRole] || 0]
    );

    await pool.query(
      `INSERT INTO analytics_sessions
        (
          session_id,
          visitor_id,
          user_id,
          surface,
          started_at,
          last_activity_at
        )
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         user_id = COALESCE(VALUES(user_id), user_id),
         last_activity_at = UTC_TIMESTAMP()`,
      [sessionId, visitorId, userId || null, surface]
    );
  },

  async getOverview({ siteId, startAt, endAt, minActiveDays, maxActiveDays }) {
    // Group identities across both surfaces before filtering: a person belongs
    // to one bucket, even if they used multiple devices or logged in later.
    const identity = (event, visitor) => `CASE
      WHEN ${event}.user_id IS NOT NULL THEN CONCAT('USER:', ${event}.user_id)
      WHEN ${visitor}.linked_user_id IS NOT NULL THEN CONCAT('USER:', ${visitor}.linked_user_id)
      ELSE CONCAT('ANON:', ${event}.visitor_id) END`;
    const bucketJoin = minActiveDays ? `INNER JOIN (
      SELECT identity_key FROM (
        SELECT identity_key, active_day,
          MAX(active_day) OVER (PARTITION BY identity_key) AS latest_day,
          ROW_NUMBER() OVER (PARTITION BY identity_key ORDER BY active_day DESC) AS day_number
        FROM (
          SELECT DISTINCT ${identity("activity", "visitor")} AS identity_key,
            DATE(DATE_ADD(activity.occurred_at, INTERVAL 330 MINUTE)) AS active_day
          FROM analytics_user_daily activity
          LEFT JOIN analytics_visitors visitor ON visitor.visitor_id = activity.visitor_id
          WHERE activity.site_id = ? AND activity.occurred_at < ?
        ) active_dates
      ) numbered_dates
      WHERE DATEDIFF(latest_day, active_day) = day_number - 1
        AND latest_day >= DATE_SUB(DATE(DATE_ADD(?, INTERVAL 330 MINUTE)), INTERVAL 1 DAY)
      GROUP BY identity_key
      HAVING COUNT(*) >= ?
      ${maxActiveDays == null ? "" : "AND COUNT(*) <= ?"}
    ) eligible ON eligible.identity_key = ${identity("e", "v")}` : "";
    const bucketParams = minActiveDays ? [siteId, endAt, endAt, minActiveDays, ...(maxActiveDays == null ? [] : [maxActiveDays])] : [];
    const [rows] = await pool.query(
      `SELECT
         COUNT(DISTINCT
           CASE
             WHEN e.user_id IS NOT NULL
               THEN CONCAT('USER:', e.user_id)
             WHEN v.linked_user_id IS NOT NULL
               THEN CONCAT('USER:', v.linked_user_id)
             ELSE CONCAT('ANON:', e.visitor_id)
           END
         ) AS overall_active_users,

         COUNT(DISTINCT
           CASE
             WHEN e.public_at IS NOT NULL THEN
               CASE
                 WHEN e.user_id IS NOT NULL
                   THEN CONCAT('USER:', e.user_id)
                 WHEN v.linked_user_id IS NOT NULL
                   THEN CONCAT('USER:', v.linked_user_id)
                 ELSE CONCAT('ANON:', e.visitor_id)
               END
           END
         ) AS audience_active_users,

         COUNT(DISTINCT
           CASE
             WHEN e.panel_active = 1 THEN
               CONCAT('USER:', e.user_id)
           END
         ) AS team_active_users,

         COUNT(DISTINCT
           CASE
             WHEN e.user_id IS NULL
              AND v.linked_user_id IS NULL
               THEN CONCAT('ANON:', e.visitor_id)
           END
         ) AS anonymous_users,

         COUNT(DISTINCT
           CASE WHEN (e.role_flags & 1) <> 0
             THEN e.user_id END
         ) AS authors,

         COUNT(DISTINCT
           CASE WHEN (e.role_flags & 2) <> 0
             THEN e.user_id END
         ) AS editors,

         COUNT(DISTINCT
           CASE WHEN (e.role_flags & 4) <> 0
             THEN e.user_id END
         ) AS investors,

         COUNT(DISTINCT
           CASE WHEN (e.role_flags & 8) <> 0
             THEN e.user_id END
         ) AS administrators

       FROM analytics_user_daily e
       LEFT JOIN analytics_visitors v
         ON v.visitor_id = e.visitor_id
       ${bucketJoin}
       WHERE e.site_id = ?
         AND e.occurred_at >= ? AND e.occurred_at < ?`,
      [...bucketParams, siteId, startAt, endAt]
    );

    return rows[0];
  },
};

module.exports = Analytics;
