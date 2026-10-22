// "My profile" for any signed-in account: name, mobile number and profile picture.
const User = require("../../models/user.model");
const { fileUrl } = require("../../middleware/upload.middleware");

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

// Contact number only (not verified). 10 digits are treated as Indian numbers; otherwise a
// +country-code number is expected. An empty value clears the number.
function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits) && !raw.startsWith("+")) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits) && !raw.startsWith("+")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

// Loaded lazily: auth.controller is a large module that also loads this one's routes.
const publicUser = (user) => require("../auth/auth.controller").authUserResponse(user);

const updateMyProfile = async (req, res) => {
  try {
    const changes = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ success: false, message: "Name cannot be empty" });
      if (name.length > 120) return res.status(400).json({ success: false, message: "Name must be 120 characters or fewer" });
      changes.name = name;
    }
    if (req.body?.phone !== undefined) {
      const phone = normalizePhone(req.body.phone);
      if (phone === null) return res.status(400).json({ success: false, message: "Enter a valid mobile number" });
      changes.phone = phone || null;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ success: false, message: "Nothing to update" });
    const user = await User.updateProfile(req.user.userId, changes);
    return res.status(200).json({ success: true, message: "Profile updated", user: publicUser(user) });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ success: false, message: "Profile could not be updated" });
  }
};

const updateProfilePicture = async (req, res) => {
  try {
    const file = req.files?.profilePicture?.[0];
    if (!file) return res.status(400).json({ success: false, message: "Choose an image to upload" });
    if (file.size > MAX_PICTURE_BYTES) {
      return res.status(400).json({ success: false, message: "Choose an image smaller than 5 MB" });
    }
    const user = await User.setProfilePicture(req.user.userId, fileUrl("profiles", file));
    return res.status(200).json({ success: true, message: "Profile picture updated", user: publicUser(user) });
  } catch (error) {
    console.error("Update profile picture error:", error);
    return res.status(500).json({ success: false, message: "Profile picture could not be updated" });
  }
};

module.exports = { updateMyProfile, updateProfilePicture, normalizePhone };
