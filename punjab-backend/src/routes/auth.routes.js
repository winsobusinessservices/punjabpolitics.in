const express = require("express");
const routes = express.Router();
const {
  login,
  googleAuth,
  getGoogleAuthConfig,
  register,
  getCurrentUser,
  recordPrivacyConsent,
  listUsers,
  adminAssignRole,
  updateUserRole,
  updateUser,
  assignAuthorEditor,
  updateUserStatus,
  deleteUser,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} = require("../controllers/auth/auth.controller");
const verifyTurnstile = require("../middleware/turnstile.middleware");
const { authenticate, authorize, authorizePermission, authorizeRoleOrPermission } = require("../middleware/auth.middleware");
const { PERMISSIONS } = require("../config/permissions");
const { uploadUserDocuments, uploadProfilePicture } = require("../middleware/upload.middleware");
const { updateMyProfile, updateProfilePicture } = require("../controllers/users/profile.controller");

/**
 * @openapi
 * /api/auth/register/request-otp:
 *   post:
 *     summary: Email a six-digit registration verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, confirmPassword, agreeToTerms, acceptedPolicyIds]
 *             properties:
 *               name: { type: string, example: John Doe }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               confirmPassword: { type: string, format: password }
 *               agreeToTerms: { type: boolean }
 *               acceptedPolicyIds:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200: { description: Verification code sent }
 *       400: { description: Missing or invalid registration fields }
 *       409: { description: Account already exists }
 *       429: { description: Code requested too frequently }
 *       500: { description: Unable to send verification code through the configured cPanel mail account }
 */
routes.post("/auth/register/request-otp", verifyTurnstile, requestRegistrationOtp);

/**
 * @openapi
 * /api/auth/register/verify-otp:
 *   post:
 *     summary: Verify the emailed registration code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, challengeToken]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *               challengeToken: { type: string }
 *     responses:
 *       200: { description: Email verified; returns a registration verification token }
 *       400: { description: Incorrect, invalid, or expired code }
 *       429: { description: Too many attempts }
 */
routes.post("/auth/register/verify-otp", verifyRegistrationOtp);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, verificationToken]
 *             properties:
 *               name: { type: string, example: John Doe }
 *               email: { type: string, example: john@example.com }
 *               password: { type: string, format: password, example: secret123 }
 *               verificationToken: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing or invalid fields
 *       409:
 *         description: User already exists
 */
routes.post("/auth/register", register); // already gated by the emailed code (verificationToken)

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive an HttpOnly auth cookie
 *     description: On success, sets the JWT in an HttpOnly "token" cookie. The token is not included in the JSON body.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: john@example.com }
 *               password: { type: string, format: password, example: secret123 }
 *     responses:
 *       200:
 *         description: Login successful, auth cookie set
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account is not active
 *       500:
 *         description: Internal server error
 */
routes.post("/auth/login", verifyTurnstile, login);

/**
 * @openapi
 * /api/auth/google:
 *   post:
 *     summary: Sign in or register with a Google ID token
 *     description: Send the Google ID token returned by Google Identity Services. Do not send the OAuth client ID here.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID token (JWT) returned by Google Identity Services
 *               intent:
 *                 type: string
 *                 enum: [login, register]
 *                 default: login
 *               agreeToTerms:
 *                 type: boolean
 *                 description: Required when intent is register
 *               acceptedPolicyIds:
 *                 type: array
 *                 description: Required registration policy IDs when intent is register
 *                 items: { type: integer }
 *     responses:
 *       200: { description: Google login successful }
 *       201: { description: Google registration successful }
 *       400: { description: Missing credential, terms acceptance, or required policies }
 *       401: { description: Invalid Google credential }
 *       403: { description: Account is not active }
 *       404: { description: No account uses this Google email }
 *       409: { description: An account already exists or the Google account is already linked }
 *       500: { description: Unable to authenticate with Google }
 *       503: { description: Google authentication is not configured }
 */
/**
 * @openapi
 * /api/auth/google/config:
 *   get:
 *     summary: Get the public Google OAuth client configuration
 *     tags: [Auth]
 *     responses:
 *       200: { description: Google OAuth configuration }
 *       500: { description: Server configuration error }
 */
routes.get("/auth/google/config", getGoogleAuthConfig);
routes.post("/auth/google", googleAuth);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The authenticated user's profile
 *       401:
 *         description: Missing or invalid token
 */
routes.get("/auth/me", authenticate, getCurrentUser);
routes.post("/auth/privacy-consent", authenticate, recordPrivacyConsent);

/**
 * @openapi
 * /api/auth/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Caller is not an admin
 */
routes.get("/auth/users", authenticate, authorizeRoleOrPermission(["ADMIN", "INVESTOR"], PERMISSIONS.TEAM_MEMBERS, PERMISSIONS.MANAGE_USERS), listUsers);

/**
 * @openapi
 * /api/auth/admin/users:
 *   post:
 *     summary: Assign an Author, Editor, or Investor role to an existing account (admin only)
 *     description: >
 *       The target account must already exist (self-registered via the public
 *       /auth/register signup) — this does not create accounts or set passwords.
 *       It updates the account's role and, if provided, its role-required KYC
 *       documents. Author needs PAN + Aadhar on file; Editor needs PAN + Aadhar +
 *       a graduation certificate; Investor needs none. Documents only need to be
 *       attached here if not already on file. multipart/form-data — fields
 *       panDocument, aadharDocument, graduationCertificate accept image or PDF.
 *       Emails the user that their role has changed, unless the role is unchanged.
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string }
 *               role: { type: string, enum: [AUTHOR, EDITOR, INVESTOR] }
 *               panDocument: { type: string, format: binary }
 *               aadharDocument: { type: string, format: binary }
 *               graduationCertificate: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Missing/invalid fields or missing required document(s)
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: No account exists with that email
 */
routes.post("/auth/admin/users", authenticate, authorizePermission(PERMISSIONS.TEAM_MEMBERS), uploadUserDocuments, adminAssignRole);

/**
 * @openapi
 * /api/auth/users/{id}/role:
 *   patch:
 *     summary: Update a user's role (admin only)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [USER, AUTHOR, EDITOR, ADMIN, INVESTOR] }
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: User not found
 */
routes.patch("/auth/users/:id/role", authenticate, authorizePermission(PERMISSIONS.TEAM_MEMBERS), updateUserRole);

/**
 * @openapi
 * /api/auth/users/{id}:
 *   patch:
 *     summary: Update a user's name, email, and/or role (admin only)
 *     description: >
 *       Backs the Team Members table's inline edit — all fields are optional,
 *       only the ones sent are changed. An admin cannot change their own role
 *       through this endpoint (use another admin's account to do that).
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               role: { type: string, enum: [USER, AUTHOR, EDITOR, ADMIN, INVESTOR] }
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Invalid name/email/role, or attempted self role-change
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: User not found
 *       409:
 *         description: Email already in use
 */
routes.patch("/auth/users/:id", authenticate, authorizePermission(PERMISSIONS.TEAM_MEMBERS), updateUser);

/**
 * @openapi
 * /api/auth/users/{id}/editor:
 *   patch:
 *     summary: Assign or unassign an Editor/Subadmin reviewer for an Author/Editor creator
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [editorId]
 *             properties:
 *               editorId: { type: integer, nullable: true }
 *     responses:
 *       200: { description: Editor assignment updated }
 *       400: { description: Invalid author or editor }
 *       401: { description: Authentication required }
 *       403: { description: Insufficient permission }
 *       500: { description: Unable to update assignment }
 */
// My profile (any signed-in account)
routes.patch("/auth/me", authenticate, updateMyProfile);
routes.post("/auth/me/picture", authenticate, uploadProfilePicture, updateProfilePicture);
routes.patch("/auth/users/:id/status", authenticate, authorizePermission(PERMISSIONS.TEAM_MEMBERS, PERMISSIONS.MANAGE_USERS), updateUserStatus);
routes.patch("/auth/users/:id/editor", authenticate, authorize("ADMIN", "SUBADMIN"), assignAuthorEditor);

/**
 * @openapi
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User deleted
 *       400:
 *         description: Attempted to delete own account
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: User not found
 */
routes.delete("/auth/users/:id", authenticate, authorizePermission(PERMISSIONS.TEAM_MEMBERS, PERMISSIONS.MANAGE_USERS), deleteUser);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: Clears the HttpOnly auth cookie set at login.
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Missing or invalid token
 */
routes.post("/auth/logout", authenticate, logout);

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     summary: Change the password of the currently authenticated user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Missing fields or weak new password
 *       401:
 *         description: Missing/invalid token or incorrect current password
 */
routes.post("/auth/change-password", authenticate, changePassword);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset token
 *     description: Always returns the same response whether or not the email is registered, to prevent account enumeration. The reset token is emailed to the user in production.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: john@example.com }
 *     responses:
 *       200:
 *         description: Reset instructions sent if the email is registered
 *       400:
 *         description: Missing email
 */
routes.post("/auth/forgot-password", verifyTurnstile, forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset a password using a token from forgot-password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Missing fields or weak new password
 *       401:
 *         description: Invalid or expired reset token
 *       404:
 *         description: User not found
 */
routes.post("/auth/reset-password", resetPassword);

module.exports = routes;
