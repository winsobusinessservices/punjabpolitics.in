// Key/value store for every homepage "widget" that isn't a slug-bearing post
// — hero slides, election results, poll of the day, follow-us links, etc.
// Each row is one JSON blob keyed by widget_key, so adding a new widget never
// requires a schema migration.
const pool = require("../config/db");

const TABLE = "home_widgets";

const HomeWidget = {
  // `data` is a genuine JSON-typed column, so mysql2 already decodes it to
  // the right JS value (string/array/object) — no manual JSON.parse needed,
  // and calling it anyway breaks on widgets whose payload is itself a bare
  // string (e.g. breaking_news), since that comes back already unwrapped.
  async getAll(siteId = 1) {
    const [rows] = await pool.query(`SELECT widget_key, data FROM ${TABLE} WHERE site_id = ?`, [siteId]);
    const widgets = {};
    rows.forEach((row) => {
      widgets[row.widget_key] = row.data;
    });
    return widgets;
  },

  async upsert(widgetKey, data, siteId = 1) {
    await pool.query(
      `INSERT INTO ${TABLE} (site_id, widget_key, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [siteId, widgetKey, JSON.stringify(data)]
    );
  },

  async votePoll(optionIndex, siteId = 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT data FROM ${TABLE} WHERE widget_key = ? AND site_id = ? FOR UPDATE`, ["poll_of_the_day", siteId]);
      if (!rows[0]) throw new Error("Poll is not available");
      const poll = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
      if (!Array.isArray(poll.options) || optionIndex < 0 || optionIndex >= poll.options.length) throw new Error("Please choose a valid poll option");
      const options = poll.options.map((option) => ({ ...option, votes: Number(option.votes) || 0 }));
      options[optionIndex].votes += 1;
      const totalVotes = options.reduce((total, option) => total + option.votes, 0);
      const result = {
        ...poll,
        options: options.map((option) => ({ ...option, pct: totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0 })),
        totalVotes,
      };
      await connection.query(`UPDATE ${TABLE} SET data = ? WHERE widget_key = ? AND site_id = ?`, [JSON.stringify(result), "poll_of_the_day", siteId]);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = HomeWidget;
