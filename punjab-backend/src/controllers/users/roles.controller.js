const pool = require("../../config/db");
const RoleApplication = require("../../models/roleApplication.model");
const DeletionAudit = require("../../models/deletionAudit.model");

const ALLOWED_ROLES = ["AUTHOR", "EDITOR"];
const REVIEWER_ROLES = ["ADMIN"];

const isReviewer = (role) =>
  REVIEWER_ROLES.includes(role);


// =====================================================
// CREATE ROLE APPLICATION
// POST /roles/apply
// =====================================================

const createRoleApplication = async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentRole = req.user.role;

    const {
      role,
      name,
      email,
      phone,
      panNumber,
      aadhaarNumber,
      graduation,
      skills,
    } = req.body;

    // -----------------------------------------
    // Required fields
    // -----------------------------------------

    if (
      !role ||
      !name ||
      !email ||
      !phone ||
      !panNumber ||
      !aadhaarNumber ||
      !graduation ||
      !skills
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // -----------------------------------------
    // Validate requested role
    // -----------------------------------------

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be AUTHOR or EDITOR",
      });
    }

    // -----------------------------------------
    // Prevent applying for current role
    // -----------------------------------------

    if (currentRole === role) {
      return res.status(400).json({
        success: false,
        message: `You are already an ${role}`,
      });
    }

    // -----------------------------------------
    // Resume
    // -----------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume is required",
      });
    }

    // -----------------------------------------
    // Check existing applications
    // -----------------------------------------

    const applications =
      await RoleApplication.findByUserId(userId);

    const pendingApplication =
      applications.find(
        (application) =>
          application.role === role &&
          application.status === "PENDING"
      );

    if (pendingApplication) {
      return res.status(400).json({
        success: false,
        message:
          `You already have a pending ${role} application`,
      });
    }

    // -----------------------------------------
    // Resume path
    // -----------------------------------------

    const resume =
      `/uploads/resumes/${req.file.filename}`;

    // -----------------------------------------
    // Create application
    // -----------------------------------------

    const application =
      await RoleApplication.create({
        userId,
        currentRole,
        role,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        aadhaarNumber: aadhaarNumber.trim(),
        graduation: graduation.trim(),
        skills: skills.trim(),
        resume,
      });

    return res.status(201).json({
      success: true,
      message: "Role application submitted successfully",
      application,
    });

  } catch (error) {
    console.error(
      "Create role application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// GET MY APPLICATIONS
// GET /roles/my
// =====================================================

const getMyApplications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const applications =
      await RoleApplication.findByUserId(userId);

    return res.status(200).json({
      success: true,
      applications,
    });

  } catch (error) {
    console.error(
      "Get my applications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// GET APPLICATION BY ID
// GET /roles/:id
// =====================================================

const getApplicationById = async (req, res) => {
  try {
    const application =
      await RoleApplication.findById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Role application not found",
      });
    }

    const isOwner =
      application.user_id === req.user.userId;

    const reviewer =
      isReviewer(req.user.role);

    if (!isOwner && !reviewer) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.status(200).json({
      success: true,
      application,
    });

  } catch (error) {
    console.error(
      "Get application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// LIST ALL APPLICATIONS
// ADMIN
//
// GET /roles/admin/list
//
// Optional:
// ?role=AUTHOR
// ?role=EDITOR
// ?status=PENDING
// =====================================================

const listApplications = async (req, res) => {
  try {

    if (!isReviewer(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access applications",
      });
    }

    const { role, status } = req.query;

    // -----------------------------------------
    // Validate role filter
    // -----------------------------------------

    if (
      role &&
      !ALLOWED_ROLES.includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter",
      });
    }

    // -----------------------------------------
    // Validate status filter
    // -----------------------------------------

    const ALLOWED_STATUSES = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      status &&
      !ALLOWED_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter",
      });
    }

    const applications =
      await RoleApplication.findAll({
        role,
        status,
      });

    return res.status(200).json({
      success: true,
      applications,
    });

  } catch (error) {
    console.error(
      "List applications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// UPDATE REJECTED APPLICATION
// PUT /roles/:id
// =====================================================

const updateRoleApplication = async (req, res) => {
  try {

    const userId = req.user.userId;

    const application =
      await RoleApplication.findById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Role application not found",
      });
    }

    // -----------------------------------------
    // Owner check
    // -----------------------------------------

    if (
      application.user_id !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit this application",
      });
    }

    // -----------------------------------------
    // Only rejected applications
    // -----------------------------------------

    if (
      application.status !== "REJECTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only rejected applications can be edited",
      });
    }

    const {
      role,
      name,
      email,
      phone,
      panNumber,
      aadhaarNumber,
      graduation,
      skills,
    } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be AUTHOR or EDITOR",
      });
    }

    // -----------------------------------------
    // Resume
    // -----------------------------------------

    let resume = application.resume;

    if (req.file) {
      resume =
        `/uploads/resumes/${req.file.filename}`;
    }

    // -----------------------------------------
    // Update
    // -----------------------------------------

    const updated =
      await RoleApplication.update(
        application.id,
        {
          currentRole: req.user.role,
          role,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          panNumber: panNumber.trim().toUpperCase(),
          aadhaarNumber: aadhaarNumber.trim(),
          graduation: graduation.trim(),
          skills: skills.trim(),
          resume,
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Application updated and resubmitted",
      application: updated,
    });

  } catch (error) {
    console.error(
      "Update role application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// APPROVE APPLICATION
// ADMIN
//
// POST /roles/admin/:id/approve
// =====================================================

const approveApplication = async (req, res) => {
  try {

    if (!isReviewer(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve applications",
      });
    }

    const application =
      await RoleApplication.findById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Role application not found",
      });
    }

    // -----------------------------------------
    // Only pending
    // -----------------------------------------

    if (
      application.status !== "PENDING"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only pending applications can be approved",
      });
    }

    const { notes } = req.body;

    // -----------------------------------------
    // Approve application
    // -----------------------------------------

    const updated =
      await RoleApplication.approve(
        application.id,
        req.user.userId,
        notes || null
      );

    // -----------------------------------------
    // Update user's actual role
    // -----------------------------------------

    await pool.query(
      `UPDATE users
       SET role = ?
       WHERE id = ?`,
      [
        application.role,
        application.user_id,
      ]
    );

    return res.status(200).json({
      success: true,
      message:
        `${application.role} application approved`,
      application: updated,
    });

  } catch (error) {
    console.error(
      "Approve application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// REJECT APPLICATION
// ADMIN
//
// POST /roles/admin/:id/reject
// =====================================================

const rejectApplication = async (req, res) => {
  try {

    if (!isReviewer(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can reject applications",
      });
    }

    const application =
      await RoleApplication.findById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Role application not found",
      });
    }

    if (
      application.status !== "PENDING"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only pending applications can be rejected",
      });
    }

    const { notes } = req.body;

    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required",
      });
    }

    const updated =
      await RoleApplication.reject(
        application.id,
        req.user.userId,
        notes.trim()
      );

    return res.status(200).json({
      success: true,
      message: "Application rejected",
      application: updated,
    });

  } catch (error) {
    console.error(
      "Reject application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// =====================================================
// DELETE APPLICATION
// =====================================================

const deleteRoleApplication = async (req, res) => {
  try {

    const application =
      await RoleApplication.findById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (
      application.user_id !==
      req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await DeletionAudit.softDelete({
      entityType: "ROLE_APPLICATION",
      entityId: application.id,
      deletedBy: req.user.userId,
      reason: req.body?.reason,
    });

    return res.status(200).json({
      success: true,
      message: "Application moved to deleted items",
    });

  } catch (error) {
    console.error(
      "Delete application error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  createRoleApplication,
  getMyApplications,
  getApplicationById,
  listApplications,
  updateRoleApplication,
  approveApplication,
  rejectApplication,
  deleteRoleApplication,
};
