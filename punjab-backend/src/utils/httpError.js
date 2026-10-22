function classifyError(error, fallbackMessage = "The server could not complete this request") {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  if (code === "ER_DUP_ENTRY") return { status: 409, message: "A record with the same value already exists. Please use a different value.", code };
  if (code === "ER_NO_REFERENCED_ROW_2") return { status: 400, message: "A selected item no longer exists. Refresh the page and choose it again.", code };
  if (code === "ER_BAD_NULL_ERROR") return { status: 400, message: "A required value is missing. Review the highlighted fields and try again.", code };
  if (["ER_DATA_TOO_LONG", "ER_WARN_DATA_OUT_OF_RANGE"].includes(code)) return { status: 400, message: "One of the entered values is longer than the allowed limit.", code };
  if (["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(code)) return { status: 400, message: code === "LIMIT_FILE_SIZE" ? "The selected file is too large." : "The selected files do not match the expected upload fields.", code };
  if (/unsupported image format|input buffer contains unsupported|corrupt header|bad seek/i.test(message)) return { status: 400, message: "The image could not be processed. Upload a valid PNG, JPG, WebP, GIF, or AVIF image.", code: "INVALID_IMAGE" };
  if (error?.name === "ValidationError") return { status: 400, message: message || "Some entered values are invalid.", code: "VALIDATION_ERROR" };
  return { status: 500, message: fallbackMessage, code: code || "INTERNAL_ERROR" };
}

function sendError(res, error, fallbackMessage) {
  const normalized = classifyError(error, fallbackMessage);
  return res.status(normalized.status).json({
    success: false,
    message: normalized.message,
    code: normalized.code,
    requestId: res.locals.requestId,
  });
}

module.exports = { classifyError, sendError };
