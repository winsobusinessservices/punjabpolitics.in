const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const Site = require("../models/site.model");
const emailPort = Number(process.env.EMAIL_PORT);
const useTls = String(process.env.EMAIL_USE_TLS).toLowerCase() === "true";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: emailPort === 465,
  requireTLS: useTls && emailPort !== 465,
  auth: {
    user: process.env.EMAIL_HOST_USER,
    pass: process.env.EMAIL_HOST_PASSWORD,
  },
});

// Matches the Punjab Politics maroon-and-gold theme in globals.css.
const BRAND_COLOR = "#7a1f2b";
const BRAND_CONTAINER = "#9d2b3a";
const BRAND_GOLD = "#9a6700";
const BRAND_GOLD_CONTAINER = "#d89a1d";
const BRAND_LIGHT = "#ffe3a3";
const EMAIL_BACKGROUND = "#faf7f2";
const EMAIL_BORDER = "#e8b7bf";
const EMAIL_HEADING = "#31070e";
const EMAIL_TEXT = "#4f3d40";
const EMAIL_MUTED = "#6b5659";
const EMAIL_HIGHLIGHT = "#fff8e7";
const SITE_URL = (process.env.CLIENT_ORIGIN || "https://punjabpolitics.com").split(",")[0].replace(/\/$/, "");
const EMAIL_LOGO_URL = String(process.env.EMAIL_LOGO_URL || `${SITE_URL}/images/logo.jpg`).trim();
// Email-sized (600px wide, shown at 300px for sharp high-DPI rendering) copy bundled with the
// backend so the inline logo works on any deployment, not just next to the frontend folder.
const BUNDLED_LOGO_PATH = path.resolve(__dirname, "../assets/email-logo.jpg");
const FRONTEND_LOGO_PATH = path.resolve(__dirname, "../../../punjab-frontend/public/images/logo.jpg");
const LOCAL_LOGO_PATH = fs.existsSync(BUNDLED_LOGO_PATH) ? BUNDLED_LOGO_PATH : FRONTEND_LOGO_PATH;
const EMAIL_LOGO_WIDTH = 300;
const EMAIL_LOGO_HEIGHT = 99; // 1536x505 source ratio
const EMAIL_LOGO_CID = "punjab-politics-logo";
const EMAIL_LOGO_SRC = fs.existsSync(LOCAL_LOGO_PATH) ? `cid:${EMAIL_LOGO_CID}` : EMAIL_LOGO_URL;
const PANEL_URL = (process.env.PANEL_ORIGIN || "https://panel.punjabpolitics.com").trim().replace(/\/$/, "");
const STAFF_ROLES = new Set(["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN"]);

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

// Logo, name and address come from the website's settings (Website Settings in the
// panel), so changing the logo there changes every email. Falls back to the bundled logo.
const SITE_SLUG = process.env.SITE_SLUG || "punjab-politics";
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const BRANDING_TTL_MS = 60 * 1000;
let brandingCache = { at: 0, key: "", value: null };

// Uploaded logos are usually WebP, which many mail apps cannot show, so they are sent as a
// 600px-wide JPEG on white (displayed at 300px for sharp rendering on high-DPI screens).
async function logoFromUpload(logoUrl) {
  const file = path.resolve(__dirname, "../..", String(logoUrl).replace(/^\/+/, ""));
  if (!file.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(file)) return null;
  const image = sharp(file).rotate().resize({ width: 600, withoutEnlargement: true }).flatten({ background: "#ffffff" });
  const { data, info } = await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { content: data, width: info.width, height: info.height };
}

async function loadBranding() {
  let site = null;
  try {
    site = await Site.findBySlug(SITE_SLUG);
  } catch (error) {
    console.error("Email branding: site lookup failed:", error.message);
  }
  const siteName = site?.name || "Punjab Politics";
  const siteUrl = site?.domain ? `https://${String(site.domain).replace(/^https?:\/\//, "")}`.replace(/\/$/, "") : SITE_URL;
  const key = `${site?.id}|${site?.logo_url}|${site?.updated_at}|${siteName}|${siteUrl}`;
  if (brandingCache.value && brandingCache.key === key) return brandingCache.value;

  let attachment = null;
  let logoSrc = null;
  let ratio = 99 / 300;
  const logoUrl = String(site?.logo_url || "").trim();
  try {
    if (logoUrl.startsWith("/uploads/")) {
      const logo = await logoFromUpload(logoUrl);
      if (logo) {
        attachment = { filename: "logo.jpg", content: logo.content, contentType: "image/jpeg", cid: EMAIL_LOGO_CID };
        logoSrc = `cid:${EMAIL_LOGO_CID}`;
        ratio = logo.height / logo.width;
      }
    } else if (/^https?:\/\//i.test(logoUrl)) {
      logoSrc = logoUrl; // hosted elsewhere: link to it directly
      ratio = 0;
    }
  } catch (error) {
    console.error("Email branding: could not prepare the website logo:", error.message);
  }
  if (!logoSrc && fs.existsSync(LOCAL_LOGO_PATH)) {
    attachment = { filename: "punjab-politics-logo.jpg", path: LOCAL_LOGO_PATH, cid: EMAIL_LOGO_CID };
    logoSrc = `cid:${EMAIL_LOGO_CID}`;
  }
  const value = {
    attachments: attachment ? [attachment] : [],
    logoSrc: logoSrc || EMAIL_LOGO_URL,
    logoWidth: EMAIL_LOGO_WIDTH,
    logoHeight: ratio ? Math.round(EMAIL_LOGO_WIDTH * ratio) : null,
    siteName,
    siteUrl,
  };
  brandingCache = { at: Date.now(), key, value };
  return value;
}

async function getEmailBranding() {
  return loadBranding();
}

function emailButton(label, href) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td bgcolor="${BRAND_COLOR}" style="border:1px solid ${BRAND_COLOR};border-radius:6px;box-shadow:0 2px 0 ${BRAND_GOLD_CONTAINER};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function emailTemplate({ preheader, eyebrow = "PUNJAB POLITICS", title, content, branding }) {
  const brand = branding || { logoSrc: EMAIL_LOGO_SRC, logoWidth: EMAIL_LOGO_WIDTH, logoHeight: EMAIL_LOGO_HEIGHT, siteName: "Punjab Politics", siteUrl: SITE_URL };
  return `<!doctype html>
  <html lang="en">
    <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
    <body style="margin:0;padding:0;background:${EMAIL_BACKGROUND};color:${EMAIL_TEXT};font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${EMAIL_BACKGROUND};">
        <tr><td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid ${EMAIL_BORDER};border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(122,31,43,.08);">
            <tr>
              <td style="background:${BRAND_CONTAINER};border-bottom:4px solid ${BRAND_GOLD_CONTAINER};padding:24px 28px;text-align:center;">
                <a href="${escapeHtml(brand.siteUrl)}" style="display:inline-block;text-decoration:none;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr>
                    <td bgcolor="#ffffff" style="background:#ffffff;border-radius:8px;padding:10px 14px;">
                      <img src="${escapeHtml(brand.logoSrc)}" width="${brand.logoWidth}"${brand.logoHeight ? ` height="${brand.logoHeight}"` : ""} alt="${escapeHtml(brand.siteName)}" style="display:block;width:${brand.logoWidth}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
                    </td>
                  </tr></table>
                </a>
                <div style="margin-top:10px;color:${BRAND_LIGHT};font-size:10px;letter-spacing:2px;text-transform:uppercase;">Punjab political news &amp; analysis</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px;">
                <div style="color:${BRAND_GOLD};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:9px 0 20px;color:${EMAIL_HEADING};font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.25;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:${EMAIL_TEXT};">${content}</div>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${EMAIL_BORDER};background:${EMAIL_HIGHLIGHT};padding:20px 32px;text-align:center;color:${EMAIL_MUTED};font-size:11px;line-height:1.6;">
                This is an automated message from ${escapeHtml(brand.siteName)}.<br />
                <a href="${escapeHtml(brand.siteUrl)}" style="color:${BRAND_COLOR};text-decoration:none;">${escapeHtml(brand.siteUrl)}</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: "Reset your Punjab Politics password",

    text: `You requested a password reset.

Click the link below to reset your password:

${resetUrl}

This link will expire in 15 minutes.

If you did not request a password reset, you can safely ignore this email.`,

    html: emailTemplate({
      branding,
      preheader: "Reset your Punjab Politics password",
      eyebrow: "Account security",
      title: "Reset your password",
      content: `<p style="margin:0 0 14px;">We received a request to reset your Punjab Politics password.</p><p style="margin:0;">Use the secure button below to choose a new password.</p>${emailButton("Reset password", resetUrl)}<p style="margin:0 0 10px;"><strong>This link expires in 15 minutes.</strong></p><p style="margin:0;color:${EMAIL_MUTED};font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>`,
    }),
  });
}

async function sendRegistrationOtpEmail(to, otp) {
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: "Verify your Punjab Politics email",
    text: `Your Punjab Politics verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: emailTemplate({
      branding,
      preheader: `Your verification code is ${otp}`,
      eyebrow: "Email verification",
      title: "Verify your email address",
      content: `<p style="margin:0;">Use this code to complete your Punjab Politics registration:</p><div style="margin:24px 0;padding:18px;border:1px solid ${BRAND_GOLD_CONTAINER};border-radius:8px;background:${EMAIL_HIGHLIGHT};text-align:center;color:${BRAND_COLOR};font-size:34px;font-weight:700;letter-spacing:9px;">${escapeHtml(otp)}</div><p style="margin:0 0 10px;"><strong>This code expires in 10 minutes.</strong></p><p style="margin:0;color:${EMAIL_MUTED};font-size:13px;">Never share this code. If you did not request it, you can ignore this email.</p>`,
    }),
  });
}

async function sendApplicationShortlistedEmail(to, name, jobTitle) {
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `You've been shortlisted — ${jobTitle}`,

    text: `Hi ${name},

Good news — you've been shortlisted for the ${jobTitle} position at Punjab Politics.

Our team will be in touch shortly with the next steps.

Congratulations!`,

    html: emailTemplate({
      branding,
      preheader: `You have been shortlisted for ${jobTitle}`,
      eyebrow: "Careers update",
      title: "You have been shortlisted!",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 14px;">Good news — you have been shortlisted for the <strong>${escapeHtml(jobTitle)}</strong> position at Punjab Politics.</p><p style="margin:0;">Our team will contact you shortly with the next steps. Congratulations!</p>`,
    }),
  });
}

async function sendRoleChangedEmail(to, name, oldRole, newRole) {
  const loginUrl = `${STAFF_ROLES.has(newRole) ? PANEL_URL : SITE_URL}/login`;

  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: "Your Punjab Politics account role has changed",

    text: `Hi ${name},

An admin has changed your role on Punjab Politics from ${oldRole} to ${newRole}.

Sign in here: ${loginUrl}

If you have any questions about this change, please contact an admin.`,

    html: emailTemplate({
      branding,
      preheader: `Your account role is now ${newRole}`,
      eyebrow: "Account update",
      title: "Your role has changed",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0;">An administrator changed your Punjab Politics role from <strong>${escapeHtml(oldRole)}</strong> to <strong>${escapeHtml(newRole)}</strong>.</p>${emailButton("Sign in", loginUrl)}<p style="margin:0;color:${EMAIL_MUTED};font-size:13px;">If you have questions about this change, please contact an administrator.</p>`,
    }),
  });
}

async function sendInvestorApprovedEmail(to, name, { separateAccount = false } = {}) {
  const dashboardUrl = `${SITE_URL}/investor/dashboard`;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: "Your investor application has been approved",
    text: `Hi ${name}\n\nYour investor application has been approved.${separateAccount ? " A separate Investor account has been created for this email. Please use the password-setup email before signing in." : " Your existing Punjab Politics account now has Investor access."}\n\nInvestor dashboard: ${dashboardUrl}\n\nIf you have questions, please contact our team.`,
    html: emailTemplate({
      branding,
      preheader: "Your investor application has been approved",
      eyebrow: "Investor relations",
      title: "Welcome as an investor",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 14px;">Your investor application has been approved.</p><p style="margin:0;">${separateAccount ? "A separate Investor account has been created for this email. Please use the password-setup email before signing in." : "Your existing Punjab Politics account now has Investor access."}</p>${emailButton("Open investor dashboard", dashboardUrl)}<p style="margin:0;color:${EMAIL_MUTED};font-size:13px;">If you have questions, please contact our team.</p>`,
    }),
  });
}

async function sendContactEmail({ name, email, phone, subject, message }) {
  const recipient = process.env.CONTACT_EMAIL || process.env.EMAIL_HOST_USER;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics Contact" <${process.env.EMAIL_HOST_USER}>`,
    replyTo: email,
    to: recipient,
    subject: `[Contact] ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\n\n${message}`,
    html: emailTemplate({
      branding,
      preheader: `New contact message from ${name}`,
      eyebrow: "Website contact",
      title: "New contact message",
      content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;background:${EMAIL_HIGHLIGHT};border:1px solid ${BRAND_GOLD_CONTAINER};border-radius:8px;"><tr><td style="padding:16px;color:${EMAIL_TEXT};"><strong style="color:${BRAND_COLOR};">Name:</strong> ${escapeHtml(name)}<br /><strong style="color:${BRAND_COLOR};">Email:</strong> ${escapeHtml(email)}<br /><strong style="color:${BRAND_COLOR};">Phone:</strong> ${escapeHtml(phone || "Not provided")}<br /><strong style="color:${BRAND_COLOR};">Subject:</strong> ${escapeHtml(subject)}</td></tr></table><div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`,
    }),
  });
}

const inr = (value) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Contributor asked for a payout -> goes to the site's Contact mailbox (the admins' inbox).
async function sendWithdrawalRequestedEmail({ name, email, role, amountInr, points, upiId, requestedAt }) {
  const recipient = process.env.CONTACT_EMAIL || process.env.EMAIL_HOST_USER;
  const queueUrl = `${PANEL_URL}/author/withdrawals`;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    replyTo: email,
    to: recipient,
    subject: `[Withdrawal request] ${name} — ${inr(amountInr)}`,
    text: `${name} (${role}, ${email}) requested a withdrawal.\n\nAmount: ${inr(amountInr)} (${points} points)\nUPI ID: ${upiId}\nRequested: ${new Date(requestedAt).toLocaleString("en-IN")}\n\nReview it here: ${queueUrl}`,
    html: emailTemplate({
      branding,
      preheader: `${name} requested a withdrawal of ${inr(amountInr)}`,
      eyebrow: "Wallet & points",
      title: "New withdrawal request",
      content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:8px;background:${EMAIL_HIGHLIGHT};border:1px solid ${BRAND_GOLD_CONTAINER};border-radius:8px;"><tr><td style="padding:16px;color:${EMAIL_TEXT};"><strong style="color:${BRAND_COLOR};">Contributor:</strong> ${escapeHtml(name)} (${escapeHtml(role)})<br /><strong style="color:${BRAND_COLOR};">Email:</strong> ${escapeHtml(email)}<br /><strong style="color:${BRAND_COLOR};">Amount:</strong> ${escapeHtml(inr(amountInr))} (${escapeHtml(points)} points)<br /><strong style="color:${BRAND_COLOR};">UPI ID:</strong> ${escapeHtml(upiId)}</td></tr></table><p style="margin:0;">Pay this UPI ID, then mark the request as paid with the UTR number, or reject it with a reason.</p>${emailButton("Review withdrawal requests", queueUrl)}`,
    }),
  });
}

// Admin marked the request paid -> author gets the UTR as proof of payment.
async function sendWithdrawalPaidEmail(to, name, { amountInr, upiId, utrNumber }) {
  const walletUrl = `${PANEL_URL}/author/wallet`;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `Your withdrawal of ${inr(amountInr)} has been paid`,
    text: `Hi ${name},\n\nYour withdrawal of ${inr(amountInr)} has been paid to ${upiId}.\nUTR / reference number: ${utrNumber}\n\nWallet: ${walletUrl}`,
    html: emailTemplate({
      branding,
      preheader: `${inr(amountInr)} was paid to your UPI ID`,
      eyebrow: "Wallet & points",
      title: "Your withdrawal has been paid",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 14px;">Your withdrawal of <strong>${escapeHtml(inr(amountInr))}</strong> has been paid to <strong>${escapeHtml(upiId)}</strong>.</p><div style="margin:18px 0;padding:16px;border:1px solid ${BRAND_GOLD_CONTAINER};border-radius:8px;background:${EMAIL_HIGHLIGHT};color:${BRAND_COLOR};font-size:20px;font-weight:700;letter-spacing:1px;text-align:center;">UTR: ${escapeHtml(utrNumber)}</div><p style="margin:0;color:${EMAIL_MUTED};font-size:13px;">Quote this UTR if you need to check the transfer with your bank.</p>${emailButton("Open my wallet", walletUrl)}`,
    }),
  });
}

// Admin rejected the request -> author gets the reason; the points are already back in the wallet.
async function sendWithdrawalRejectedEmail(to, name, { amountInr, reason }) {
  const walletUrl = `${PANEL_URL}/author/wallet`;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"Punjab Politics" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `Your withdrawal request of ${inr(amountInr)} was not approved`,
    text: `Hi ${name},\n\nYour withdrawal request of ${inr(amountInr)} was not approved.\nReason: ${reason}\n\nThe points have been returned to your wallet and you can submit a new request.\n\nWallet: ${walletUrl}`,
    html: emailTemplate({
      branding,
      preheader: `Your withdrawal request of ${inr(amountInr)} was not approved`,
      eyebrow: "Wallet & points",
      title: "Withdrawal request not approved",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0 0 14px;">Your withdrawal request of <strong>${escapeHtml(inr(amountInr))}</strong> was not approved.</p><div style="margin:18px 0;padding:16px;border:1px solid ${BRAND_GOLD_CONTAINER};border-radius:8px;background:${EMAIL_HIGHLIGHT};white-space:pre-wrap;"><strong style="color:${BRAND_COLOR};">Reason:</strong> ${escapeHtml(reason)}</div><p style="margin:0;">The points have been returned to your wallet, so you can submit a new request.</p>${emailButton("Open my wallet", walletUrl)}`,
    }),
  });
}

// ---- Support (donation) receipt ---------------------------------------------------------------------------
async function sendDonationReceiptEmail({ to, name, amountPaise, kind, receiptNumber, paidAt }) {
  const branding = await getEmailBranding();
  const amount = "\u20B9" + (Number(amountPaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const on = paidAt ? new Date(paidAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "";
  const monthly = kind === "MONTHLY";
  const firstName = String(name || "").trim().split(/\s+/)[0] || "there";
  await transporter.sendMail({
    attachments: branding.attachments,
    from: '"' + branding.siteName + '" <' + process.env.EMAIL_HOST_USER + ">",
    to,
    subject: "Thank you for supporting " + branding.siteName + ". Receipt " + (receiptNumber || ""),
    text: "Hi " + firstName + ",\n\nThank you for your " + (monthly ? "monthly " : "") + "contribution to " + branding.siteName + ".\nAmount: " + amount + "\nReceipt number: " + (receiptNumber || "-") + "\nDate: " + on + (monthly ? "\n\nYou can stop a monthly contribution any time from your profile page: " + branding.siteUrl + "/profile" : ""),
    html: emailTemplate({
      branding,
      preheader: "Your contribution of " + amount + " was received",
      eyebrow: "Support",
      title: "Thank you for your support",
      content: '<p style="margin:0 0 14px;">Hi ' + escapeHtml(firstName) + ',</p><p style="margin:0;">Your ' + (monthly ? "monthly " : "") + "contribution helps us keep reporting on Indian politics independent. We are grateful.</p>"
        + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:' + EMAIL_HIGHLIGHT + ";border:1px solid " + EMAIL_BORDER + ';border-radius:8px;">'
        + '<tr><td style="padding:10px 14px;font-size:12px;color:' + EMAIL_MUTED + ';width:130px;">Amount</td><td style="padding:10px 14px;font-size:14px;color:' + EMAIL_HEADING + ';"><strong>' + escapeHtml(amount) + (monthly ? " every month" : "") + "</strong></td></tr>"
        + '<tr><td style="padding:10px 14px;font-size:12px;color:' + EMAIL_MUTED + ';">Receipt number</td><td style="padding:10px 14px;font-size:14px;color:' + EMAIL_HEADING + ';"><strong>' + escapeHtml(receiptNumber || "-") + "</strong></td></tr>"
        + '<tr><td style="padding:10px 14px;font-size:12px;color:' + EMAIL_MUTED + ';">Date</td><td style="padding:10px 14px;font-size:14px;color:' + EMAIL_HEADING + ';"><strong>' + escapeHtml(on) + "</strong></td></tr></table>"
        + (monthly ? '<p style="margin:0 0 6px;color:' + EMAIL_MUTED + ';font-size:13px;">You can stop a monthly contribution any time from your profile page.</p>' + emailButton("Open my profile", branding.siteUrl + "/profile") : ""),
    }),
  });
}

// ---- Interest alert (the "Email" channel of the My interests survey) --------------------------------------
async function sendInterestEmail({ to, name, title, body, url }) {
  const branding = await getEmailBranding();
  const link = /^https?:\/\//i.test(url) ? url : branding.siteUrl + (String(url || "/").startsWith("/") ? url : "/" + url);
  const settingsUrl = branding.siteUrl + "/my-interests";
  const firstName = String(name || "").trim().split(/\s+/)[0] || "there";
  await transporter.sendMail({
    attachments: branding.attachments,
    from: '"' + branding.siteName + '" <' + process.env.EMAIL_HOST_USER + ">",
    to,
    subject: title,
    text: "Hi " + firstName + ",\n\n" + title + "\n" + (body || "") + "\n\nRead it: " + link + "\n\nYou get this because you chose email updates in My interests. Change or stop them any time: " + settingsUrl,
    html: emailTemplate({
      branding,
      preheader: body || title,
      eyebrow: "For you",
      title,
      content: '<p style="margin:0 0 14px;">Hi ' + escapeHtml(firstName) + ",</p>"
        + (body ? '<p style="margin:0;">' + escapeHtml(body) + "</p>" : "")
        + emailButton("Read now", link)
        + '<p style="margin:0;color:' + EMAIL_MUTED + ';font-size:12px;">You get this because you chose email updates in My interests. <a href="' + escapeHtml(settingsUrl) + '" style="color:' + BRAND_COLOR + ';">Change or stop them any time</a>.</p>',
    }),
  });
}

// ---- Premium subscription email -----------------------------------------------------------------------------
async function sendPremiumWelcomeEmail({ to, name, amountPaise, receiptNumber, endsAt }) {
  const branding = await getEmailBranding();
  const amount = `₹${(Number(amountPaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const until = endsAt ? new Date(endsAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "";
  const readUrl = `${branding.siteUrl}/premium`;
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"${branding.siteName}" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `Welcome to Premium. Receipt ${receiptNumber || ""}`.trim(),
    text: `Hi ${name},

Thank you for subscribing to ${branding.siteName} Premium.
Amount paid: ${amount}
Receipt number: ${receiptNumber || "-"}
Premium is active until: ${until}

Read premium stories: ${readUrl}`,
    html: emailTemplate({
      branding,
      preheader: `Your Premium is active until ${until}`,
      eyebrow: "Premium",
      title: "Welcome to Premium",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p><p style="margin:0;">Thank you for subscribing. Ads are switched off and every premium story is open to you.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:${EMAIL_HIGHLIGHT};border:1px solid ${EMAIL_BORDER};border-radius:8px;"><tr><td style="padding:10px 14px;font-size:12px;color:${EMAIL_MUTED};width:130px;">Amount paid</td><td style="padding:10px 14px;font-size:14px;color:${EMAIL_HEADING};"><strong>${escapeHtml(amount)}</strong></td></tr><tr><td style="padding:10px 14px;font-size:12px;color:${EMAIL_MUTED};">Receipt number</td><td style="padding:10px 14px;font-size:14px;color:${EMAIL_HEADING};"><strong>${escapeHtml(receiptNumber || "-")}</strong></td></tr><tr><td style="padding:10px 14px;font-size:12px;color:${EMAIL_MUTED};">Active until</td><td style="padding:10px 14px;font-size:14px;color:${EMAIL_HEADING};"><strong>${escapeHtml(until)}</strong></td></tr></table>${emailButton("Read premium stories", readUrl)}`,
    }),
  });
}

// ---- Task management emails -------------------------------------------------
// Status changes are also copied to the contact mailbox (CONTACT_EMAIL; set TASK_NOTIFICATION_EMAIL to use a different one).
const TASK_NOTIFICATION_EMAIL = String(process.env.TASK_NOTIFICATION_EMAIL || process.env.CONTACT_EMAIL || process.env.EMAIL_HOST_USER || "").trim();
const TASK_STATUS_LABEL = { open: "Open", in_progress: "In progress", done: "Completed" };
const TASK_PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High" };
const taskStatusLabel = (value) => TASK_STATUS_LABEL[value] || String(value || "");

function taskDetailsTable(task, dueDate) {
  const rows = [
    ["Task", task.title],
    ["Status", taskStatusLabel(task.status)],
    ["Priority", TASK_PRIORITY_LABEL[task.priority] || task.priority],
    dueDate ? ["Due", new Date(dueDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })] : null,
  ].filter(Boolean);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:${EMAIL_HIGHLIGHT};border:1px solid ${EMAIL_BORDER};border-radius:8px;">${rows.map(([label, value]) => `<tr><td style="padding:10px 14px;font-size:12px;color:${EMAIL_MUTED};width:90px;">${escapeHtml(label)}</td><td style="padding:10px 14px;font-size:14px;color:${EMAIL_HEADING};"><strong>${escapeHtml(value)}</strong></td></tr>`).join("")}</table>`;
}

async function sendTaskAssignedEmail({ to, assigneeName, assignedByName, task, dueDate }) {
  const taskUrl = `${PANEL_URL}/author/task-management`;
  const branding = await getEmailBranding();
  const selfAssigned = assignedByName === assigneeName;
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"${branding.siteName}" <${process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `New task: ${task.title}`,
    text: `Hi ${assigneeName},

${selfAssigned ? "You created" : `${assignedByName} assigned you`} a task: ${task.title}
Priority: ${TASK_PRIORITY_LABEL[task.priority] || task.priority}${dueDate ? `
Due: ${new Date(dueDate).toDateString()}` : ""}

Open your tasks: ${taskUrl}`,
    html: emailTemplate({
      branding,
      preheader: `New task: ${task.title}`,
      eyebrow: "Task management",
      title: selfAssigned ? "You created a task" : "A task was assigned to you",
      content: `<p style="margin:0 0 14px;">Hi ${escapeHtml(assigneeName)},</p><p style="margin:0;">${selfAssigned ? "You created the following task:" : `<strong>${escapeHtml(assignedByName)}</strong> assigned you the following task:`}</p>${taskDetailsTable(task, dueDate)}${emailButton("Open tasks", taskUrl)}`,
    }),
  });
}

async function sendTaskStatusChangedEmail({ to, task, previousStatus, changedByName, note }) {
  const taskUrl = `${PANEL_URL}/author/task-management`;
  const branding = await getEmailBranding();
  await transporter.sendMail({
    attachments: branding.attachments,
    from: `"${branding.siteName}" <${process.env.CONTACT_EMAIL || process.env.EMAIL_HOST_USER}>`,
    to,
    subject: `Task ${taskStatusLabel(task.status).toLowerCase()}: ${task.title}`,
    text: `${changedByName} changed the status of "${task.title}" from ${taskStatusLabel(previousStatus)} to ${taskStatusLabel(task.status)}.${note ? `

Note: ${note}` : ""}

Open tasks: ${taskUrl}`,
    html: emailTemplate({
      branding,
      preheader: `${task.title}: ${taskStatusLabel(previousStatus)} to ${taskStatusLabel(task.status)}`,
      eyebrow: "Task management",
      title: "Task status updated",
      content: `<p style="margin:0;"><strong>${escapeHtml(changedByName)}</strong> changed the status from <strong>${escapeHtml(taskStatusLabel(previousStatus))}</strong> to <strong>${escapeHtml(taskStatusLabel(task.status))}</strong>.</p>${taskDetailsTable(task)}${note ? `<p style="margin:0 0 14px;color:${EMAIL_MUTED};font-size:13px;">Note from ${escapeHtml(changedByName)}:</p><blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid ${BRAND_GOLD_CONTAINER};background:${EMAIL_HIGHLIGHT};">${escapeHtml(note)}</blockquote>` : ""}${emailButton("Open tasks", taskUrl)}`,
    }),
  });
}

module.exports = {
  sendInterestEmail,
  sendDonationReceiptEmail,
  sendPremiumWelcomeEmail,
  TASK_NOTIFICATION_EMAIL,
  sendTaskAssignedEmail,
  sendTaskStatusChangedEmail,
  sendWithdrawalRequestedEmail,
  sendWithdrawalPaidEmail,
  sendWithdrawalRejectedEmail,
  sendRegistrationOtpEmail,
  sendPasswordResetEmail,
  sendApplicationShortlistedEmail,
  sendRoleChangedEmail,
  sendInvestorApprovedEmail,
  sendContactEmail,
};
