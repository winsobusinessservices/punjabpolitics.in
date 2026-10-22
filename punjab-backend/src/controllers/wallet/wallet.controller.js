const Wallet = require("../../models/wallet.model");
const User = require("../../models/user.model");
const Article = require("../../models/article.model");
const Blog = require("../../models/blog.model");
const Video = require("../../models/video.model");
const { syncApprovedContentRewards, syncEditorReviewRewards } = require("../../services/walletRewards.service");
const { sendWithdrawalRequestedEmail, sendWithdrawalPaidEmail, sendWithdrawalRejectedEmail } = require("../../services/nodemailer.service");
const { getWithdrawalWindow } = require("../../utils/withdrawalWindow");

const managedSiteId = (req) => Number(
  (req.user?.role === "ADMIN" && (req.get("x-management-site-id") || req.query?.siteId || req.body?.siteId))
  || req.user?.siteId
  || 1
);

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function withWithdrawalEligibility(wallet, settings) {
  const window = getWithdrawalWindow();
  const alreadyRequested = wallet.withdrawals.some(
    (withdrawal) => dateOnly(withdrawal.withdrawalMonth) === window.withdrawalMonth
  );
  const enabled = wallet.withdrawalAccess.enabled;
  const minimumRemainingInr = wallet.pointRate.role === "EDITOR"
    ? settings.editorMinimumRemainingInr
    : settings.authorMinimumRemainingInr;
  const withdrawableValueInr = Math.max(0, Number((wallet.summary.availableValueInr - minimumRemainingInr).toFixed(2)));
  const maximumWithdrawablePoints = Math.max(0, Math.floor(withdrawableValueInr / wallet.pointRate.rupeesPerPoint));
  const meetsMinimumBalance = wallet.summary.availableValueInr >= settings.minimumWithdrawalInr;

  let blockedReason = null;
  if (!enabled) blockedReason = "Withdrawal access is blocked by an administrator.";
  else if (alreadyRequested) blockedReason = "You already submitted this month's withdrawal request.";
  else if (!meetsMinimumBalance) blockedReason = `Wallet balance must be at least ₹${settings.minimumWithdrawalInr.toLocaleString("en-IN")} to withdraw.`;
  else if (maximumWithdrawablePoints < 1) blockedReason = `You must keep at least ₹${minimumRemainingInr.toLocaleString("en-IN")} in your wallet.`;

  return {
    ...wallet,
    withdrawalEligibility: {
      enabled,
      minimumRemainingInr,
      minimumWithdrawalInr: settings.minimumWithdrawalInr,
      withdrawableValueInr,
      maximumWithdrawablePoints,
      nextWithdrawalDate: window.nextWithdrawalDate,
      alreadyRequested,
      canWithdraw: !blockedReason,
      blockedReason,
    },
  };
}

const getWallet = async (req, res) => {
  try {
    await syncApprovedContentRewards(req.user.userId);
    if (req.user.role === "EDITOR") await syncEditorReviewRewards(req.user.userId);
    const settings = await Wallet.getWithdrawalSettings();
    const wallet = withWithdrawalEligibility(await Wallet.getForUser(req.user.userId), settings);
    wallet.rewardPoints = await Wallet.getRewardPoints(req.user.role);
    if (req.user.role === "EDITOR") {
      wallet.editorReviewRewardPoints = await Wallet.getEditorReviewRewardPoints();
    }
    return res.status(200).json({ success: true, wallet });
  } catch (error) {
    console.error("Get wallet error:", error);
    return res.status(500).json({ success: false, message: "Unable to load wallet" });
  }
};

// UPI IDs look like name@bank (letters, digits, dots, hyphens, underscores before the @).
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,100}@[a-zA-Z][a-zA-Z0-9.-]{1,48}$/;

// Email failures must never undo or block a wallet change that already succeeded.
const notify = (label, task) => task().catch((error) => console.error(`${label} email failed:`, error.message));

const requestWithdrawal = async (req, res) => {
  try {
    const points = Number(req.body?.points);
    const upiId = String(req.body?.upiId || "").trim();
    if (!UPI_PATTERN.test(upiId)) {
      return res.status(400).json({ success: false, message: "Enter a valid UPI ID, for example name@okbank" });
    }
    await syncApprovedContentRewards(req.user.userId);
    if (req.user.role === "EDITOR") await syncEditorReviewRewards(req.user.userId);
    const contributor = await User.findById(req.user.userId);
    const withdrawal = await Wallet.requestWithdrawal({ userId: req.user.userId, points, upiId });
    notify("Withdrawal request", () => sendWithdrawalRequestedEmail({
      name: contributor.name,
      email: contributor.email,
      role: contributor.role,
      amountInr: withdrawal.amountInr,
      points: withdrawal.points,
      upiId,
      requestedAt: withdrawal.requestedAt,
    }));
    const settings = await Wallet.getWithdrawalSettings();
    const wallet = withWithdrawalEligibility(await Wallet.getForUser(req.user.userId), settings);
    return res.status(201).json({
      success: true,
      message: "Withdrawal requested. An administrator will pay your UPI ID and you will be emailed the UTR.",
      withdrawal,
      wallet,
    });
  } catch (error) {
    const statusByCode = {
      WITHDRAWAL_ACCESS_BLOCKED: 403,
      INVALID_WITHDRAWAL_POINTS: 400,
      INSUFFICIENT_WALLET_BALANCE: 400,
      MONTHLY_WITHDRAWAL_EXISTS: 409,
    };
    if (statusByCode[error.code]) {
      return res.status(statusByCode[error.code]).json({
        success: false,
        message: error.message,
        nextWithdrawalDate: error.nextWithdrawalDate,
      });
    }
    console.error("Request withdrawal error:", error);
    return res.status(500).json({ success: false, message: "Unable to submit withdrawal request" });
  }
};

const WITHDRAWAL_STATUSES = ["PENDING", "PROCESSING", "PAID", "REJECTED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"];

const listWithdrawalsForAdmin = async (req, res) => {
  try {
    const status = String(req.query.status || "").toUpperCase();
    const withdrawals = await Wallet.listWithdrawalsForAdmin(managedSiteId(req), WITHDRAWAL_STATUSES.includes(status) ? status : null);
    return res.status(200).json({ success: true, withdrawals });
  } catch (error) {
    console.error("List withdrawals error:", error);
    return res.status(500).json({ success: false, message: "Unable to load withdrawal requests" });
  }
};

const settlementErrorStatus = { WITHDRAWAL_NOT_FOUND: 404, WITHDRAWAL_ALREADY_SETTLED: 409 };

// Since authors/editors can be granted this permission, they must never approve their own payout.
async function rejectOwnRequest(req, res) {
  const existing = await Wallet.getWithdrawalById(Number(req.params.withdrawalId));
  if (existing && Number(existing.userId) === Number(req.user.userId)) {
    res.status(403).json({ success: false, message: "You cannot settle your own withdrawal request. Ask another administrator." });
    return true;
  }
  return false;
}

const markWithdrawalPaid = async (req, res) => {
  try {
    if (await rejectOwnRequest(req, res)) return;
    const utrNumber = String(req.body?.utrNumber || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{8,30}$/.test(utrNumber)) {
      return res.status(400).json({ success: false, message: "Enter the UTR / transaction reference (8–30 letters or digits)" });
    }
    const withdrawal = await Wallet.markWithdrawalPaid({
      withdrawalId: Number(req.params.withdrawalId),
      siteId: managedSiteId(req),
      utrNumber,
      reviewedBy: req.user.userId,
    });
    notify("Withdrawal paid", () => sendWithdrawalPaidEmail(withdrawal.userEmail, withdrawal.userName, {
      amountInr: withdrawal.amountInr,
      upiId: withdrawal.upiId || "your UPI ID",
      utrNumber,
    }));
    return res.status(200).json({ success: true, message: "Withdrawal marked as paid and the contributor was emailed", withdrawal });
  } catch (error) {
    if (settlementErrorStatus[error.code]) return res.status(settlementErrorStatus[error.code]).json({ success: false, message: error.message });
    console.error("Mark withdrawal paid error:", error);
    return res.status(500).json({ success: false, message: "Unable to mark the withdrawal as paid" });
  }
};

const rejectWithdrawal = async (req, res) => {
  try {
    if (await rejectOwnRequest(req, res)) return;
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 5 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "Give a reason between 5 and 500 characters" });
    }
    const withdrawal = await Wallet.rejectWithdrawal({
      withdrawalId: Number(req.params.withdrawalId),
      siteId: managedSiteId(req),
      reason,
      reviewedBy: req.user.userId,
    });
    notify("Withdrawal rejected", () => sendWithdrawalRejectedEmail(withdrawal.userEmail, withdrawal.userName, {
      amountInr: withdrawal.amountInr,
      reason,
    }));
    return res.status(200).json({ success: true, message: "Withdrawal rejected, points returned and the contributor was emailed", withdrawal });
  } catch (error) {
    if (settlementErrorStatus[error.code]) return res.status(settlementErrorStatus[error.code]).json({ success: false, message: error.message });
    console.error("Reject withdrawal error:", error);
    return res.status(500).json({ success: false, message: "Unable to reject the withdrawal" });
  }
};

const listWalletsForAdmin = async (req, res) => {
  try {
    return res.status(200).json({ success: true, wallets: await Wallet.listForAdmin(managedSiteId(req)) });
  } catch (error) {
    console.error("List wallets for admin error:", error);
    return res.status(500).json({ success: false, message: "Unable to load contributor wallets" });
  }
};

const updateWithdrawalAccess = async (req, res) => {
  try {
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be true or false" });
    }
    const target = await User.findById(req.params.userId);
    if (!target || Number(target.site_id) !== managedSiteId(req)) return res.status(404).json({ success: false, message: "Author or editor not found for this website" });
    const access = await Wallet.setWithdrawalAccess({
      userId: req.params.userId,
      enabled: req.body.enabled,
      updatedBy: req.user.userId,
    });
    if (!access) {
      return res.status(404).json({ success: false, message: "Author or editor not found" });
    }
    return res.status(200).json({
      success: true,
      message: `Withdrawal access ${access.enabled ? "enabled" : "blocked"}`,
      access,
    });
  } catch (error) {
    console.error("Update withdrawal access error:", error);
    return res.status(500).json({ success: false, message: "Unable to update withdrawal access" });
  }
};

const getWithdrawalSettings = async (req, res) => {
  try {
    return res.status(200).json({ success: true, ...(await Wallet.getWithdrawalSettings()) });
  } catch (error) {
    console.error("Get withdrawal settings error:", error);
    return res.status(500).json({ success: false, message: "Unable to load withdrawal settings" });
  }
};

const updateWithdrawalSettings = async (req, res) => {
  try {
    const authorMinimumRemainingInr = Number(req.body?.authorMinimumRemainingInr);
    const editorMinimumRemainingInr = Number(req.body?.editorMinimumRemainingInr);
    const minimumWithdrawalInr = Number(req.body?.minimumWithdrawalInr);
    const validAmount = (value) => Number.isFinite(value) && value >= 0 && value <= 100000000
      && Math.round(value * 100) === value * 100;
    if (![minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr].every(validAmount)) {
      return res.status(400).json({
        success: false,
        message: "All withdrawal balances must be valid INR amounts with no more than 2 decimal places",
      });
    }
    const settings = await Wallet.setWithdrawalSettings({
      authorMinimumRemainingInr,
      editorMinimumRemainingInr,
      minimumWithdrawalInr,
      updatedBy: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Minimum remaining wallet balances updated",
      ...settings,
    });
  } catch (error) {
    console.error("Update withdrawal settings error:", error);
    return res.status(500).json({ success: false, message: "Unable to update withdrawal settings" });
  }
};

const getPointRates = async (req, res) => {
  try {
    const [rates, rewardPoints, editorReviewRewardPoints] = await Promise.all([
      Wallet.getPointRates(),
      Wallet.getRewardPoints(),
      Wallet.getEditorReviewRewardPoints(),
    ]);
    return res.status(200).json({ success: true, rates, rewardPoints, editorReviewRewardPoints });
  } catch (error) {
    console.error("Get point rates error:", error);
    return res.status(500).json({ success: false, message: "Unable to load point rates" });
  }
};

function validPointRate(value) {
  return Number.isFinite(value) && value > 0 && value <= 100000 && Math.round(value * 10000) === value * 10000;
}

function validRewardPoints(value) {
  return Number.isInteger(value) && value > 0 && value <= 1000000;
}

const updatePointRates = async (req, res) => {
  try {
    const authorRate = Number(req.body?.authorRate);
    const editorRate = Number(req.body?.editorRate);
    const requestedRewardPoints = {
      AUTHOR: {
        ARTICLE: Number(req.body?.authorArticlePoints),
        BLOG: Number(req.body?.authorBlogPoints),
        VIDEO: Number(req.body?.authorVideoPoints),
      },
      EDITOR: {
        ARTICLE: Number(req.body?.editorArticlePoints),
        BLOG: Number(req.body?.editorBlogPoints),
        VIDEO: Number(req.body?.editorVideoPoints),
      },
    };
    const requestedEditorReviewRewardPoints = {
      ARTICLE: Number(req.body?.editorReviewArticlePoints),
      BLOG: Number(req.body?.editorReviewBlogPoints),
      VIDEO: Number(req.body?.editorReviewVideoPoints),
    };
    if (!validPointRate(authorRate) || !validPointRate(editorRate)) {
      return res.status(400).json({
        success: false,
        message: "Author and Editor rates must be positive numbers with no more than 4 decimal places",
      });
    }
    if (!Object.values(requestedRewardPoints).flatMap(Object.values).every(validRewardPoints)) {
      return res.status(400).json({
        success: false,
        message: "All Author and Editor content rewards must be positive whole numbers",
      });
    }
    if (!Object.values(requestedEditorReviewRewardPoints).every(validRewardPoints)) {
      return res.status(400).json({
        success: false,
        message: "All Editor approval rewards must be positive whole numbers",
      });
    }
    const [rates, rewardPoints, editorReviewRewardPoints] = await Promise.all([
      Wallet.setPointRates({ authorRate, editorRate, updatedBy: req.user.userId }),
      Wallet.setRewardPoints({ rewardPoints: requestedRewardPoints, updatedBy: req.user.userId }),
      Wallet.setEditorReviewRewardPoints({ rewardPoints: requestedEditorReviewRewardPoints, updatedBy: req.user.userId }),
    ]);
    return res.status(200).json({
      success: true,
      message: "Point values, content rewards, and Editor approval rewards updated",
      rates,
      rewardPoints,
      editorReviewRewardPoints,
    });
  } catch (error) {
    console.error("Update point rates error:", error);
    return res.status(500).json({ success: false, message: "Unable to update point rates" });
  }
};

const awardContentBonus = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const contentId = Number(req.body?.contentId);
    const contentType = String(req.body?.contentType || "").toUpperCase();
    const points = Number(req.body?.points);
    const reason = String(req.body?.reason || "").trim();
    const Model = { ARTICLE: Article, BLOG: Blog, VIDEO: Video }[contentType];

    if (!Number.isInteger(userId) || userId <= 0 || !Model || !Number.isInteger(contentId) || contentId <= 0) {
      return res.status(400).json({ success: false, message: "Select a valid recipient and content item" });
    }
    if (!Number.isInteger(points) || points < 1 || points > 1000000) {
      return res.status(400).json({ success: false, message: "Bonus points must be a whole number between 1 and 1,000,000" });
    }
    if (reason.length < 5 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "Bonus reason must contain between 5 and 500 characters" });
    }

    const siteId = managedSiteId(req);
    const [recipient, content] = await Promise.all([User.findById(userId), Model.findById(contentId)]);
    if (!recipient || Number(recipient.site_id) !== siteId || !["AUTHOR", "EDITOR"].includes(recipient.role)) {
      return res.status(404).json({ success: false, message: "Author or Editor not found" });
    }
    if (!content || Number(content.site_id) !== siteId || content.status !== "APPROVED") {
      return res.status(404).json({ success: false, message: "Approved content not found" });
    }

    const isCreator = Number(content.author_id) === userId;
    const isReviewer = recipient.role === "EDITOR" && Number(content.reviewer_id) === userId;
    if (!isCreator && !isReviewer) {
      return res.status(400).json({ success: false, message: "The selected content is not associated with this contributor" });
    }

    const bonus = await Wallet.awardBonus({
      userId,
      points,
      reason,
      contentType,
      contentId,
      contentTitle: content.title,
      contentSlug: content.slug || null,
      relationship: isCreator ? "CREATOR" : "REVIEWER",
      awardedBy: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: `${points.toLocaleString("en-IN")} bonus points awarded to ${recipient.name}`,
      bonus: {
        ...bonus,
        userId,
        userName: recipient.name,
        points,
        reason,
        contentType,
        contentId,
        contentTitle: content.title,
      },
    });
  } catch (error) {
    console.error("Award content bonus error:", error);
    return res.status(500).json({ success: false, message: "Bonus points could not be awarded" });
  }
};

const acknowledgeBonus = async (req, res) => {
  try {
    const bonusId = Number(req.params.bonusId);
    if (!Number.isInteger(bonusId) || bonusId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid bonus award" });
    }
    const acknowledged = await Wallet.acknowledgeBonus({ bonusId, userId: req.user.userId });
    if (!acknowledged) return res.status(404).json({ success: false, message: "Bonus award not found" });
    return res.status(200).json({ success: true, message: "Bonus notification acknowledged", acknowledgedAt: new Date() });
  } catch (error) {
    console.error("Acknowledge bonus error:", error);
    return res.status(500).json({ success: false, message: "Bonus notification could not be acknowledged" });
  }
};

module.exports = {
  getWallet,
  requestWithdrawal,
  listWithdrawalsForAdmin,
  markWithdrawalPaid,
  rejectWithdrawal,
  listWalletsForAdmin,
  updateWithdrawalAccess,
  getWithdrawalSettings,
  updateWithdrawalSettings,
  getPointRates,
  updatePointRates,
  awardContentBonus,
  acknowledgeBonus,
};
