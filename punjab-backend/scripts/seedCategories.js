// Creates the managed category registry and imports the categories already
// configured or used by content. Re-running it never creates duplicates.
const pool = require("../src/config/db");
const HomeWidget = require("../src/models/homeWidget.model");

const slugify = (text) => text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function seed() {
  await pool.query(`CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE, is_visible TINYINT(1) NOT NULL DEFAULT 1, created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_categories_name (name),
    CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`);

  const widgets = await HomeWidget.getAll();
  const configured = widgets.political_keywords?.categories || [];
  const [rows] = await pool.query(`
    SELECT category FROM articles WHERE category IS NOT NULL AND TRIM(category) <> ''
    UNION SELECT category FROM blogs WHERE category IS NOT NULL AND TRIM(category) <> ''
    UNION SELECT category FROM videos WHERE category IS NOT NULL AND TRIM(category) <> ''
  `);
  const names = [...new Set([...configured, ...rows.map((row) => row.category)].map((name) => name.trim()).filter(Boolean))];
  for (const name of names) {
    await pool.query(`INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)`, [name, slugify(name)]);
  }
  console.log(`Seeded ${names.length} managed categories.`);
}

seed().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
