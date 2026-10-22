const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const AUTH_COOKIE_NAME = "token";

// Verifies the JWT from the auth cookie (falling back to a Bearer header for
// non-browser clients) and attaches its payload ({ userId, role }) to req.user
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;
    const token = req.cookies?.[AUTH_COOKIE_NAME] || bearerToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Missing JWT_SECRET in environment");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decodedToken.userId);
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Account is unavailable" });
    }
    {
      const identity = User.sessionIdentity(user);
      req.user = { userId: user.id, id: user.id, role: identity.role, permissions: identity.permissions, panelAccess: identity.panelAccess, siteId: Number(user.site_id || 1) };
    }

    const consentExempt =
      (req.method === "GET" && req.path === "/auth/me") ||
      (req.method === "POST" && ["/auth/privacy-consent", "/auth/logout"].includes(req.path));
    if (!consentExempt && user.terms_accepted !== true && Number(user.terms_accepted) !== 1) {
      return res.status(403).json({
        success: false,
        code: "CONSENT_REQUIRED",
        message: "Please review and accept the current privacy policies to continue",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};

// Public routes can use the signed-in identity when available without
// requiring visitors to authenticate. Invalid/expired optional credentials
// are treated as anonymous and never grant access.
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;
    const token = req.cookies?.[AUTH_COOKIE_NAME] || bearerToken;
    if (!token || !process.env.JWT_SECRET) return next();

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decodedToken.userId);
    if (user?.status === "ACTIVE") {
      if (user.terms_accepted !== true && Number(user.terms_accepted) !== 1) {
        return res.status(403).json({
          success: false,
          code: "CONSENT_REQUIRED",
          message: "Please review and accept the current privacy policies to continue",
        });
      }
      {
        const identity = User.sessionIdentity(user);
        req.user = { userId: user.id, id: user.id, role: identity.role, permissions: identity.permissions, panelAccess: identity.panelAccess, siteId: Number(user.site_id || 1) };
      }
    }
    return next();
  } catch {
    return next();
  }
};

const authorizePermission = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (req.user.role === "ADMIN" || requiredPermissions.some((permission) => req.user.permissions?.includes(permission))) return next();
  return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
};

const authorizeRoleOrPermission = (allowedRoles, ...requiredPermissions) => (req, res, next) => {
  if (req.user && allowedRoles.includes(req.user.role)) return next();
  return authorizePermission(...requiredPermissions)(req, res, next);
};

// Restricts a route to specific roles. Must run after authenticate.
// Usage: router.get("/admin", authenticate, authorize("ADMIN"), handler)
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
};

module.exports = { authenticate, optionalAuthenticate, authorize, authorizePermission, authorizeRoleOrPermission };
