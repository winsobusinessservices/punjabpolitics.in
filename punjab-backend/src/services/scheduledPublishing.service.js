const pool = require("../config/db");
const { creditContentReward, creditEditorReviewReward } = require("./walletRewards.service");

const SOURCES = [
  { table: "articles", type: "ARTICLE" },
  { table: "blogs", type: "BLOG" },
];

let running = false;

async function publishDueScheduledContent() {
  if (running) return 0;
  running = true;
  let published = 0;
  try {
    for (const source of SOURCES) {
      const [items] = await pool.query(
        `SELECT content.id, content.author_id, content.title, contributor.role,
                content.reviewer_id, reviewer.role AS reviewer_role
         FROM \`${source.table}\` content
         JOIN users contributor ON contributor.id = content.author_id
         LEFT JOIN users reviewer ON reviewer.id = content.reviewer_id
         WHERE content.status = 'PENDING'
           AND content.deleted_at IS NULL
           AND content.scheduled_publish_at IS NOT NULL
           AND content.scheduled_publish_at <= NOW()`
      );

      for (const item of items) {
        const [result] = await pool.query(
          `UPDATE \`${source.table}\`
           SET status = 'APPROVED', reviewed_at = NOW(), published_at = COALESCE(published_at, scheduled_publish_at)
           WHERE id = ? AND deleted_at IS NULL AND status = 'PENDING' AND scheduled_publish_at <= NOW()`,
          [item.id]
        );
        if (!result.affectedRows) continue;
        published += 1;
        if (["AUTHOR", "EDITOR"].includes(item.role)) {
          await creditContentReward({
            userId: item.author_id,
            contributorRole: item.role,
            contentType: source.type,
            contentId: item.id,
            title: item.title,
            publishedAt: new Date(),
          });
        }
        if (item.reviewer_role === "EDITOR") {
          await creditEditorReviewReward({
            editorId: item.reviewer_id,
            contentType: source.type,
            contentId: item.id,
            title: item.title,
            publishedAt: new Date(),
          });
        }
      }
    }
    return published;
  } finally {
    running = false;
  }
}

module.exports = { publishDueScheduledContent };
