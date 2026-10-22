// Signed-in members can apply for an Author, Editor, or Investor role. A
// submission only creates a PENDING role_applications row; approval upgrades
// the member's current account, or creates a separate account when requested.
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RoleApplication = require("../../models/roleApplication.model");
const User = require("../../models/user.model");
const { userDocumentUrl } = require("../../middleware/upload.middleware");
const { sendInvestorApprovedEmail, sendPasswordResetEmail, sendRoleChangedEmail } = require("../../services/nodemailer.service");

const APPLICATION_ROLES = ["AUTHOR", "EDITOR", "INVESTOR"];

// Same rule as auth.controller.js's admin-create flow: Author needs PAN +
// Aadhar, Editor additionally needs a graduation certificate, Investor
// needs neither. Resume is required for every role — this is an
// application, after all.
const REQUIRED_DOCS_BY_ROLE = {
  AUTHOR: ["panDocument", "aadharDocument"],
  EDITOR: ["panDocument", "aadharDocument", "graduationCertificate"],
  INVESTOR: [],
};
const DOC_LABEL = {
  panDocument: "PAN document",
  aadharDocument: "Aadhar document",
  graduationCertificate: "Graduation certificate",
};

const submitApplication = async (req, res) => {
  try {
    const { phone, role, message, alternateEmail, panNumber, aadharNumber, location } = req.body || {};
    const applicant = await User.findById(req.user.userId);

    if (!applicant || !role) {
      return res.status(400).json({
        success: false,
        message: "A signed-in account and requested role are required",
      });
    }

    if (!APPLICATION_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${APPLICATION_ROLES.join(", ")}`,
      });
    }

    const normalizedPan = String(panNumber || "").trim().toUpperCase();
    const normalizedAadhar = String(aadharNumber || "").replace(/\s+/g, "");
    const normalizedLocation = String(location || "").trim().slice(0, 255);
    if (role === "INVESTOR" && !normalizedLocation) {
      return res.status(400).json({ success: false, message: "Please enter your location" });
    }
    if (role === "INVESTOR" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) {
      return res.status(400).json({ success: false, message: "Please enter a valid PAN number" });
    }
    if (role === "INVESTOR" && !/^[0-9]{12}$/.test(normalizedAadhar)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 12-digit Aadhaar number" });
    }

    const validEmailRegex = /^[a-zA-Z0-9](?!.*\.\.)[a-zA-Z0-9._%+-]*[a-zA-Z0-9]@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
    const requestedAlternateEmail = String(alternateEmail || "").trim().toLowerCase();
    const normalizedEmail = requestedAlternateEmail || applicant.email;
    if (!validEmailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    const usesDifferentAccount = normalizedEmail !== applicant.email;
    if (!usesDifferentAccount && applicant.role === role) {
      return res.status(409).json({
        success: false,
        message: `Your current account already has the ${role} role`,
      });
    }
    const existingUser = usesDifferentAccount ? await User.findByEmail(normalizedEmail) : null;
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "The alternate email already belongs to an account. Use that account to apply instead.",
      });
    }

    // A rejected applicant may apply again; an approved one may not.
    if (await RoleApplication.findApprovedByUserId(applicant.id, role)) {
      return res.status(409).json({
        success: false,
        message: `Your ${role.toLowerCase()} application has already been approved, so another application is not needed`,
      });
    }

    const existingApplication = await RoleApplication.findPendingByUserId(applicant.id)
      || await RoleApplication.findPendingByEmail(normalizedEmail);
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending application on file",
      });
    }

    const files = {
      resume: req.files?.resume?.[0],
      panDocument: req.files?.panDocument?.[0],
      aadharDocument: req.files?.aadharDocument?.[0],
      graduationCertificate: req.files?.graduationCertificate?.[0],
    };

    if (!files.resume) {
      return res.status(400).json({ success: false, message: "A resume is required" });
    }

    const missingDocs = REQUIRED_DOCS_BY_ROLE[role].filter((field) => !files[field]);
    if (missingDocs.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required document(s) for ${role}: ${missingDocs.map((f) => DOC_LABEL[f]).join(", ")}`,
      });
    }

    const application = await RoleApplication.create({
      applicantUserId: applicant.id,
      name: applicant.name,
      email: normalizedEmail,
      phone: phone?.trim(),
      location: normalizedLocation || null,
      panNumber: normalizedPan || null,
      aadharNumber: normalizedAadhar || null,
      role,
      passwordHash: null,
      resume: userDocumentUrl(files.resume),
      panDocument: files.panDocument ? userDocumentUrl(files.panDocument) : null,
      aadharDocument: files.aadharDocument ? userDocumentUrl(files.aadharDocument) : null,
      graduationCertificate: files.graduationCertificate ? userDocumentUrl(files.graduationCertificate) : null,
      message: message?.trim(),
    });

    return res.status(201).json({
      success: true,
      message: usesDifferentAccount
        ? "Application submitted. If approved, the alternate email will receive a password-setup link."
        : "Application submitted. If approved, your current account will be upgraded.",
      application,
    });
  } catch (error) {
    console.error("Submit application error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// =========================
// LIST APPLICATIONS (ADMIN ONLY)
// =========================

const listApplications = async (req, res) => {
  try {
    const { status, role } = req.query;
    const applications = await RoleApplication.findAll({ status, role });
    return res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error("List applications error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// =========================
// REVIEW APPLICATION (ADMIN ONLY)
// =========================
// APPROVE creates the real `users` row (reusing the password the applicant
// already chose, so they can log in immediately) and marks the application
// APPROVED. REJECT just records the decision — no account is created.

const reviewApplication = async (req, res) => {
  try {
    const { action, notes } = req.body;
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be APPROVE or REJECT" });
    }

    const application = await RoleApplication.findByIdWithPassword(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }
    if (application.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `This application was already ${application.status.toLowerCase()}` });
    }

    if (action === "APPROVE") {
      const applicant = application.applicant_user_id
        ? await User.findById(application.applicant_user_id)
        : null;

      if (applicant && applicant.email === application.email) {
        const previousRole = applicant.role;
        const updatedUser = await User.updateRole(applicant.id, application.role);
        if (previousRole !== application.role) {
          const notification = application.role === "INVESTOR"
            ? sendInvestorApprovedEmail(updatedUser.email, updatedUser.name)
            : sendRoleChangedEmail(updatedUser.email, updatedUser.name, previousRole, application.role);
          void notification
            .catch((error) => console.error("Role application email error:", error));
        }
      } else {
        const existingUser = await User.findByEmail(application.email);
        if (existingUser) {
          return res.status(409).json({ success: false, message: "An account with this email already exists" });
        }

        const passwordHash = application.password_hash
          || await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
        const createdUser = await User.create({
          name: application.name,
          email: application.email,
          passwordHash,
          role: application.role,
          termsAccepted: true,
          panDocument: application.pan_document,
          aadharDocument: application.aadhar_document,
          graduationCertificate: application.graduation_certificate,
          createdBy: req.user.userId,
          siteId: applicant?.site_id || 1,
        });

        if (!application.password_hash) {
          const resetToken = jwt.sign(
            { userId: createdUser.id, purpose: "reset" },
            process.env.JWT_SECRET,
            { expiresIn: "15m" },
          );
          const staffRoles = new Set(["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN"]);
          const origin = staffRoles.has(createdUser.role)
            ? String(process.env.PANEL_ORIGIN || "https://panel.punjabpolitics.com").split(",")[0].trim().replace(/\/$/, "")
            : String(process.env.CLIENT_ORIGIN || "https://punjabpolitics.com").split(",")[0].trim().replace(/\/$/, "");
          const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
          void sendPasswordResetEmail(createdUser.email, resetUrl)
            .catch((error) => console.error("New role account password email error:", error));
        }
        if (application.role === "INVESTOR") {
          void sendInvestorApprovedEmail(createdUser.email, createdUser.name, { separateAccount: true })
            .catch((error) => console.error("Investor approval email error:", error));
        }
      }
    }

    const updated = await RoleApplication.review(application.id, {
      reviewedBy: req.user.userId,
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewNotes: notes,
    });

    return res.status(200).json({
      success: true,
      message: action === "APPROVE" ? "Application approved and account updated" : "Application rejected",
      application: updated,
    });
  } catch (error) {
    console.error("Review application error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Lets a signed-in member see where their latest application for a role stands,
// so the website can show "under review" / "approved" instead of the form.
const getMyApplicationStatus = async (req, res) => {
  try {
    const role = String(req.query.role || "").trim().toUpperCase();
    if (!APPLICATION_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${APPLICATION_ROLES.join(", ")}` });
    }
    const latest = await RoleApplication.findLatestByUserId(req.user.userId, role);
    const approved = latest?.status === "APPROVED" ? latest : await RoleApplication.findApprovedByUserId(req.user.userId, role);
    const application = approved || latest;
    return res.json({
      success: true,
      application: application ? { id: application.id, role, status: application.status, createdAt: application.created_at, reviewedAt: application.reviewed_at } : null,
      canApply: !application || application.status === "REJECTED",
    });
  } catch (error) {
    console.error("Get my application status error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { submitApplication, listApplications, reviewApplication, getMyApplicationStatus };
