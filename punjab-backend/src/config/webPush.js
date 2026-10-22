const webpush = require("web-push");

/*
 * Web Push needs three values in the backend .env:
 *   VAPID_SUBJECT      mailto:you@example.com  (or an https:// address of the site)
 *   VAPID_PUBLIC_KEY   and the matching VAPID_PRIVATE_KEY (create a pair with: npx web-push generate-vapid-keys)
 * The website needs the same public key as NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 *
 * When something is missing or wrong, push is simply switched off and the rest of the server starts
 * normally; it must never stop the server from starting.
 */
const subject = String(process.env.VAPID_SUBJECT || "").trim();
const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();

let configured = false;
if (subject && publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error("Web Push is off: the VAPID settings are not valid:", error.message);
  }
} else {
  console.warn("Web Push is off: set VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the backend .env.");
}

module.exports = { webpush, isConfigured: () => configured };
