const Donation = require("../../models/donation.model");
const donations = require("../../services/donations.service");

const WINDOW_MS = 60 * 60 * 1000;
const attemptsByIp = new Map();

// Simple per-IP limit for the public endpoints.
function limited(req, key, max) {
  const ip = req.get("cf-connecting-ip") || req.ip || req.socket?.remoteAddress || "unknown";
  const bucket = `${key}:${ip}`;
  const now = Date.now();
  const recent = (attemptsByIp.get(bucket) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= max) return true;
  attemptsByIp.set(bucket, [...recent, now]);
  return false;
}

function fail(res, error, fallback) {
  if (error instanceof donations.DonationError || error?.name === "DonationProviderError") {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

const siteIdOf = (req) => Number(req.site?.id || 1);

async function getConfig(req, res) {
  try {
    return res.status(200).json({ success: true, config: donations.getSupportConfig() });
  } catch (error) {
    return fail(res, error, "Support settings could not be loaded.");
  }
}

// Open to everyone: a donor does not need an account. A signed-in donor is linked so they can stop a monthly gift later.
async function startDonation(req, res) {
  try {
    // Hidden field only bots fill: look successful, create nothing.
    if (String(req.body?.website || "").trim()) return res.status(201).json({ success: true, donation: { publicId: "ignored" }, checkout: null });
    if (limited(req, "donation-start", 20)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const result = await donations.startDonation(req.body || {}, { siteId: siteIdOf(req), userId: req.user?.userId || null });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return fail(res, error, "The contribution could not be started. Please try again.");
  }
}

async function confirmDonation(req, res) {
  try {
    if (limited(req, "donation-confirm", 40)) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    const { donation, newlyPaid } = await donations.confirmDonation(req.params.publicId, { paymentId: req.body?.paymentId, signature: req.body?.signature });
    return res.status(200).json({ success: true, status: donation.status, receiptNumber: donation.receipt_number, newlyPaid });
  } catch (error) {
    return fail(res, error, "The payment could not be confirmed. Please contact us if money was taken.");
  }
}

async function getDonationStatus(req, res) {
  try {
    const donation = await donations.publicStatus(req.params.publicId);
    if (!donation) return res.status(404).json({ success: false, message: "Contribution not found." });
    return res.status(200).json({ success: true, donation });
  } catch (error) {
    return fail(res, error, "The contribution could not be loaded.");
  }
}

async function stopMonthly(req, res) {
  try {
    const result = await donations.stopMonthly(req.params.publicId, req.user.userId);
    return res.status(200).json({ success: true, message: result.alreadyStopped ? "This monthly contribution was already stopped." : "Your monthly contribution has been stopped. Thank you for your support." });
  } catch (error) {
    return fail(res, error, "The monthly contribution could not be stopped. Please contact us.");
  }
}

async function getMine(req, res) {
  try {
    return res.status(200).json({ success: true, donations: await donations.listMine(req.user.userId) });
  } catch (error) {
    return fail(res, error, "Your contributions could not be loaded.");
  }
}

// First names of supporters who chose to be on the wall. Never amounts or emails.
async function getSupporters(req, res) {
  try {
    return res.status(200).json({ success: true, supporters: await Donation.wall(siteIdOf(req)) });
  } catch (error) {
    return fail(res, error, "The supporters could not be loaded.");
  }
}

// ---- Admin -------------------------------------------------------------------------------------------------
const filtersOf = (query) => ({
  status: ["CREATED", "PAID", "FAILED", "EXPIRED", "REFUNDED", "CANCELLED"].includes(query.status) ? query.status : undefined,
  kind: ["ONE_TIME", "MONTHLY"].includes(query.kind) ? query.kind : undefined,
  q: String(query.q || "").trim().slice(0, 100) || undefined,
});

async function adminList(req, res) {
  try {
    const siteId = siteIdOf(req);
    await Donation.expireStale().catch(() => {});
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [summary, rows] = await Promise.all([Donation.adminSummary(siteId), Donation.adminList(siteId, filtersOf(req.query), { limit, offset })]);
    return res.status(200).json({ success: true, summary, donations: rows, limit, offset });
  } catch (error) {
    return fail(res, error, "Donations could not be loaded.");
  }
}

// Columns an admin can pick for the CSV (the same keys the panel table uses).
const CSV_COLUMNS = {
  receipt_number: ["Receipt", (row) => row.receipt_number],
  created_at: ["Created", (row) => row.created_at],
  paid_at: ["Paid on", (row) => row.paid_at],
  donor_name: ["Name", (row) => row.donor_name],
  donor_email: ["Email", (row) => row.donor_email],
  donor_phone: ["Phone", (row) => row.donor_phone],
  amount_rupees: ["Amount (INR)", (row) => (Number(row.amount_paise) / 100).toFixed(2)],
  kind: ["Type", (row) => (row.kind === "MONTHLY" ? (row.subscription_ended_at ? "Monthly (ended)" : "Monthly") : "One time")],
  status: ["Status", (row) => row.status],
  message: ["Message", (row) => row.message],
  provider: ["Gateway", (row) => row.provider],
  provider_payment_id: ["Payment id", (row) => row.provider_payment_id],
  provider_subscription_id: ["Subscription id", (row) => row.provider_subscription_id],
  refunded_at: ["Refunded on", (row) => row.refunded_at],
  show_on_wall: ["On supporters wall", (row) => (row.show_on_wall ? "Yes" : "No")],
};

// Quotes a cell; a value that starts like a spreadsheet formula is made harmless.
function csvCell(value) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

async function adminExport(req, res) {
  try {
    const keys = String(req.query.fields || "").split(",").map((key) => key.trim()).filter((key) => CSV_COLUMNS[key]);
    const chosen = keys.length ? keys : Object.keys(CSV_COLUMNS);
    const rows = await Donation.adminList(siteIdOf(req), filtersOf(req.query), { limit: 50000, offset: 0 });
    const lines = [chosen.map((key) => csvCell(CSV_COLUMNS[key][0])).join(",")];
    for (const row of rows) lines.push(chosen.map((key) => csvCell(CSV_COLUMNS[key][1](row))).join(","));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send("﻿" + lines.join("\r\n"));
  } catch (error) {
    return fail(res, error, "The donations could not be exported.");
  }
}

module.exports = { getConfig, startDonation, confirmDonation, getDonationStatus, stopMonthly, getMine, getSupporters, adminList, adminExport };
