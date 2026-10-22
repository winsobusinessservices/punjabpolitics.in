const mysql = require("mysql2/promise");

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) throw new Error("Usage: node scripts/migrateStaffAccount.js email@example.com");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  try {
    const [result] = await connection.query(
      `INSERT INTO punjabpolitics.users
       (name, email, password_hash, google_sub, role, permissions, status, email_verified,
        terms_accepted, terms_accepted_at, accepted_policy_ids, pan_document, aadhar_document,
        graduation_certificate, site_id)
       SELECT name, email, password_hash, google_sub, role, permissions, status, email_verified,
        terms_accepted, terms_accepted_at, accepted_policy_ids, pan_document, aadhar_document,
        graduation_certificate, 1
       FROM ir2026.users WHERE LOWER(email) = LOWER(?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name), password_hash = VALUES(password_hash), google_sub = VALUES(google_sub),
        role = VALUES(role), permissions = VALUES(permissions), status = VALUES(status), site_id = 1`,
      [email]
    );
    if (!result.affectedRows) throw new Error("No matching staff account was found in the local Indian database");

    const [rows] = await connection.query(
      "SELECT role, status, site_id, google_sub IS NOT NULL has_google FROM punjabpolitics.users WHERE LOWER(email) = LOWER(?)",
      [email]
    );
    const account = rows[0];
    console.log(JSON.stringify({
      migrated: true,
      role: account.role,
      status: account.status,
      siteId: account.site_id,
      googleLinked: Boolean(account.has_google),
    }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
