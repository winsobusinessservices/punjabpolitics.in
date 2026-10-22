const interestPush = require("../../services/interestPush.service");

const siteIdOf = (req) => Number(req.site?.id || 1);

const getSettings = async (req, res) => {
  try {
    return res.status(200).json({ success: true, settings: await interestPush.getInterestPushSettings(siteIdOf(req)) });
  } catch (error) {
    console.error("Interest notification settings error:", error);
    return res.status(500).json({ success: false, message: "The notification settings could not be loaded." });
  }
};

// Body: { enabled: true | false } and/or { sendFromHour: 0-23 } (India time; 0 = any time)
const updateSettings = async (req, res) => {
  try {
    const hasEnabled = typeof req.body?.enabled === "boolean";
    const hasHour = req.body?.sendFromHour !== undefined;
    if (!hasEnabled && !hasHour) {
      return res.status(400).json({ success: false, message: "Say whether notifications should be on or off (enabled: true or false), or from which hour they are sent (sendFromHour)." });
    }
    if (hasHour && !(Number.isInteger(req.body.sendFromHour) && req.body.sendFromHour >= 0 && req.body.sendFromHour <= 23)) {
      return res.status(400).json({ success: false, message: "The hour must be a whole number from 0 to 23 (India time). 0 means any time." });
    }
    let settings;
    let message;
    if (hasEnabled) {
      settings = await interestPush.setInterestPushEnabled(siteIdOf(req), req.body.enabled, Number(req.user.userId));
      message = req.body.enabled
        ? "Interest notifications are on. New items from now on will be sent to readers who follow them."
        : "Interest notifications are off. Nothing is sent while it is off, and items added meanwhile are never sent later.";
    }
    if (hasHour) {
      settings = await interestPush.setSendFromHour(siteIdOf(req), req.body.sendFromHour, Number(req.user.userId));
      message = req.body.sendFromHour === 0
        ? "Notifications can be sent at any time of day."
        : `Notifications are sent from ${req.body.sendFromHour % 12 === 0 ? 12 : req.body.sendFromHour % 12}:00 ${req.body.sendFromHour < 12 ? "AM" : "PM"} India time. Anything that appears earlier is held and sent then.`;
    }
    return res.status(200).json({ success: true, message, settings });
  } catch (error) {
    console.error("Interest notification settings error:", error);
    return res.status(500).json({ success: false, message: "The notification settings could not be saved." });
  }
};

module.exports = { getSettings, updateSettings };
