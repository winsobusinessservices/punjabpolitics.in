const pool = require("../config/db");

/*
 * Everything a signed-in person has submitted, for the "My Activity" page. Each list is limited to
 * what belongs to this account. Nothing sensitive is returned: no gateway ids, no PAN / Aadhaar
 * numbers or documents, and no internal reviewer notes.
 */
async function getMyHistory(user) {
  const userId = Number(user.id);
  const email = String(user.email || "").toLowerCase();

  const [donations, contactMessages, applications, careerApplications, interests, premiumPurchases] = await Promise.all([
    // Pending payments that were never completed are hidden after two hours.
    pool.query(
      `SELECT public_id, amount_paise, kind, status, receipt_number, paid_at, created_at, subscription_ended_at,
              provider_subscription_id
         FROM donations
        WHERE user_id = ? AND (status <> 'CREATED' OR created_at >= (NOW() - INTERVAL 2 HOUR))
        ORDER BY COALESCE(paid_at, created_at) DESC, id DESC LIMIT 100`,
      [userId]
    ),
    pool.query(
      `SELECT id, subject, message, created_at FROM contact_messages
        WHERE user_id = ? OR (user_id IS NULL AND email = ?)
        ORDER BY created_at DESC LIMIT 100`,
      [userId, email]
    ),
    pool.query(
      `SELECT id, role, status, message, reviewed_at, created_at FROM role_applications
        WHERE applicant_user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`,
      [userId]
    ),
    pool.query(
      `SELECT a.id, a.status, a.created_at, a.reviewed_at, j.title, j.slug
         FROM career_applications a LEFT JOIN career_jobs j ON j.id = a.career_id
        WHERE a.applicant_id = ? ORDER BY a.created_at DESC LIMIT 50`,
      [userId]
    ),
    pool.query("SELECT completed_at, updated_at FROM user_preferences WHERE user_id = ? LIMIT 1", [userId]),
    // Paid (and refunded) Premium months. Attempts that were never paid are not shown.
    pool.query(
      `SELECT public_id, plan_name, amount_paise, days, status, receipt_number, paid_at, starts_at, ends_at
         FROM premium_subscriptions
        WHERE user_id = ? AND status IN ('PAID', 'REFUNDED')
        ORDER BY COALESCE(paid_at, created_at) DESC, id DESC LIMIT 50`,
      [userId]
    ),
  ]);

  // Premium: the reader is subscribed until the latest end date among paid months that have not ended.
  const now = Date.now();
  const subscriptions = premiumPurchases[0].map((row) => {
    const starts = row.starts_at ? new Date(row.starts_at).getTime() : null;
    const ends = row.ends_at ? new Date(row.ends_at).getTime() : null;
    let state = "EXPIRED";
    if (row.status === "REFUNDED") state = "REFUNDED";
    else if (ends && ends > now) state = starts && starts > now ? "UPCOMING" : "ACTIVE";
    return {
      id: row.public_id,
      planName: row.plan_name || "Premium",
      amountPaise: row.amount_paise,
      days: row.days,
      status: row.status,
      state,
      receiptNumber: row.receipt_number,
      date: row.paid_at,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    };
  });
  const lastEnd = Math.max(0, ...premiumPurchases[0].filter((row) => row.status === "PAID" && row.ends_at && new Date(row.ends_at).getTime() > now).map((row) => new Date(row.ends_at).getTime()));
  const lastEverEnd = Math.max(0, ...premiumPurchases[0].filter((row) => row.status === "PAID" && row.ends_at).map((row) => new Date(row.ends_at).getTime()));
  const subscription = {
    active: lastEnd > 0,
    validUntil: lastEnd > 0 ? new Date(lastEnd).toISOString() : null,
    daysLeft: lastEnd > 0 ? Math.max(0, Math.ceil((lastEnd - now) / 86400000)) : 0,
    endedOn: lastEnd === 0 && lastEverEnd > 0 ? new Date(lastEverEnd).toISOString() : null, // when a lapsed Premium ended
  };

  // Rows are newest first. Only the newest paid row of a running monthly contribution is "active"
  // (that is the one the Stop button belongs to); the older months are just history.
  const seenSubscriptions = new Set();
  const donationRows = donations[0].map((row) => {
    const running = row.kind === "MONTHLY" && Boolean(row.provider_subscription_id) && !row.subscription_ended_at && row.status === "PAID";
    const current = running && !seenSubscriptions.has(row.provider_subscription_id);
    if (running) seenSubscriptions.add(row.provider_subscription_id);
    return {
      id: row.public_id,
      amountPaise: row.amount_paise,
      kind: row.kind,
      status: row.status,
      receiptNumber: row.receipt_number,
      date: row.paid_at || row.created_at,
      monthlyActive: current,
      monthlyStopped: row.kind === "MONTHLY" && Boolean(row.subscription_ended_at),
    };
  });

  return {
    donations: donationRows,
    subscription,
    subscriptions,
    contactMessages: contactMessages[0].map((row) => ({ id: row.id, subject: row.subject, message: row.message, date: row.created_at })),
    applications: applications[0].map((row) => ({
      id: row.id, role: row.role, status: row.status, message: row.message, date: row.created_at, reviewedAt: row.reviewed_at,
    })),
    careerApplications: careerApplications[0].map((row) => ({
      id: row.id, jobTitle: row.title, jobSlug: row.slug, status: row.status, date: row.created_at, reviewedAt: row.reviewed_at,
    })),
    interests: interests[0][0] ? { submittedAt: interests[0][0].completed_at, updatedAt: interests[0][0].updated_at } : null,
  };
}

module.exports = { getMyHistory };
