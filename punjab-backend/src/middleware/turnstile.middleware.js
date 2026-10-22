// Cloudflare Turnstile bot check. Put it in front of public forms (sign in, sign up code,
// password reset, contact). The browser sends the widget's one-time token as `turnstileToken`
// in the JSON body (or in the `cf-turnstile-response` header).
//
// TURNSTILE_SECRET_KEY unset  -> the check is skipped (local development / not enabled yet).
// TURNSTILE_SECRET_KEY set    -> the token is required and verified with Cloudflare.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ERROR_MESSAGES = {
  "timeout-or-duplicate": "The security check expired. Please try again.",
  "invalid-input-response": "The security check could not be verified. Please try again.",
};

function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return next();

  const token = String(req.body?.turnstileToken || req.get("cf-turnstile-response") || "").trim();
  if (!token) {
    return res.status(400).json({ success: false, code: "TURNSTILE_REQUIRED", message: "Please complete the security check." });
  }

  const form = new URLSearchParams({ secret, response: token });
  // Behind Cloudflare the visitor address arrives in CF-Connecting-IP; otherwise use the socket address.
  const ip = req.get("cf-connecting-ip") || req.ip || req.socket?.remoteAddress;
  if (ip) form.set("remoteip", ip);

  fetch(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(8000) })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        delete req.body.turnstileToken;
        return next();
      }
      const reason = (result["error-codes"] || [])[0];
      console.warn("Turnstile rejected a request:", (result["error-codes"] || []).join(","));
      return res.status(400).json({ success: false, code: "TURNSTILE_FAILED", message: ERROR_MESSAGES[reason] || "Security check failed. Please try again." });
    })
    .catch((error) => {
      console.error("Turnstile verification error:", error.message);
      return res.status(503).json({ success: false, code: "TURNSTILE_UNAVAILABLE", message: "The security check is temporarily unavailable. Please try again shortly." });
    });
}

// Default export (as the routes import it) with a named alias.
module.exports = verifyTurnstile;
module.exports.verifyTurnstile = verifyTurnstile;
