const pool = require("../../config/db");
const { sendContactEmail } = require("../../services/nodemailer.service");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requestsByIp = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function submitContact(req, res) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: "Too many messages. Please try again later." });
  }

  const name = clean(req.body?.name, 100);
  const email = clean(req.body?.email, 254).toLowerCase();
  const phone = clean(req.body?.phone, 30);
  const subject = clean(req.body?.subject, 150).replace(/[\r\n]+/g, " ");
  const message = clean(req.body?.message, 5000);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "Name, email, subject, and message are required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  try {
    await sendContactEmail({ name, email, phone, subject, message });
    requestsByIp.set(ip, [...recent, now]);
    // Kept so a signed-in sender can see it under My Activity. Failing to save never undoes the sent email.
    pool.query(
      "INSERT INTO contact_messages (site_id, user_id, name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [Number(req.site?.id || 1), req.user?.userId || null, name, email, phone || null, subject, message]
    ).catch((saveError) => console.error("Saving the contact message failed:", saveError.message));
    return res.status(200).json({ success: true, message: "Thanks for contacting us. We will respond shortly." });
  } catch (error) {
    console.error("Contact email error:", error);
    return res.status(500).json({ success: false, message: "We could not send your message. Please try again." });
  }
}

module.exports = { submitContact };
