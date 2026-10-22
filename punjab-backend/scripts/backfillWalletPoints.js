const pool = require("../src/config/db");
const Wallet = require("../src/models/wallet.model");
const {
  CONTENT_REWARD_CATEGORY: CATEGORY,
  creditContentReward,
} = require("../src/services/walletRewards.service");

const APPLY = process.argv.includes("--apply");

async function loadApprovedContent() {
  const [rows] = await pool.query(
    `SELECT a.id, a.author_id, a.title, 'ARTICLE' AS content_type,
            COALESCE(a.published_at, a.created_at) AS rewarded_at, u.role
     FROM articles a JOIN users u ON u.id = a.author_id
     WHERE a.status = 'APPROVED' AND u.role IN ('AUTHOR', 'EDITOR')
     UNION ALL
     SELECT b.id, b.author_id, b.title, 'BLOG',
            COALESCE(b.published_at, b.created_at), u.role
     FROM blogs b JOIN users u ON u.id = b.author_id
     WHERE b.status = 'APPROVED' AND u.role IN ('AUTHOR', 'EDITOR')
     UNION ALL
     SELECT v.id, v.author_id, v.title, 'VIDEO',
            COALESCE(v.published_at, v.created_at), u.role
     FROM videos v JOIN users u ON u.id = v.author_id
     WHERE v.status = 'APPROVED' AND u.role IN ('AUTHOR', 'EDITOR')
     ORDER BY rewarded_at, content_type, id`
  );
  return rows;
}

async function loadExistingRewardKeys() {
  const [rows] = await pool.query(
    `SELECT user_id, reference_type, reference_id
     FROM wallet_transactions
     WHERE category = ?`,
    [CATEGORY]
  );
  return new Set(rows.map((row) => `${row.user_id}:${row.reference_type}:${row.reference_id}`));
}

function rewardKey(item) {
  return `${item.author_id}:${item.content_type}:${item.id}`;
}

function summarize(items, rewardPoints) {
  return items.reduce(
    (summary, item) => {
      summary.items += 1;
      summary.points += rewardPoints[item.role][item.content_type];
      summary.byType[item.content_type].items += 1;
      summary.byType[item.content_type].points += rewardPoints[item.role][item.content_type];
      return summary;
    },
    {
      items: 0,
      points: 0,
      byType: {
        ARTICLE: { items: 0, points: 0 },
        BLOG: { items: 0, points: 0 },
        VIDEO: { items: 0, points: 0 },
      },
    }
  );
}

async function main() {
  await pool.verifyConnection();
  const approvedContent = await loadApprovedContent();
  const existingKeys = await loadExistingRewardKeys();
  const pending = approvedContent.filter((item) => !existingKeys.has(rewardKey(item)));
  const rewardPoints = await Wallet.getRewardPoints();

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "preview", ...summarize(pending, rewardPoints) }, null, 2));
  if (!APPLY) {
    console.log("Preview only. Run with --apply to credit these points.");
    return;
  }

  let credited = 0;
  let skipped = 0;
  let creditedPoints = 0;
  for (const item of pending) {
    const result = await creditContentReward({
      userId: item.author_id,
      contributorRole: item.role,
      contentType: item.content_type,
      contentId: item.id,
      title: item.title,
      publishedAt: item.rewarded_at,
      backfilled: true,
    });
    if (result.credited) {
      credited += 1;
      creditedPoints += result.points;
    } else {
      skipped += 1;
    }
  }

  console.log(JSON.stringify({ credited, creditedPoints, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error("Wallet points backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
