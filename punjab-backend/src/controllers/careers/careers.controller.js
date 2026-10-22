// Job postings the site is hiring for, and applications against them.
//   - Admins create/manage postings.
//   - Any logged-in member (USER/EDITOR/AUTHOR/ADMIN) can browse and apply.
//   - Admins review applications.
const CareerJob = require("../../models/careerJob.model");
const CareerApplication = require("../../models/careerApplication.model");
const { careerDocumentUrl } = require("../../middleware/upload.middleware");
const { sendApplicationShortlistedEmail } = require("../../services/nodemailer.service");
const User = require("../../models/user.model");
const DeletionAudit = require("../../models/deletionAudit.model");
const { sanitizeRichText, richTextToPlainText } = require("../../utils/richText");

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];

const siteIdFor = (req) => Number(
  (req.user?.role === "ADMIN" && (req.get("X-Management-Site-Id") || req.query.siteId || req.body?.siteId))
  || req.user?.siteId
  || req.site?.id
  || 1
);

const createJob = async (req, res) => {
  try {
    const { title, department, location, employmentType, description, requirements, responsibilities, closesAt } = req.body;

    if (!title || !richTextToPlainText(description)) {
      return res.status(400).json({ success: false, message: "Title and description are required" });
    }
    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({ success: false, message: `employmentType must be one of: ${EMPLOYMENT_TYPES.join(", ")}` });
    }

    const job = await CareerJob.create({
      siteId: siteIdFor(req),
      title: title.trim(),
      department: department?.trim(),
      location: location?.trim(),
      employmentType: employmentType || "FULL_TIME",
      description: sanitizeRichText(description),
      requirements: requirements ? sanitizeRichText(requirements) : null,
      responsibilities: responsibilities ? sanitizeRichText(responsibilities) : null,
      postedBy: req.user.userId,
      closesAt: closesAt || null,
    });

    return res.status(201).json({ success: true, message: "Job posting created", job });
  } catch (error) {
    console.error("Create career job error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Public — no auth, always OPEN-only (what members should browse/apply to).
const listJobs = async (req, res) => {
  try {
    const jobs = await CareerJob.findAll({ status: "OPEN", siteId: siteIdFor(req) });
    return res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("List career jobs error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin-only — every posting regardless of status, for the management page.
const listAllJobsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const jobs = await CareerJob.findAll({ status: status || undefined, siteId: siteIdFor(req) });
    return res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("List all career jobs error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getJobBySlug = async (req, res) => {
  try {
    const job = await CareerJob.findBySlug(req.params.slug, siteIdFor(req));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    return res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("Get career job error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateJob = async (req, res) => {
  try {
    const { title, department, location, employmentType, description, requirements, responsibilities, closesAt } = req.body;

    if (!title || !richTextToPlainText(description)) {
      return res.status(400).json({ success: false, message: "Title and description are required" });
    }
    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({ success: false, message: `employmentType must be one of: ${EMPLOYMENT_TYPES.join(", ")}` });
    }

    const siteId = siteIdFor(req);
    const job = await CareerJob.findById(req.params.id, siteId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }

    const updated = await CareerJob.update(req.params.id, siteId, {
      title: title.trim(),
      department: department?.trim(),
      location: location?.trim(),
      employmentType: employmentType || job.employment_type,
      description: sanitizeRichText(description),
      requirements: requirements ? sanitizeRichText(requirements) : null,
      responsibilities: responsibilities ? sanitizeRichText(responsibilities) : null,
      closesAt: closesAt || null,
    });

    return res.status(200).json({ success: true, message: "Job posting updated", job: updated });
  } catch (error) {
    console.error("Update career job error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const setJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["OPEN", "CLOSED"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be OPEN or CLOSED" });
    }
    const siteId = siteIdFor(req);
    const job = await CareerJob.findById(req.params.id, siteId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    const updated = await CareerJob.setStatus(req.params.id, status, siteId);
    return res.status(200).json({ success: true, job: updated });
  } catch (error) {
    console.error("Set career job status error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteJob = async (req, res) => {
  try {
    const job = await CareerJob.findById(req.params.id, siteIdFor(req));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    await DeletionAudit.softDelete({ entityType: "CAREER_JOB", entityId: req.params.id, deletedBy: req.user.userId, reason: req.body?.reason });
    return res.status(200).json({ success: true, message: "Job posting moved to deleted items" });
  } catch (error) {
    console.error("Delete career job error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Authenticated — any logged-in role. Always uses the session's own
// identity for applicant_id, regardless of what the form sends.
const applyToJob = async (req, res) => {
  try {
    const job = await CareerJob.findById(req.params.id, siteIdFor(req));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    if (job.status !== "OPEN") {
      return res.status(400).json({ success: false, message: "This position is no longer accepting applications" });
    }

    const existing = await CareerApplication.findByApplicant(job.id, req.user.userId);
    if (existing) {
      return res.status(409).json({ success: false, message: "You've already applied to this position" });
    }



    const { name, email, phone, pan, aadhaar, coverLetter } = req.body;
    
    const existingUser = await User.findByEmail(email);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please register before applying for a job",
      });
    }


    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required" });
    }
    if (!pan || !aadhaar) {
      return res.status(400).json({ success: false, message: "PAN and Aadhaar numbers are required" });
    }
    const resumeFile = req.files?.resume?.[0];
    if (!resumeFile) {
      return res.status(400).json({ success: false, message: "A resume is required" });
    }
    const graduationCertificateFile = req.files?.graduationCertificate?.[0];
    if (!graduationCertificateFile) {
      return res.status(400).json({ success: false, message: "A graduation certificate is required" });
    }

    const application = await CareerApplication.create({
      careerId: job.id,
      applicantId: req.user.userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim(),
      pan: pan.trim().toUpperCase(),
      aadhaar: aadhaar.trim(),
      resume: careerDocumentUrl(resumeFile),
      graduationCertificate: careerDocumentUrl(graduationCertificateFile),
      coverLetter: coverLetter?.trim(),
    });

    return res.status(201).json({ success: true, message: "Application submitted", application });
  } catch (error) {
    console.error("Apply to career job error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Authenticated — lets a member check whether they've already applied to
// this posting and see the details of their own submission.
const getMyApplication = async (req, res) => {
  try {
    const job = await CareerJob.findById(req.params.id, siteIdFor(req));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    const application = await CareerApplication.findByApplicant(job.id, req.user.userId);
    return res.status(200).json({ success: true, application: application || null });
  } catch (error) {
    console.error("Get my career application error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin-only — every applicant for one posting.
const listApplicationsForJob = async (req, res) => {
  try {
    const job = await CareerJob.findById(req.params.id, siteIdFor(req));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job posting not found" });
    }
    const applications = await CareerApplication.findAllForJob(req.params.id);
    return res.status(200).json({ success: true, job, applications });
  } catch (error) {
    console.error("List career applications error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const reviewApplication = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!["REVIEWED", "ACCEPTED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be REVIEWED, ACCEPTED, or REJECTED" });
    }
    const application = await CareerApplication.findById(req.params.appId);
    if (!application || application.career_id !== Number(req.params.id)) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }
    const updated = await CareerApplication.review(application.id, {
      reviewedBy: req.user.userId,
      status,
      reviewNotes: notes,
    });

    // Best-effort notification — a mail-server hiccup shouldn't turn a
    // successful review action into a 500, so this is never awaited inline
    // with the response.
    if (status === "ACCEPTED") {
      const job = await CareerJob.findById(updated.career_id, siteIdFor(req));
      sendApplicationShortlistedEmail(updated.email, updated.name, job?.title || "the position").catch((error) => {
        console.error("Send shortlisted email error:", error);
      });
    }

    return res.status(200).json({ success: true, application: updated });
  } catch (error) {
    console.error("Review career application error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createJob,
  listJobs,
  listAllJobsForAdmin,
  getJobBySlug,
  updateJob,
  setJobStatus,
  deleteJob,
  applyToJob,
  getMyApplication,
  listApplicationsForJob,
  reviewApplication,
};
