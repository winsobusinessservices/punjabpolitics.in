// Disk storage for author-uploaded media (featured images, thumbnails,
// uploaded video files). Files land in uploads/<type>/ and server.js serves
// that whole tree statically at /uploads, so a stored path like
// "/uploads/articles/169...-8.jpg" is directly usable as an <img>/<video> src.
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
const VIDEO_TYPES = /^video\/(mp4|webm|ogg|quicktime)$/;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_ROOT, req.contentType.toLowerCase());
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(req, file, cb) {
  const expectsVideo = file.fieldname === "videoFile";
  const isValid = expectsVideo ? VIDEO_TYPES.test(file.mimetype) : IMAGE_TYPES.test(file.mimetype);
  if (!isValid) {
    return cb(new Error(`Unsupported file type for ${file.fieldname}: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 200 * 1024 * 1024 } });

async function optimizeUploadedImages(req, res, next) {
  const files = Object.values(req.files || {}).flat();

  try {
    await Promise.all(
      files
        .filter((file) => IMAGE_TYPES.test(file.mimetype))
        .map(async (file) => {
          const parsed = path.parse(file.path);
          // Always use a distinct destination. When the incoming image was
          // already WebP, the old final path was identical to file.path;
          // replacing that path after sharp processed it intermittently
          // failed on Windows and turned an otherwise valid POST into a 500.
          const finalPath = path.join(parsed.dir, `${parsed.name}-optimized.webp`);
          const inputBuffer = await fs.promises.readFile(file.path);

          // Passing a buffer prevents libvips/Sharp from retaining a Windows
          // file handle for the source path after optimization completes.
          await sharp(inputBuffer, { animated: true })
            .rotate()
            .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80, effort: 4 })
            .toFile(finalPath);

          // The optimized asset is already complete. Failure to remove the
          // source file should not discard the user's post; log it for later
          // cleanup and continue with the optimized path.
          await fs.promises.unlink(file.path).catch((error) => {
            if (error.code !== "ENOENT") {
              console.warn(`Could not remove source upload ${file.path}:`, error.message);
            }
          });

          file.path = finalPath;
          file.filename = path.basename(finalPath);
          file.mimetype = "image/webp";
          file.size = (await fs.promises.stat(finalPath)).size;
        })
    );
    next();
  } catch (error) {
    next(error);
  }
}

// Multer writes the files first, then images are capped to a sensible display
// size and encoded as WebP before a controller stores their URLs.
const uploadFields = (fields) => [upload.fields(fields), optimizeUploadedImages];

// Banner image and/or logo for an ad, stored under uploads/ads/.
const uploadAdImage = [
  (req, res, next) => { req.contentType = "ADS"; next(); },
  ...uploadFields([{ name: "image", maxCount: 1 }, { name: "logo", maxCount: 1 }]),
];

// Stand-alone image upload for admin forms (people, parties, states, widgets…),
// stored under uploads/media/. The form keeps the returned path as the value.
const uploadMediaImage = [
  (req, res, next) => { req.contentType = "MEDIA"; next(); },
  ...uploadFields([{ name: "image", maxCount: 1 }]),
];

// Profile picture (one image), stored under uploads/profiles/ and converted to WebP.
const uploadProfilePicture = [
  (req, res, next) => { req.contentType = "PROFILES"; next(); },
  ...uploadFields([{ name: "profilePicture", maxCount: 1 }]),
];

// Stand-alone video upload for the homepage video widget, stored under uploads/media/.
const uploadMediaVideo = [
  (req, res, next) => { req.contentType = "MEDIA"; next(); },
  upload.fields([{ name: "videoFile", maxCount: 1 }]),
];

function fileUrl(type, file) {
  return `/uploads/${type.toLowerCase()}/${file.filename}`;
}

// KYC/qualification documents on admin-created team accounts (PAN, Aadhar,
// graduation certificate) and public role applications (same three, plus a
// resume) — a separate multer instance from the content uploads above since
// they're not tied to a `req.contentType` and need to accept PDFs/Word docs,
// not just images/video.
const DOCUMENT_TYPES =
  /^(image\/(jpeg|png|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;

const documentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_ROOT, "users");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function documentFileFilter(req, file, cb) {
  if (!DOCUMENT_TYPES.test(file.mimetype)) {
    return cb(new Error(`Unsupported file type for ${file.fieldname}: ${file.mimetype} (expected image, PDF, or Word doc)`));
  }
  cb(null, true);
}

const documentUpload = multer({ storage: documentStorage, fileFilter: documentFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

const uploadUserDocuments = documentUpload.fields([
  { name: "panDocument", maxCount: 1 },
  { name: "aadharDocument", maxCount: 1 },
  { name: "graduationCertificate", maxCount: 1 },
]);

// Public role-application form — same three KYC/qualification docs plus a
// required resume.
const uploadApplicationDocuments = documentUpload.fields([
  { name: "resume", maxCount: 1 },
  { name: "panDocument", maxCount: 1 },
  { name: "aadharDocument", maxCount: 1 },
  { name: "graduationCertificate", maxCount: 1 },
]);

function userDocumentUrl(file) {
  return `/uploads/users/${file.filename}`;
}

// Career-job applications — same accepted types as documentUpload (image/
// PDF/Word) but stored under their own uploads/careers/ folder rather than
// uploads/users/, since these are job-application resumes, not account KYC.
const careerStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_ROOT, "careers");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const careerUpload = multer({ storage: careerStorage, fileFilter: documentFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

const uploadCareerApplicationDocuments = careerUpload.fields([
  { name: "resume", maxCount: 1 },
  { name: "graduationCertificate", maxCount: 1 },
]);

function careerDocumentUrl(file) {
  return `/uploads/careers/${file.filename}`;
}

module.exports = {
  uploadFields,
  uploadAdImage,
  uploadMediaImage,
  uploadMediaVideo,
  uploadProfilePicture,
  fileUrl,
  uploadUserDocuments,
  uploadApplicationDocuments,
  userDocumentUrl,
  uploadCareerApplicationDocuments,
  careerDocumentUrl,
};
