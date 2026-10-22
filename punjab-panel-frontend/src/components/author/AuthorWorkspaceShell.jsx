"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, hasAnyPermission, hasPermission } from "@/lib/permissions";
import { mediaUrl } from "@/lib/api";
import { useAdminSite } from "@/context/AdminSiteContext";
import { useRouter } from "next/navigation";

const STAFF_ROLES = ["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN", "INVESTOR"];
const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");
const ROLE_LABELS = { AUTHOR: "Author", EDITOR: "Editor", ADMIN: "Admin", SUBADMIN: "Subadmin", INVESTOR: "Investor" };

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/author/dashboard", icon: "fa-gauge-high", permission: PERMISSIONS.DASHBOARD },
      { label: "My Content", href: "/author/content", icon: "fa-folder-open", permission: PERMISSIONS.MY_CONTENT },
      { label: "Task Management", href: "/author/task-management", icon: "fa-list-check", permissions: [PERMISSIONS.MANAGE_TASK_MANAGEMENT, PERMISSIONS.VIEW_TASKS] },
      { label: "Top Content", href: "/author/top-content", icon: "fa-ranking-star", permission: PERMISSIONS.VIEW_TOP_CONTENT },
      { label: "Analytics", href: "/author/analytics", icon: "fa-chart-line", permission: PERMISSIONS.VIEW_AUDIENCE_ANALYTICS },
      { label: "Wallet", href: "/author/wallet", icon: "fa-wallet", roles: ["AUTHOR", "EDITOR"] },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "New Article", href: "/author/create/article", icon: "fa-newspaper", permission: PERMISSIONS.CREATE_ARTICLE },
      { label: "New Blog", href: "/author/create/blog", icon: "fa-pen-nib", permission: PERMISSIONS.CREATE_BLOG, feature: "feature_blogs" },
      { label: "New Video", href: "/author/create/video", icon: "fa-video", permission: PERMISSIONS.CREATE_VIDEO, feature: "feature_videos" },
    ],
  },
  {
    label: "Editorial Tools",
    items: [
      { label: "Review Queue", href: "/author/review", icon: "fa-clipboard-check", permission: PERMISSIONS.REVIEW_CONTENT },
      { label: "Content History", href: "/author/history", icon: "fa-clock-rotate-left", permission: PERMISSIONS.CONTENT_HISTORY },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/author/users", icon: "fa-users", permission: PERMISSIONS.MANAGE_USERS },
      { label: "Notifications", href: "/author/notifications", icon: "fa-bell", roles: ["ADMIN"] },
      { label: "Donations", href: "/author/donations", icon: "fa-hand-holding-heart", roles: ["ADMIN"] },
      { label: "Subscriptions", href: "/author/subscriptions", icon: "fa-crown", roles: ["ADMIN"] },
      { label: "Subscription Plans", href: "/author/subscription-plans", icon: "fa-tags", roles: ["ADMIN"] },
      { label: "Investor Applications", href: "/author/investor-applications", icon: "fa-hand-holding-dollar", roles: ["ADMIN"] },
      { label: "Team Members", href: "/author/team", icon: "fa-users-gear", permission: PERMISSIONS.TEAM_MEMBERS },
      { label: "Website Settings", href: "/author/websites", icon: "fa-globe", permission: PERMISSIONS.MANAGE_WEBSITES },
      { label: "Categories", href: "/author/categories", icon: "fa-folder-tree", permission: PERMISSIONS.MANAGE_CATEGORIES },
      { label: "Policies", href: "/author/policies", icon: "fa-scale-balanced", permission: PERMISSIONS.MANAGE_POLICIES, feature: "feature_policies" },
      { label: "Comments", href: "/author/comments", icon: "fa-comments", permission: PERMISSIONS.MANAGE_COMMENTS, feature: "feature_comments" },
      { label: "Deleted Items", href: "/author/deleted-items", icon: "fa-trash-can-arrow-up", permission: PERMISSIONS.MANAGE_DELETED_ITEMS },
      { label: "Posting Limits", href: "/author/posting-limits", icon: "fa-gauge-high", permission: PERMISSIONS.MANAGE_POSTING_LIMITS },
      { label: "Site Data", href: "/author/site-data", icon: "fa-database", permission: PERMISSIONS.MANAGE_SITE_DATA },
      { label: "Website Pages", href: "/author/pages", icon: "fa-file-lines", permission: PERMISSIONS.SITE_PAGE_PROFILES },
      { label: "Site Management", href: "/author/site-management", icon: "fa-sliders", permission: PERMISSIONS.MANAGE_SITE_MANAGEMENT },
      { label: "Advertisements", href: "/author/ads", icon: "fa-rectangle-ad", permission: PERMISSIONS.MANAGE_ADS },
      { label: "Careers", href: "/author/career", icon: "fa-briefcase", permission: PERMISSIONS.MANAGE_CAREERS, feature: "feature_careers" },
      { label: "Withdrawal Requests", href: "/author/withdrawals", icon: "fa-hand-holding-dollar", permission: PERMISSIONS.MANAGE_WITHDRAWALS },
      { label: "Wallet & Points", href: "/author/wallet-admin", icon: "fa-money-check-dollar", permissions: [PERMISSIONS.MANAGE_WALLETS, PERMISSIONS.MANAGE_POINT_RATES] },
    ],
  },
];

const ROLE_GROUP_ORDER = {
  ADMIN: ["Workspace", "Administration", "Editorial Tools", "Create"],
  SUBADMIN: ["Workspace", "Administration", "Editorial Tools", "Create"],
  AUTHOR: ["Workspace", "Create", "Editorial Tools", "Administration"],
  EDITOR: ["Workspace", "Editorial Tools", "Create", "Administration"],
};

function visibleNavGroups(user, features = {}) {
  const order = ROLE_GROUP_ORDER[user.role] || NAV_GROUPS.map((group) => group.label);
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (!item.roles || item.roles.includes(user.role)) &&
        (!item.feature || features[item.feature] !== false) &&
        (!item.permission || hasPermission(user, item.permission)) &&
        (!item.permissions || hasAnyPermission(user, item.permissions))
      ),
    }))
    .filter((group) => group.items.length)
    .sort((left, right) => order.indexOf(left.label) - order.indexOf(right.label));
}

function isCurrentPath(pathname, href) {
  if (href === "/author/content") return pathname === href || pathname.startsWith("/author/edit/") || pathname.startsWith("/author/view/");
  return pathname === href;
}

function Sidebar({ user, logout, pathname, activeSiteId, activeSite, websites, features, setActiveSiteId, onNavigate }) {
  const initials = (user.name || user.role).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const router = useRouter();


    const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-full flex-col bg-primary text-on-primary">
      <Link href="/author/dashboard" onClick={onNavigate} className="flex items-center gap-3 border-b border-white/15 px-5 py-5">
        <span><img src={activeSite?.icon_url ? mediaUrl(activeSite.icon_url) : "/globe.svg"} alt="" className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary object-contain text-on-secondary" /></span>
        <span><span className="block font-headline-md text-base">Editorial Desk</span><span className="text-[11px] uppercase tracking-[0.16em] text-white/65">{activeSite?.name || "Punjab Politics"}</span></span>
      </Link>
      <div className="border-b border-white/15 px-4 py-4">
        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Active website</label>
        {user.role === "ADMIN" && websites.length > 1 ? <select value={activeSiteId} onChange={(event) => setActiveSiteId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-sm font-semibold text-primary outline-none"><option value="" disabled>Select website</option>{websites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select> : <div className="mt-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white">{activeSite?.name || "Assigned website"}</div>}
        <p className="mt-2 text-[10px] leading-4 text-white/55">All administration actions below apply to this website.</p>
      </div>
      <nav aria-label="Panel navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {visibleNavGroups(user, features).map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{group.label}</p>
            <div className="space-y-1">{group.items.map((item) => {
              const active = isCurrentPath(pathname, item.href);
              return <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-white text-primary" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                <span className="flex h-7 w-7 items-center justify-center"><i className={`fa-solid ${item.icon} text-xs`} /></span>{item.label}
              </Link>;
            })}</div>
          </div>
        ))}
        {hasPermission(user, PERMISSIONS.MANAGE_SERVICES) && activeSite?.services_enabled && [activeSite].map((site) => (
          <div key={`website-${site.id}`} className="mb-5">
            <p className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50"><i className="fa-solid fa-globe" />{site.name}</p>
            <div className="space-y-1">
              <Link href="/author/services" onClick={onNavigate} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname === "/author/services" ? "bg-white text-primary" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                <span className="flex h-7 w-7 items-center justify-center"><i className="fa-solid fa-handshake text-xs" /></span>Services
              </Link>
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/15 p-4">
       <button type="button" onClick={handleLogout} className=" px-3 py-2 text-sm text-on-primary flex items-center gap-2">
          <i className="fa-solid fa-sign-out-alt" /> Log out
        </button>

        <a href={activeSite?.domain ? `https://${activeSite.domain}` : PUBLIC_SITE_URL} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"><i className="fa-solid fa-arrow-up-right-from-square" />Open {activeSite?.name || "website"}</a>
      </div>
    </div>
  );
}

export default function AuthorWorkspaceShell({ children }) {
  const { user, loading , logout} = useAuth();
  const pathname = usePathname();
  const { sites: websites, activeSiteId, activeSite, features, setActiveSiteId } = useAdminSite();
  const [open, setOpen] = useState(false);
  const showTools = !loading && Boolean(user) && STAFF_ROLES.includes(user.role) && pathname.startsWith("/author");

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener("open-workspace-menu", openMenu);
    return () => window.removeEventListener("open-workspace-menu", openMenu);
  }, []);

  if (!showTools) return children;
  return (
    <div className="workspace-shell flex min-h-screen flex-col lg:flex-row">
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-[220] hidden h-screen w-72 overflow-hidden shadow-xl lg:block"><Sidebar user={user} pathname={pathname} activeSiteId={activeSiteId} activeSite={activeSite} websites={websites} features={features} setActiveSiteId={setActiveSiteId} /></aside>
      {open && <div className="fixed inset-0 z-[230] lg:hidden">
        <button type="button" aria-label="Close workspace menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55" />
        <aside className="absolute inset-y-0 left-0 w-72 max-w-[86vw] shadow-2xl"><Sidebar user={user} logout={logout} pathname={pathname} activeSiteId={activeSiteId} activeSite={activeSite} websites={websites} features={features} setActiveSiteId={setActiveSiteId} onNavigate={() => setOpen(false)} /></aside>
      </div>}
      <div className="workspace-main relative flex min-h-screen min-w-0 flex-1 flex-col lg:ml-72 lg:w-[calc(100%-18rem)]"><div key={activeSiteId || "site"} className="contents">{children}</div></div>
    </div>
  );
}
