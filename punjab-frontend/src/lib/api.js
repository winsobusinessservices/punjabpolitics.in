import { showToast } from "@/lib/toast";
import { withSiteHeaders } from "@/lib/siteRequest";

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
  // Files under /images live in this Next.js application's public folder.
  // Keep them relative to the Punjab frontend instead of rewriting them to
  // the API host, where /images does not exist and next/image rejects it.
  if (value.startsWith("/images/")) return value;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !AUTH_ENTRY_PATHS.has(path)) {
      handleExpiredSession(notifyError);
    }
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.status = res.status;
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

  const fetchOptions = await withSiteHeaders({
    method: normalizedMethod,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const siteDomain = fetchOptions.headers?.["X-Site-Domain"] || "default";
  const requestKey = `${url}::site=${siteDomain}`;
  if (normalizedMethod === "GET" && pendingGetRequests.has(requestKey)) {
    return pendingGetRequests.get(requestKey);
  }
  const responsePromise = fetch(url, fetchOptions)
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
    const fetchOptions = await withSiteHeaders({
      method,
      credentials: "include",
      body: formData,
    });
    const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
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
  recordPrivacyConsent: (accepted, acceptedPolicyIds = []) => request("/auth/privacy-consent", {
    method: "POST",
    body: { accepted, acceptedPolicyIds },
    notifyError: false,
  }),
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

// Audience analytics: one lightweight activity ping per visit; failures are ignored.
export const analyticsApi = {
  track: (eventName, path) => request("/analytics/events", { method: "POST", body: { eventName, surface: "PUBLIC", path }, notifyError: false }).catch(() => { }),
};


// "My interests" survey (works signed in or not: a visitor is recognised by their browser) and "My Activity".
export const preferencesApi = {
  getMine: () => request("/preferences/me", { notifyError: false }),
  save: (payload) => request("/preferences/me", { method: "PUT", body: payload, notifyError: false }),
};
// Browser notifications: this browser's push subscription (the server only sends to people who agreed in My interests).
export const pushApi = {
  subscribe: (subscription) => request("/push/subscribe", { method: "POST", body: { subscription }, notifyError: false }),
  unsubscribe: (endpoint) => request("/push/unsubscribe", { method: "POST", body: { endpoint }, notifyError: false }),
};
export const historyApi = {
  mine: () => request("/me/history"),
};

// Support (donations). Errors are shown inline by the form, so no toasts.
export const supportApi = {
  getConfig: () => request("/support/config", { notifyError: false }),
  start: (payload) => request("/support/donations", { method: "POST", body: payload, notifyError: false }),
  confirm: (publicId, payload) => request(`/support/donations/${encodeURIComponent(publicId)}/confirm`, { method: "POST", body: payload, notifyError: false }),
  status: (publicId) => request(`/support/donations/${encodeURIComponent(publicId)}`, { notifyError: false }),
  // The signed-in donor stops their own monthly contribution (shows the server's message as a toast).
  stopMonthly: (publicId) => request(`/support/donations/${encodeURIComponent(publicId)}/stop`, { method: "POST" }),
  supporters: () => request("/support/supporters", { notifyError: false }),
  // The signed-in donor's own paid contributions (and whether a monthly one is still running).
  mine: () => request("/support/me", { notifyError: false }),
};


// Premium subscription: the cards/price (public), starting and confirming a purchase (signed in).
export const subscriptionApi = {
  getConfig: () => request("/subscription/config", { notifyError: false }),
  start: (payload) => request("/subscription", { method: "POST", body: payload }),
  confirm: (publicId, payload) => request(`/subscription/${encodeURIComponent(publicId)}/confirm`, { method: "POST", body: payload }),
  me: () => request("/subscription/me", { notifyError: false }),
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

export const deletionsApi = {
  list: (state = "ACTIVE") => request(`/admin/deletions?state=${encodeURIComponent(state)}`),
  restore: (id) => request(`/admin/deletions/${id}/restore`, { method: "PATCH" }),
  permanentlyDelete: (id) => request(`/admin/deletions/${id}/permanent`, { method: "DELETE" }),
};

export const walletApi = {
  getWallet: () => request("/wallet"),
  acknowledgeBonus: (bonusId) => request(`/wallet/bonuses/${bonusId}/acknowledge`, { method: "PATCH" }),
  requestWithdrawal: (points) => request("/wallet/withdrawals", { method: "POST", body: { points } }),
  generatePayoutLink: (withdrawalId) => request(`/wallet/withdrawals/${withdrawalId}/payout-link`, { method: "POST" }),
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

export const authorApi = {
  // Create/update send multipart form data — featured images, thumbnails, and
  // uploaded video files ride along as real files, not URL strings.
  createArticle: (formData) => requestForm("/articles", { formData }),
  createBlog: (formData) => requestForm("/blogs", { formData }),
  createVideo: (formData) => requestForm("/videos", { formData }),
  listCategories: () => request("/categories"),

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
  listVisibilitySettings: () => request("/admin/ui-visibility"),
  create: (payload) => request("/categories", { method: "POST", body: typeof payload === "string" ? { name: payload } : payload }),
  updateContent: (id, content) => request(`/categories/${id}/content`, { method: "PATCH", body: { content } }),
  setVisibility: (id, isVisible) => request(`/categories/${id}/visibility`, { method: "PATCH", body: { isVisible } }),
  setSectionVisibility: (key, isVisible) => request(`/admin/ui-sections/${encodeURIComponent(key)}/visibility`, { method: "PATCH", body: { isVisible } }),
  remove: (id) => request(`/categories/${id}`, { method: "DELETE" }),
};

export const policiesApi = {
  list: () => request("/policies"),
  listForRegistration: () => request("/policies/registration", { notifyError: false }),
  listForAdmin: () => request("/policies/manage"),
  getBySlug: (slug) => request(`/policies/${encodeURIComponent(slug)}`, { notifyError: false }),
  create: (payload) => request("/policies", { method: "POST", body: payload }),
  update: (id, payload) => request(`/policies/${id}`, { method: "PATCH", body: payload }),
  remove: (id) => request(`/policies/${id}`, { method: "DELETE" }),
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
  updateHomeWidget: (key, data) => request(`/admin/reference-data/home-widgets/${encodeURIComponent(key)}`, { method: "PUT", body: { data } }),
  updatePageProfiles: (profiles) => request("/admin/reference-data/page-profiles", { method: "PUT", body: { profiles } }),
};

export const pollApi = {
  vote: (optionIndex) => request("/poll/vote", { method: "POST", body: { optionIndex } }),
};

export const applicationsApi = {
  submit: (formData) => requestForm("/applications", { formData }),
  myStatus: (role) => request(`/applications/mine?role=${encodeURIComponent(role)}`, { notifyError: false }),
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
