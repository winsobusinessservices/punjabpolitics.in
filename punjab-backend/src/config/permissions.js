const PERMISSIONS = Object.freeze({
  DASHBOARD: "dashboard",
  MY_CONTENT: "my_content",
  CREATE_ARTICLE: "create_article",
  CREATE_BLOG: "create_blog",
  CREATE_VIDEO: "create_video",
  REVIEW_CONTENT: "review_content",
  CONTENT_HISTORY: "content_history",
  VIEW_TOP_CONTENT: "view_top_content",
  VIEW_AUDIENCE_ANALYTICS: "view_audience_analytics",
  TEAM_MEMBERS: "team_members",
  MANAGE_USERS: "manage_users",
  MANAGE_WEBSITES: "manage_websites",
  MANAGE_POLICIES: "manage_policies",
  MANAGE_COMMENTS: "manage_comments",
  MANAGE_DELETED_ITEMS: "manage_deleted_items",
  MANAGE_POSTING_LIMITS: "manage_posting_limits",
  MANAGE_SITE_MANAGEMENT: "manage_site_management",
  MANAGE_CATEGORIES: "manage_categories",
  MANAGE_CAREERS: "manage_careers",
  MANAGE_WALLETS: "manage_wallets",
  MANAGE_WITHDRAWALS: "manage_withdrawals",
  MANAGE_POINT_RATES: "manage_point_rates",
  MANAGE_SITE_DATA: "manage_site_data",
  MANAGE_SERVICES: "manage_services",
  MANAGE_ADS: "manage_ads",
  SITE_POLITICIANS: "site_politicians",
  SITE_PARTIES: "site_parties",
  SITE_STATES: "site_states",
  SITE_DISTRICTS: "site_districts",
  SITE_PARLIAMENT: "site_parliament",
  SITE_SCHEDULES: "site_schedules",
  SITE_VIDHAN_SABHAS: "site_vidhan_sabhas",
  SITE_HOME_WIDGETS: "site_home_widgets",
  SITE_WIDGET_BREAKING_NEWS: "site_widget_breaking_news",
  SITE_WIDGET_POLL: "site_widget_poll",
  SITE_WIDGET_ELECTION_RESULTS: "site_widget_election_results",
  SITE_WIDGET_OTHER: "site_widget_other",
  SITE_PAGE_PROFILES: "site_page_profiles",
  TASK_MANAGEMENT: "task_management",
  MANAGE_TASK_MANAGEMENT: "manage_task_management",
  VIEW_TASKS: "view_tasks",
  CREATE_TASKS: "create_tasks",
  EDIT_TASKS: "edit_tasks",
  DELETE_TASKS: "delete_tasks",
  ASSIGN_TASKS: "assign_tasks",
  UPDATE_TASK_STATUS: "update_task_status",
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  USER: [],
  AUTHOR: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.MY_CONTENT,
    PERMISSIONS.CREATE_ARTICLE,
    PERMISSIONS.CREATE_BLOG,
    PERMISSIONS.CREATE_VIDEO,
    PERMISSIONS.VIEW_TASKS,
    PERMISSIONS.UPDATE_TASK_STATUS,
  ],
  EDITOR: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.MY_CONTENT,
    PERMISSIONS.CREATE_ARTICLE,
    PERMISSIONS.CREATE_BLOG,
    PERMISSIONS.CREATE_VIDEO,
    PERMISSIONS.REVIEW_CONTENT,
    PERMISSIONS.CONTENT_HISTORY,
    PERMISSIONS.VIEW_TASKS,
    PERMISSIONS.UPDATE_TASK_STATUS,
  ],
  INVESTOR: [PERMISSIONS.DASHBOARD, PERMISSIONS.VIEW_TOP_CONTENT, PERMISSIONS.VIEW_AUDIENCE_ANALYTICS],
  SUBADMIN: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.REVIEW_CONTENT,
    PERMISSIONS.CONTENT_HISTORY,
    PERMISSIONS.TEAM_MEMBERS,
    PERMISSIONS.MANAGE_SITE_MANAGEMENT,
    PERMISSIONS.MANAGE_WALLETS,
    PERMISSIONS.MANAGE_WITHDRAWALS,
    PERMISSIONS.MANAGE_POINT_RATES,
    PERMISSIONS.MANAGE_SITE_DATA,
    PERMISSIONS.MANAGE_SERVICES,
    PERMISSIONS.MANAGE_ADS,
    PERMISSIONS.SITE_POLITICIANS,
    PERMISSIONS.SITE_PARTIES,
    PERMISSIONS.SITE_STATES,
    PERMISSIONS.SITE_DISTRICTS,
    PERMISSIONS.SITE_PARLIAMENT,
    PERMISSIONS.SITE_SCHEDULES,
    PERMISSIONS.SITE_VIDHAN_SABHAS,
    PERMISSIONS.SITE_HOME_WIDGETS,
    PERMISSIONS.SITE_WIDGET_BREAKING_NEWS,
    PERMISSIONS.SITE_WIDGET_POLL,
    PERMISSIONS.SITE_WIDGET_ELECTION_RESULTS,
    PERMISSIONS.SITE_WIDGET_OTHER,
    PERMISSIONS.SITE_PAGE_PROFILES,
    PERMISSIONS.MANAGE_TASK_MANAGEMENT,
  ],
  ADMIN: ALL_PERMISSIONS,
});

function normalizePermissions(value, role) {
  if (role === "ADMIN") return [...ALL_PERMISSIONS];
  if (value === null || value === undefined) return [...(ROLE_DEFAULT_PERMISSIONS[role] || [])];
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  const permissions = parsed.filter((permission) => ALL_PERMISSIONS.includes(permission));
  if (role === "SUBADMIN") {
    permissions.push(PERMISSIONS.REVIEW_CONTENT, PERMISSIONS.CONTENT_HISTORY, PERMISSIONS.MANAGE_SITE_MANAGEMENT);
  }
  // Authors and Editors can always see their tasks and update the status of their own.
  if (role === "AUTHOR" || role === "EDITOR") {
    permissions.push(PERMISSIONS.VIEW_TASKS, PERMISSIONS.UPDATE_TASK_STATUS);
  }
  // Investors keep access to Top Content and Audience analytics even with a saved permission list.
  if (role === "INVESTOR") {
    permissions.push(PERMISSIONS.VIEW_TOP_CONTENT, PERMISSIONS.VIEW_AUDIENCE_ANALYTICS);
  }
  return [...new Set(permissions)];
}

module.exports = { PERMISSIONS, ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, normalizePermissions };
