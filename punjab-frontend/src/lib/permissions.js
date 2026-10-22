export const PERMISSIONS = Object.freeze({
  DASHBOARD: "dashboard",
  MY_CONTENT: "my_content",
  CREATE_ARTICLE: "create_article",
  CREATE_BLOG: "create_blog",
  CREATE_VIDEO: "create_video",
  REVIEW_CONTENT: "review_content",
  CONTENT_HISTORY: "content_history",
  TEAM_MEMBERS: "team_members",
  MANAGE_CATEGORIES: "manage_categories",
  MANAGE_CAREERS: "manage_careers",
  MANAGE_WALLETS: "manage_wallets",
  MANAGE_POINT_RATES: "manage_point_rates",
  MANAGE_SITE_DATA: "manage_site_data",
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
});

export const PERMISSION_GROUPS = [
  {
    label: "Content",
    permissions: [
      [PERMISSIONS.DASHBOARD, "Dashboard"],
      [PERMISSIONS.MY_CONTENT, "My Content"],
      [PERMISSIONS.CREATE_ARTICLE, "Create articles"],
      [PERMISSIONS.CREATE_BLOG, "Create blogs"],
      [PERMISSIONS.CREATE_VIDEO, "Create videos"],
      [PERMISSIONS.REVIEW_CONTENT, "Approve or reject content"],
      [PERMISSIONS.CONTENT_HISTORY, "Content history"],
    ],
  },
  {
    label: "Administration",
    permissions: [
      [PERMISSIONS.TEAM_MEMBERS, "Create and manage team members"],
      [PERMISSIONS.MANAGE_CATEGORIES, "Manage categories"],
      [PERMISSIONS.MANAGE_CAREERS, "Jobs and career applications"],
      [PERMISSIONS.MANAGE_SITE_DATA, "Open Site Data"],
    ],
  },
  {
    label: "Wallet & Points",
    permissions: [
      [PERMISSIONS.MANAGE_WALLETS, "Enable or block withdrawals"],
      [PERMISSIONS.MANAGE_POINT_RATES, "Set content rewards and point values"],
    ],
  },
  {
    label: "Site Data",
    permissions: [
      [PERMISSIONS.SITE_POLITICIANS, "Politicians"],
      [PERMISSIONS.SITE_PARTIES, "Political parties"],
      [PERMISSIONS.SITE_STATES, "States and territories"],
      [PERMISSIONS.SITE_PARLIAMENT, "Lok Sabha and Rajya Sabha"],
      [PERMISSIONS.SITE_SCHEDULES, "Events and upcoming rallies"],
      [PERMISSIONS.SITE_VIDHAN_SABHAS, "Vidhan Sabhas"],
      [PERMISSIONS.SITE_HOME_WIDGETS, "All home widgets"],
      [PERMISSIONS.SITE_WIDGET_BREAKING_NEWS, "Breaking news widget"],
      [PERMISSIONS.SITE_WIDGET_POLL, "Poll of the day"],
      [PERMISSIONS.SITE_WIDGET_ELECTION_RESULTS, "Election results widget"],
      [PERMISSIONS.SITE_WIDGET_OTHER, "Other home widgets"],
      [PERMISSIONS.SITE_PAGE_PROFILES, "Rallies, speeches and election page profiles"],
    ],
  },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  AUTHOR: [PERMISSIONS.DASHBOARD, PERMISSIONS.MY_CONTENT, PERMISSIONS.CREATE_ARTICLE, PERMISSIONS.CREATE_BLOG, PERMISSIONS.CREATE_VIDEO],
  EDITOR: [PERMISSIONS.DASHBOARD, PERMISSIONS.MY_CONTENT, PERMISSIONS.CREATE_ARTICLE, PERMISSIONS.CREATE_BLOG, PERMISSIONS.CREATE_VIDEO, PERMISSIONS.REVIEW_CONTENT, PERMISSIONS.CONTENT_HISTORY],
  INVESTOR: [PERMISSIONS.DASHBOARD],
  SUBADMIN: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.TEAM_MEMBERS,
    PERMISSIONS.MANAGE_WALLETS,
    PERMISSIONS.MANAGE_POINT_RATES,
    PERMISSIONS.MANAGE_SITE_DATA,
    ...PERMISSION_GROUPS.find((group) => group.label === "Site Data").permissions.map(([permission]) => permission),
  ],
};

export function hasPermission(user, permission) {
  return user?.role === "ADMIN" || user?.permissions?.includes(permission);
}

export function hasAnyPermission(user, permissions = []) {
  return user?.role === "ADMIN" || permissions.some((permission) => user?.permissions?.includes(permission));
}
