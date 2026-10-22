// Turns the dashboard's period selector into the UTC window and streak bucket the
// analytics model expects. Calendar days follow IST (UTC+5:30), matching how
// activity days are stored.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Completed-streak buckets: each user appears only in their highest group.
const STREAK_BUCKETS = {
  "7d": { minActiveDays: 7, maxActiveDays: 29 },
  "30d": { minActiveDays: 30, maxActiveDays: 89 },
  "90d": { minActiveDays: 90, maxActiveDays: null },
};

const toSql = (date) => date.toISOString().slice(0, 19).replace("T", " ");

function startOfIstDay(now) {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS);
}

function analyticsPeriod(value, now = new Date()) {
  const period = ["today", "yesterday", "all", ...Object.keys(STREAK_BUCKETS)].includes(value) ? value : "today";
  const todayStart = startOfIstDay(now);

  if (STREAK_BUCKETS[period]) {
    // Everything up to now; the streak itself is evaluated over each user's daily history.
    return { period, startAt: "1970-01-01 00:00:00", endAt: toSql(now), ...STREAK_BUCKETS[period] };
  }
  if (period === "yesterday") {
    return { period, startAt: toSql(new Date(todayStart.getTime() - DAY_MS)), endAt: toSql(todayStart) };
  }
  if (period === "all") {
    return { period, startAt: "1970-01-01 00:00:00", endAt: toSql(now) };
  }
  return { period, startAt: toSql(todayStart), endAt: toSql(new Date(todayStart.getTime() + DAY_MS)) };
}

module.exports = { analyticsPeriod };
