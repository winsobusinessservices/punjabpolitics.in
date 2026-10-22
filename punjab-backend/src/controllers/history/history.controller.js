const User = require("../../models/user.model");
const { getMyHistory } = require("../../services/myHistory.service");

async function myHistory(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, history: await getMyHistory(user) });
  } catch (error) {
    console.error("My history error:", error);
    return res.status(500).json({ success: false, message: "Your activity could not be loaded." });
  }
}

module.exports = { myHistory };
