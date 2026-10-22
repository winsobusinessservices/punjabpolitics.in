import { showToast } from "@/lib/toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";
export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

const AUTH_ENTRY_PATHS = new Set(["/auth/login", "/auth/google"]);
let lastSessionExpiredToastAt = 0;

// React Strict Mode mounts effects twice in development to expose unsafe side
// effects. Keep one promise per in-flight GET so both mounts share the same
// network call. Entries are removed as soon as the request settles, which
// means a later user-initiated refresh still fetches fresh data.
const pendingGetRequests = new Map();

// Uploaded media is served from the backend's root (e.g. /uploads/...), not
// under /api, so strip the /api suffix to get a base for building <img>/src.
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export function mediaUrl(path) {
  if (!path) return "";
  const value = String(path).trim();
  if (/^(?:https?:)?\/\//i.test(value) || /^(?:data|blob):/i.test(value)) return value;
  return `${MEDIA_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

// Hosts next.config.mjs's images.remotePatterns actually allowlists. Content
// imported from the legacy WordPress site can carry a featured-image URL
// from any original publisher's CDN (etvbharat, etc) — that set is
// unbounded, so next/image can't optimize it (unknown host = hard error).
// Everything outside this list is rendered `unoptimized` (plain <img>
// passthrough) instead of being wildcarded into the allowlist.
const OPTIMIZABLE_HOSTNAMES = new Set([
  new URL(MEDIA_BASE_URL || "http://localhost").hostname,
  "picsum.photos",
  "img.youtube.com",
  "vumbnail.com",
]);

export function isOptimizableImageHost(src) {
  if (!src || /^(?:data|blob):/i.test(src)) return true;
  try {
    const url = new URL(src, MEDIA_BASE_URL);
    return OPTIMIZABLE_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

function handleExpiredSession(notifyError) {
  const error = new Error("Your session has expired. Please sign in again.");
  error.status = 401;
  error.toastShown = true;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }

  const now = Date.now();
  if (notifyError && now - lastSessionExpiredToastAt > 1500) {
    lastSessionExpiredToastAt = now;
    showToast(error.message, "error");
  }

  throw error;
}

async function handleResponse(res, { path = "", notifySuccess = false, notifyError = true } = {}) {
  const rawBody = await res.text().catch(() => "");
  let data = {};
  try { data = rawBody ? JSON.parse(rawBody) : {}; } catch { data = {}; }
  if (!res.ok) {
    if (res.status === 401 && !AUTH_ENTRY_PATHS.has(path)) {
      handleExpiredSession(notifyError);
    }
    const fallbackMessage = res.status === 413
      ? "The selected file is too large. Choose a smaller file and try again."
      : res.status >= 500
        ? "The server could not complete this request. Please try again. If it continues, contact support with the action you were performing."
        : res.status === 404
          ? "The requested item could not be found. It may have been removed or belong to another website."
          : "Something went wrong. Please check the form and try again.";
    const backendMessage = /^(?:internal server error|something went wrong)[.!]?$/i.test(String(data.message || "").trim()) ? "" : data.message;
    const requestId = data.requestId || res.headers.get("x-request-id") || "";
    const displayMessage = backendMessage || fallbackMessage;
    const error = new Error(res.status >= 500 && requestId ? `${displayMessage} Reference: ${requestId}` : displayMessage);
    error.status = res.status;
    error.code = data.code;
    error.fieldErrors = data.fieldErrors || data.errors || null;
    error.requestId = requestId;
    error.toastShown = notifyError;
    if (notifyError) showToast(error.message, "error");
    throw error;
  }
  if (notifySuccess && data.message) showToast(data.message, "success");
  return data;
}

function handleNetworkError(error) {
  if (!error.toastShown) showToast(error.message || "Unable to connect to the server. Please try again.", "error");
  throw error;
}

async function request(path, { method = "GET", body, notifyError = true } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const normalizedMethod = method.toUpperCase();
  const managementSiteId = typeof window !== "undefined" ? window.localStorage.getItem("panel_active_site_id") : "";
  const requestKey = `${url}::site=${managementSiteId || "default"}`;

  if (normalizedMethod === "GET" && pendingGetRequests.has(requestKey)) {
    return pendingGetRequests.get(requestKey);
  }

  const responsePromise = fetch(url, {
    method: normalizedMethod,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(managementSiteId ? { "X-Management-Site-Id": managementSiteId } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
    .then((res) => handleResponse(res, { path, notifySuccess: normalizedMethod !== "GET", notifyError }))
    .catch((error) => {
      if (!notifyError) throw error;
      return handleNetworkError(error);
    });

  if (normalizedMethod !== "GET") return responsePromise;

  pendingGetRequests.set(requestKey, responsePromise);
  try {
    return await responsePromise;
  } finally {
    pendingGetRequests.delete(requestKey);
  }
}

// For multipart bodies (file uploads) — no Content-Type header, so the
// browser sets the correct multipart boundary itself.
async function requestForm(path, { method = "POST", formData } = {}) {
  try {
    const managementSiteId = typeof window !== "undefined" ? window.localStorage.getItem("panel_active_site_id") : "";
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: managementSiteId ? { "X-Management-Site-Id": managementSiteId } : undefined,
      body: formData,
    });
    return await handleResponse(res, { path, notifySuccess: true });
  } catch (error) {
    return handleNetworkError(error);
  }
}

export const authApi = {
  requestRegistrationOtp: (payload) => request("/auth/register/request-otp", { method: "POST", body: payload }),
  verifyRegistrationOtp: (payload) => request("/auth/register/verify-otp", { method: "POST", body: payload }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  googleAuth: (payload) => request("/auth/google", { method: "POST", body: payload }),
  getGoogleAuthConfig: () => request("/auth/google/config", { notifyError: false }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me", { notifyError: false }),
  // My profile: name and mobile number (PATCH) and picture (multipart "profilePicture").
  updateMyProfile: (payload) => request("/auth/me", { method: "PATCH", body: payload }),
  updateProfilePicture: (formData) => requestForm("/auth/me/picture", { formData }),
  changePassword: (payload) => request("/auth/change-password", { method: "POST", body: payload }),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),
  updateUserRole: (id, role) => request(`/auth/users/${id}/role`, { method: "PATCH", body: { role } }),
  // Admin/Investor only — backs the Investor read-only dashboard's user
  // totals (total users, authors, editors).
  listUsers: () => request("/auth/users"),
  // Admin only — combined name/email/role editor for the Team Members table.
  // status = website account, panelStatus = panel access only (team members).
  updateUserStatus: (id, payload) => request(`/auth/users/${id}/status`, { method: "PATCH", body: payload }),
  updateUser: (id, payload) => request(`/auth/users/${id}`, { method: "PATCH", body: payload }),
  assignAuthorEditor: (authorId, editorId) => request(`/auth/users/${authorId}/editor`, {
    method: "PATCH",
    body: { editorId },
  }),
  // Admin only — removes a team member's account entirely.
  deleteUser: (id, reason) => request(`/auth/users/${id}`, { method: "DELETE", body: { reason } }),
  // Admin assigning an Author/Editor/Investor role (with KYC documents) to an
  // already-registered account — no password is set here, the person must
  // already exist via register().
  assignRole: (formData) => requestForm("/auth/admin/users", { formData }),
};

export const contactApi = {
  submit: (payload) => request("/contact", { method: "POST", body: payload }),
};

export const commentsApi = {
  listForPost: (postSlug) => request(`/comments/post/${encodeURIComponent(postSlug)}`, { notifyError: false }),
  create: (postSlug, content) => request("/comments", { method: "POST", body: { postSlug, content } }),
  listForAdmin: () => request("/admin/comments"),
  setHidden: (id, hidden) => request(`/admin/comments/${id}/visibility`, { method: "PATCH", body: { hidden } }),
  remove: (id) => request(`/comments/${id}`, { method: "DELETE" }),
};

export const contentLimitsApi = {
  getMine: () => request("/content-limits/me", { notifyError: false }),
  get: () => request("/admin/content-limits"),
  update: (limits) => request("/admin/content-limits", { method: "PUT", body: { limits } }),
};

export const siteManagementApi = {
  get: (siteId) => request(`/admin/site-management${siteId ? `?siteId=${siteId}` : ""}`),
  updateHeader: (header, siteId) => request("/admin/site-management/header", { method: "PUT", body: { header, siteId } }),
  updateWidget: (key, data, siteId) => request(`/admin/reference-data/home-widgets/${encodeURIComponent(key)}`, { method: "PUT", body: { data, siteId } }),
  setSectionVisibility: (key, isVisible, siteId) => request(`/admin/ui-sections/${encodeURIComponent(key)}/visibility`, { method: "PATCH", body: { isVisible, siteId } }),
};

export const sitesApi = {
  current: () => request("/sites/current", { notifyError: false }),
  list: () => request("/admin/sites"),
  features: (siteId) => request(`/admin/site-features${siteId ? `?siteId=${siteId}` : ""}`),
  create: (formData) => requestForm("/admin/sites", { method: "POST", formData }),
  update: (id, formData) => requestForm(`/admin/sites/${id}`, { method: "PATCH", formData }),
};

export const servicesApi = {
  list: (siteId) => request(`/admin/services${siteId ? `?siteId=${siteId}` : ""}`),
  create: (payload) => request("/admin/services", { method: "POST", body: payload }),
  update: (id, payload) => request(`/admin/services/${id}`, { method: "PATCH", body: payload }),
  remove: (id) => request(`/admin/services/${id}`, { method: "DELETE" }),
};

export const uploadApi = {
  image: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return requestForm("/admin/upload-image", { formData });
  },
  video: (file) => {
    const formData = new FormData();
    formData.append("videoFile", file);
    return requestForm("/admin/upload-video", { formData });
  },
};

// Audience analytics. Events are fire-and-forget and never show error toasts.
export const analyticsApi = {
  getOverview: (period = "today", siteId) => request(`/analytics/overview?period=${encodeURIComponent(period)}${siteId ? `&siteId=${encodeURIComponent(siteId)}` : ""}`, { notifyError: false }),
  getRetention: (siteId) => request(`/analytics/retention${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`, { notifyError: false }),
  track: (eventName, path) => request("/analytics/events", { method: "POST", body: { eventName, surface: "PANEL", path }, notifyError: false }).catch(() => {}),
};

// Interest-based notifications (admin): the on/off switch, the hour sending starts (India time) and today's numbers.
export const interestPushApi = {
  settings: () => request("/push/interest/settings"),
  setEnabled: (enabled) => request("/push/interest/settings", { method: "PATCH", body: { enabled } }),
  setSendFromHour: (sendFromHour) => request("/push/interest/settings", { method: "PATCH", body: { sendFromHour } }),
};

// Support donations (admin): totals, the filtered list, and the CSV download (same filters and columns).
export const donationApi = {
  list: ({ status, kind, q, limit = 50, offset = 0 } = {}) =>
    request(`/admin/donations?${new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(q ? { q } : {}), limit: String(limit), offset: String(offset) })}`),
  async exportCsv({ status, kind, q, fields } = {}) {
    const query = new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(q ? { q } : {}), ...(fields ? { fields } : {}) });
    const managementSiteId = typeof window !== "undefined" ? window.localStorage.getItem("panel_active_site_id") : "";
    const res = await fetch(`${API_BASE_URL}/admin/donations/export?${query}`, {
      credentials: "include",
      headers: managementSiteId ? { "X-Management-Site-Id": managementSiteId } : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "The donations could not be exported.");
    }
    return res.blob();
  },
};

// Premium subscriptions (admin): the plan cards/prices and the list of purchases.
export const subscriptionAdminApi = {
  plans: () => request("/admin/subscription/plans"),
  savePlans: (plans) => request("/admin/subscription/plans", { method: "PUT", body: { plans } }),
  list: ({ status, q, limit = 50, offset = 0 } = {}) =>
    request(`/admin/subscriptions?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), limit: String(limit), offset: String(offset) })}`),
};

// Task management (backed by /api/tasks).
export const taskApi = {
  list: ({ status, page = 1, limit = 50 } = {}) =>
    request(`/tasks?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page), limit: String(limit) })}`),
  mine: ({ page = 1, limit = 50 } = {}) => request(`/tasks/mine?page=${page}&limit=${limit}`),
  relatedContent: (assigneeId) => request(`/tasks/related-content?assigneeId=${encodeURIComponent(assigneeId)}`, { notifyError: false }),
  get: (id) => request(`/tasks/${id}`),
  create: (payload) => request("/tasks", { method: "POST", body: payload }),
  update: (id, payload) => request(`/tasks/${id}`, { method: "PATCH", body: payload }),
  // Status-only change with an optional note (Authors and Editors).
  updateStatus: (id, status, description) =>
    request(`/tasks/${id}/status`, { method: "PATCH", body: { status, ...(description !== undefined ? { description } : {}) } }),
  delete: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};

// Site pages (categories, keywords, parties, leaders) for link pickers.
export const internalLinksApi = {
  search: (query = "") => request(`/internal-links?q=${encodeURIComponent(query)}`, { notifyError: false }),
};

export const adsApi = {
  list: () => request("/admin/ads"),
  create: (formData) => requestForm("/admin/ads", { method: "POST", formData }),
  update: (id, formData) => requestForm(`/admin/ads/${id}`, { method: "PATCH", formData }),
  remove: (id) => request(`/admin/ads/${id}`, { method: "DELETE" }),
};

export const deletionsApi = {
  list: (state = "ACTIVE", siteId) => request(`/admin/deletions?state=${encodeURIComponent(state)}${siteId ? `&siteId=${siteId}` : ""}`),
  restore: (id, siteId) => request(`/admin/deletions/${id}/restore`, { method: "PATCH", body: { siteId } }),
  permanentlyDelete: (id, siteId) => request(`/admin/deletions/${id}/permanent`, { method: "DELETE", body: { siteId } }),
};

export const walletApi = {
  getWallet: () => request("/wallet"),
  acknowledgeBonus: (bonusId) => request(`/wallet/bonuses/${bonusId}/acknowledge`, { method: "PATCH" }),
  requestWithdrawal: (points, upiId) => request("/wallet/withdrawals", { method: "POST", body: { points, upiId } }),
  listWithdrawals: (status) => request(`/admin/withdrawals${status ? `?status=${status}` : ""}`),
  markWithdrawalPaid: (id, utrNumber) => request(`/admin/withdrawals/${id}/pay`, { method: "PATCH", body: { utrNumber } }),
  rejectWithdrawal: (id, reason) => request(`/admin/withdrawals/${id}/reject`, { method: "PATCH", body: { reason } }),
  listForAdmin: () => request("/admin/wallets"),
  setWithdrawalAccess: (userId, enabled) => request(`/admin/wallets/${userId}/withdrawal-access`, {
    method: "PATCH",
    body: { enabled },
  }),
  getWithdrawalSettings: () => request("/admin/wallets/withdrawal-settings"),
  updateWithdrawalSettings: (minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr) => request("/admin/wallets/withdrawal-settings", {
    method: "PUT",
    body: { minimumWithdrawalInr, authorMinimumRemainingInr, editorMinimumRemainingInr },
  }),
  getPointRates: () => request("/admin/wallets/point-rates"),
  updatePointRates: (settings) => request("/admin/wallets/point-rates", {
    method: "PUT",
    body: settings,
  }),
  awardBonus: (payload) => request("/admin/wallets/bonuses", { method: "POST", body: payload }),
};

function toQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value);
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

// Backend resources are type-scoped REST endpoints (/articles, /blogs,
// /videos), each following the same create -> draft -> submit -> AI check ->
// editor review workflow. `GET /:resource` is always scoped to the caller's
// own content, regardless of role — "my content" means MY content. Moderator
// visibility into everyone else's content lives at `GET /:resource/history`
// instead (review queue / content history), never mixed into this one.
const RESOURCE_PATH = { ARTICLE: "articles", BLOG: "blogs", VIDEO: "videos" };

// Investor/Admin only — most-viewed news (10) and blogs (3).
export const investorApi = {
  topContent: () => request("/investor/top-content"),
};

export const authorApi = {
  // Create/update send multipart form data — featured images, thumbnails, and
  // uploaded video files ride along as real files, not URL strings.
  createArticle: (formData) => requestForm("/articles", { formData }),
  createBlog: (formData) => requestForm("/blogs", { formData }),
  createVideo: (formData) => requestForm("/videos", { formData }),
  listCategories: (siteId) => request(`/categories${siteId ? `?siteId=${siteId}` : ""}`),

  listByType: (type, filters) => request(`/${RESOURCE_PATH[type]}${toQueryString(filters)}`),

  // Convenience: the "My Content" dashboard shows all three types together,
  // even though the backend itself has no combined endpoint.
  async listAllTypes(filters) {
    const lists = await Promise.all(
      Object.keys(RESOURCE_PATH).map((type) => authorApi.listByType(type, filters).then((data) => data.posts))
    );
    return lists.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Moderator-only — every author's content. Backs the review queue
  // (status=PENDING) and the content history page (no/any status filter).
  listHistoryByType: (type, filters) => request(`/${RESOURCE_PATH[type]}/history${toQueryString(filters)}`),

  async listAllHistory(filters) {
    const lists = await Promise.all(
      Object.keys(RESOURCE_PATH).map((type) => authorApi.listHistoryByType(type, filters).then((data) => data.posts))
    );
    return lists.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getPost: (type, id) => request(`/${RESOURCE_PATH[type]}/${id}`),
  setCommentsEnabled: (type, id, enabled) => request(`/${RESOURCE_PATH[type]}/${id}/comments`, {
    method: "PATCH",
    body: { enabled },
  }),
  updatePost: (type, id, formData) => requestForm(`/${RESOURCE_PATH[type]}/${id}`, { method: "PUT", formData }),
  deletePost: (type, id, reason) => request(`/${RESOURCE_PATH[type]}/${id}`, { method: "DELETE", body: reason ? { reason } : undefined }),
  submitPost: (type, id) => request(`/${RESOURCE_PATH[type]}/${id}/submit`, { method: "POST" }),
  getPostStatus: (type, id) => request(`/${RESOURCE_PATH[type]}/${id}/status`),
  reviewPost: (type, id, payload) => request(`/${RESOURCE_PATH[type]}/${id}/review`, { method: "POST", body: payload }),
  bulkModerate: (action, items, notes) => request("/content/bulk", {
    method: "POST",
    body: { action, items, notes },
  }),
};

export const categoriesApi = {
  list: () => request("/categories"),
  listVisibilitySettings: (siteId) => request(`/admin/ui-visibility${siteId ? `?siteId=${siteId}` : ""}`),
  listReferenceVisibility: (siteId) => request(`/admin/reference-visibility${siteId ? `?siteId=${siteId}` : ""}`),
  setReferenceVisibility: (type, id, isVisible, siteId) => request(`/admin/reference-visibility/${type}/${id}`, { method: "PATCH", body: { isVisible, siteId } }),
  create: (payload) => request("/categories", { method: "POST", body: typeof payload === "string" ? { name: payload } : payload }),
  updateContent: (id, content) => request(`/categories/${id}/content`, { method: "PATCH", body: { content } }),
  // "Subscribers only": the category's stories are premium and it gets a card on the website's /premium page.
  setPremium: (id, isPremium, siteId) => request(`/categories/${id}/premium`, { method: "PATCH", body: { isPremium, siteId } }),
  setVisibility: (id, isVisible) => request(`/categories/${id}/visibility`, { method: "PATCH", body: { isVisible } }),
  setSectionVisibility: (key, isVisible) => request(`/admin/ui-sections/${encodeURIComponent(key)}/visibility`, { method: "PATCH", body: { isVisible } }),
  remove: (id) => request(`/categories/${id}`, { method: "DELETE" }),
};

export const policiesApi = {
  list: () => request("/policies"),
  listForRegistration: () => request("/policies/registration", { notifyError: false }),
  listForAdmin: (siteId) => request(`/policies/manage${siteId ? `?siteId=${siteId}` : ""}`),
  getBySlug: (slug) => request(`/policies/${encodeURIComponent(slug)}`, { notifyError: false }),
  create: (payload, siteId) => request("/policies", { method: "POST", body: { ...payload, siteId } }),
  update: (id, payload, siteId) => request(`/policies/${id}`, { method: "PATCH", body: { ...payload, siteId } }),
  remove: (id, siteId) => request(`/policies/${id}`, { method: "DELETE", body: { siteId } }),
};

export const referenceAdminApi = {
  async list() {
    const data = await request("/admin/reference-data");
    if (Array.isArray(data.events) && Array.isArray(data.rallies)) return data;

    // Compatibility for a backend process that was started before schedule
    // fields were added to the admin response. The public home bundle is the
    // same database source used by Header.jsx.
    const home = await request("/news/home");
    return {
      ...data,
      events: Array.isArray(data.events) ? data.events : (home.widgets?.political_calendar || []),
      rallies: Array.isArray(data.rallies) ? data.rallies : (home.widgets?.political_rallys || []),
    };
  },
  create: (type, payload) => request(`/admin/reference-data/${type}`, { method: "POST", body: payload }),
  update: (type, id, payload) => request(`/admin/reference-data/${type}/${id}`, { method: "PATCH", body: payload }),
  remove: (type, id) => request(`/admin/reference-data/${type}/${id}`, { method: "DELETE" }),
  updateParliament: (parliament) => request("/admin/reference-data/parliament", { method: "PUT", body: { parliament } }),
  updateSchedule: (type, items) => request(`/admin/reference-data/schedule/${type}`, { method: "PUT", body: { items } }),
  updateVidhanSabhas: (items) => request("/admin/reference-data/vidhan-sabhas", { method: "PUT", body: { items } }),
  updateHomeWidget: (key, data, siteId) => request(`/admin/reference-data/home-widgets/${encodeURIComponent(key)}`, { method: "PUT", body: { data, siteId } }),
  updatePageProfiles: (profiles) => request("/admin/reference-data/page-profiles", { method: "PUT", body: { profiles } }),
};

export const pollApi = {
  vote: (optionIndex) => request("/poll/vote", { method: "POST", body: { optionIndex } }),
};

export const applicationsApi = {
  list: ({ status, role } = {}) => request(`/applications${toQueryString({ status, role })}`),
  review: (id, payload) => request(`/applications/${id}/review`, { method: "POST", body: payload }),
};

// Job postings the site is hiring for — admin creates/manages, any logged-in
// member can browse and apply. Distinct from authApi's role-application
// flow (self-signup to become an Author/Editor/Investor on the platform).
export const careersApi = {
  create: (payload) => request("/careers", { method: "POST", body: payload }),
  update: (id, payload) => request(`/careers/${id}`, { method: "PATCH", body: payload }),
  list: () => request("/careers"),
  listForAdmin: (status) => request(`/careers/manage${toQueryString({ status })}`),
  getBySlug: (slug) => request(`/careers/${slug}`),
  setStatus: (id, status) => request(`/careers/${id}/status`, { method: "PATCH", body: { status } }),
  remove: (id) => request(`/careers/${id}`, { method: "DELETE" }),
  apply: (id, formData) => requestForm(`/careers/${id}/apply`, { formData }),
  getMyApplication: (id) => request(`/careers/${id}/my-application`),
  listApplications: (id) => request(`/careers/${id}/applications`),
  reviewApplication: (id, appId, payload) => request(`/careers/${id}/applications/${appId}/review`, { method: "POST", body: payload }),
};
