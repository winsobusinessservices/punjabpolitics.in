"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authorApi, authApi, walletApi } from "@/lib/api";
import { SkeletonBlock, SkeletonText } from "@/components/common/Skeleton";
import { DashboardRowsSkeleton } from "@/components/common/PageSkeletons";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { useAdminSite } from "@/context/AdminSiteContext";
import DashboardContentCharts from "@/components/author/DashboardContentCharts";
import EmptyState from "@/components/common/EmptyState";

const CREATE_CARDS = [
  { type: "article", label: "Article", icon: "fa-newspaper" },
  { type: "blog", label: "Blog", icon: "fa-pen-nib" },
  { type: "video", label: "Video", icon: "fa-video" },
];

const TYPE_ICON = {
  ARTICLE: "fa-newspaper",
  BLOG: "fa-pen-nib",
  VIDEO: "fa-video",
};

const STATUS_BADGE = {
  DRAFT: "bg-outline-variant text-on-surface",
  PENDING: "bg-yellow-500 text-black",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-error text-on-error",
};

// Only approved (published) work earns points — draft/pending/rejected count
// toward the totals above but not here, so points track published output.
const DEFAULT_POINTS_PER_TYPE = { ARTICLE: 10, BLOG: 10, VIDEO: 5 };

function StatTile({ label, value, icon }) {
  return (
    <div className="p-4 sm:p-5 bg-surface rounded-xl border border-outline-variant/25 flex flex-wrap items-center gap-3 shadow-sm">
      <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <i className={`fa-solid ${icon} text-primary`} />
      </span>
      <div>
        {/* font-body-md is the sans (Inter) token — stat values stay sans
            per convention, never the site's serif display face. */}
        <p className="font-body-md text-2xl font-semibold text-on-surface leading-tight">{value}</p>
        <p className="font-label-md text-xs text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

function PointsCard({ points, approvedByType, rewardPoints, role }) {
  return (
    <div className="p-6 bg-gradient-to-br from-primary to-primary-container rounded-lg text-on-primary flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
      <div>
        <p className="font-label-md text-xs uppercase tracking-widest text-on-primary/80 mb-1">Collected Points</p>
        {/* Hero figure: sans, ≥48px, exactly one per view. */}
        <p className="font-body-lg text-5xl font-bold">{points.toLocaleString()}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm font-body-md text-on-primary/90 sm:border-l sm:border-white/20 sm:pl-8">
        {role === "EDITOR" ? (
          <>
            <span>Includes points earned for approving Author posts.</span>
            <span>Open Wallet to see every approval reward.</span>
          </>
        ) : (
          <>
            <span>{approvedByType.ARTICLE} approved article{approvedByType.ARTICLE === 1 ? "" : "s"} × {rewardPoints.ARTICLE} pts</span>
            <span>{approvedByType.BLOG} approved blog{approvedByType.BLOG === 1 ? "" : "s"} × {rewardPoints.BLOG} pts</span>
            <span>{approvedByType.VIDEO} approved video{approvedByType.VIDEO === 1 ? "" : "s"} × {rewardPoints.VIDEO} pts</span>
          </>
        )}
      </div>
    </div>
  );
}

const ROLE_LABEL = { AUTHOR: "Author", EDITOR: "Editor", ADMIN: "Admin", SUBADMIN: "Subadmin", INVESTOR:"Investor" };

export default function AuthorDashboardClient() {
  const { user } = useAuth();
  const { activeSite, activeSiteId } = useAdminSite();
  const isAdmin = user?.role === "ADMIN";
  const isInvestor = user?.role === "INVESTOR";
  const roleLabel = ROLE_LABEL[user?.role] || "Author";
  const canReview = hasPermission(user, PERMISSIONS.REVIEW_CONTENT);
  const canViewHistory = hasPermission(user, PERMISSIONS.CONTENT_HISTORY);
  const canViewOwnContent = hasPermission(user, PERMISSIONS.MY_CONTENT);
  const canManageSiteData = hasPermission(user, PERMISSIONS.MANAGE_SITE_DATA);
  const canManageTeam = hasPermission(user, PERMISSIONS.TEAM_MEMBERS);
  const canManageCategories = hasPermission(user, PERMISSIONS.MANAGE_CATEGORIES);
  const visibleCreateCards = CREATE_CARDS.filter((card) =>
    hasPermission(user, {
      article: PERMISSIONS.CREATE_ARTICLE,
      blog: PERMISSIONS.CREATE_BLOG,
      video: PERMISSIONS.CREATE_VIDEO,
    }[card.type])
  );
  const canAccessContent = canViewOwnContent || canViewHistory || canReview || visibleCreateCards.length > 0 || isAdmin || isInvestor;
  const [posts, setPosts] = useState([]);
  const [userCounts, setUserCounts] = useState({ total: 0, authors: 0, editors: 0, subadmins: 0 });
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [walletPoints, setWalletPoints] = useState(null);
  const [rewardPoints, setRewardPoints] = useState(DEFAULT_POINTS_PER_TYPE);
  const [error, setError] = useState("");

  // GET /:resource is always self-scoped now (own content only, regardless
  // of role) — an admin's (and, read-only, an investor's) dashboard should
  // reflect everything they actually have access to, so it uses the
  // moderator/investor-only history endpoint (every author, every status)
  // instead of the personal one everyone else gets.
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const request = !canAccessContent
        ? Promise.resolve([])
        : isAdmin || isInvestor || canViewHistory || canReview
          ? authorApi.listAllHistory({ siteId: activeSiteId })
          : authorApi.listAllTypes();
      request
        .then((items) => { if (active) setPosts(items); })
        .catch((err) => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeSiteId, canAccessContent, canReview, canViewHistory, isAdmin, isInvestor]);

  // Site-wide registered account totals for admin and investor dashboards.
  useEffect(() => {
    if (!isInvestor && !isAdmin) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setUsersLoading(true);
      authApi
        .listUsers()
        .then((data) => {
          if (!active) return;
          const users = data.users || [];
          setUserCounts({
            total: users.length,
            authors: users.filter((u) => u.role === "AUTHOR").length,
            editors: users.filter((u) => u.role === "EDITOR").length,
            subadmins: users.filter((u) => u.role === "SUBADMIN").length,
          });
        })
        .catch((err) => { if (active) setError(err.message); })
        .finally(() => { if (active) setUsersLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeSiteId, isInvestor, isAdmin]);

  useEffect(() => {
    if (!["AUTHOR", "EDITOR"].includes(user?.role)) return;
    walletApi.getWallet()
      .then((data) => {
        setWalletPoints(data.wallet.summary.lifetimeEarnedPoints);
        setRewardPoints(data.wallet.rewardPoints || DEFAULT_POINTS_PER_TYPE);
      })
      .catch((err) => setError(err.message));
  }, [user?.role]);

  const typeCounts = { ARTICLE: 0, BLOG: 0, VIDEO: 0 };
  const statusCounts = { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
  const approvedByType = { ARTICLE: 0, BLOG: 0, VIDEO: 0 };

  posts.forEach((post) => {
    typeCounts[post.type] = (typeCounts[post.type] || 0) + 1;
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
    if (post.status === "APPROVED") approvedByType[post.type] = (approvedByType[post.type] || 0) + 1;
  });

  const calculatedPoints = Object.entries(approvedByType).reduce(
    (sum, [type, count]) => sum + count * rewardPoints[type],
    0
  );
  const totalPoints = walletPoints ?? calculatedPoints;

  const recentPosts = [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const pendingReviewCount = posts.filter((post) => post.status === "PENDING" && !post.scheduled_publish_at).length;

  return (
    <div className="max-w-full mx-auto px-4 md:px-16 py-10">
      <h1 className="font-display-lg text-3xl text-primary mb-2">{roleLabel} Dashboard</h1>
      {activeSite?.name && <p className="mb-2 text-sm font-semibold text-secondary">Showing data for {activeSite.name}</p>}
      <p className="font-body-md text-on-surface-variant mb-8">
        {isInvestor
          ? "A read-only business view of publishing volume, editorial capacity, and content outcomes."
          : isAdmin
            ? "Site-wide overview of every author's articles, blogs, and videos, at every stage."
            : canManageSiteData || canManageTeam
              ? "Manage the site data and team tools included in your assigned privileges."
              : "Create new content, or manage everything you've already submitted."}
      </p>

      {canReview && !loading && (
        <Link
          href="/author/review"
          className={`flex items-center gap-3 p-5 rounded-lg border-2 transition-all mb-8 ${
            pendingReviewCount > 0
              ? "border-yellow-500/50 bg-yellow-500/10 hover:border-yellow-500"
              : "border-outline-variant/30 bg-surface-container-low hover:border-primary/50"
          }`}
        >
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              pendingReviewCount > 0 ? "bg-yellow-500 text-black" : "bg-green-600 text-white"
            }`}
          >
            <i className={`fa-solid ${pendingReviewCount > 0 ? "fa-clipboard-check" : "fa-circle-check"}`} />
          </span>
          <div className="flex-grow">
            <h3 className="font-headline-md text-base text-on-surface">Review Queue</h3>
            <p className="font-body-md text-xs text-on-surface-variant">
              {pendingReviewCount > 0
                ? `${pendingReviewCount} submission${pendingReviewCount === 1 ? "" : "s"} from authors waiting on your review`
                : "All caught up — nothing pending review"}
            </p>
          </div>
          <i className="fa-solid fa-arrow-right text-on-surface-variant" />
        </Link>
      )}

      {error && (
        <p className="text-sm text-error font-body-md mb-6" role="alert">
          {error}
        </p>
      )}

      {loading || ((isInvestor || isAdmin) && usersLoading) ? (
        <div aria-hidden="true" className="mb-8">
          {canAccessContent && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-20" />
            ))}
          </div>}
          <SkeletonBlock className="h-24 mb-8" />
          <SkeletonBlock className="h-32 mb-10" />
          <SkeletonText className="w-40 h-6 mb-4" />
          <DashboardRowsSkeleton count={3} />
        </div>
      ) : (
        <>
          {/* Totals */}
          {isAdmin && <section className="mb-6">
            <h2 className="mb-2 font-headline-lg text-xl text-primary">All-time totals</h2>
            <p className="mb-4 text-xs text-on-surface-variant">Registered accounts and content totals across all dates.</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Total Users" value={userCounts.total} icon="fa-users" />
              <StatTile label="Total Authors" value={userCounts.authors} icon="fa-pen-nib" />
              <StatTile label="Total Editors" value={userCounts.editors} icon="fa-user-tie" />
              <StatTile label="Total Subadmins" value={userCounts.subadmins} icon="fa-user-shield" />
            </div>
          </section>}
          {!isInvestor && canAccessContent && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatTile label={isAdmin || isInvestor ? "Total Posts" : "Total Posts"} value={posts.length} icon="fa-layer-group" />
            <StatTile label="Articles" value={typeCounts.ARTICLE} icon="fa-newspaper" />
            <StatTile label="Blogs" value={typeCounts.BLOG} icon="fa-pen-nib" />
            <StatTile label="Videos" value={typeCounts.VIDEO} icon="fa-video" />
          </div>}

          {/* Investor-only: site-wide user/approval totals — the whole
              reason this role has a dashboard at all. Read-only, no links. */}
          {isInvestor && (
            <>
            <section className="mb-8">
              <div className="mb-4">
                <h2 className="font-headline-lg text-xl text-primary">Platform Overview</h2>
                <p className="mt-1 text-xs text-on-surface-variant">Audience, publishing activity, and editorial team at a glance.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                <StatTile label="Total Posts" value={posts.length} icon="fa-layer-group" />
                <StatTile label="Total Users" value={userCounts.total} icon="fa-users" />
                <StatTile label="Total Authors" value={userCounts.authors} icon="fa-pen-nib" />
                <StatTile label="Total Editors" value={userCounts.editors} icon="fa-user-tie" />

              </div>
            </section>
            <section className="mb-8">
              <h2 className="mb-4 font-headline-lg text-xl text-primary">Content Performance</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              <StatTile label="Total Articles" value={typeCounts.ARTICLE} icon="fa-newspaper" />
              <StatTile label="Total Blogs" value={typeCounts.BLOG} icon="fa-pen-nib" />
              <StatTile label="Total Videos" value={typeCounts.VIDEO} icon="fa-video" />
              <StatTile label="Total Approved" value={statusCounts.APPROVED} icon="fa-circle-check" />
              <StatTile label="Total Rejected" value={statusCounts.REJECTED} icon="fa-circle-xmark" />
              </div>
            </section>
            </>
          )}

          {/* Collected points — a personal author incentive, so it's not
              shown for admin/investor, where it'd just be "everyone's points
              added up," not a meaningful number for anyone. */}
          {["AUTHOR", "EDITOR"].includes(user?.role) && (
            <div className="mb-8">
              <PointsCard points={totalPoints} approvedByType={approvedByType} rewardPoints={rewardPoints} role={user.role} />
            </div>
          )}

          {canAccessContent && !error && <DashboardContentCharts posts={posts} scope={isAdmin || isInvestor ? "Content available for the selected website." : canReview || canViewHistory ? "Content available within your assigned access." : "Your own articles, blogs, and videos."} />}
        </>
      )}

      {hasPermission(user, PERMISSIONS.VIEW_AUDIENCE_ANALYTICS) && <Link href="/author/analytics" className="mb-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary"><i className="fa-solid fa-chart-pie" aria-hidden="true" />View audience analytics</Link>}

      {/* Quick actions and Recent Posts are write-oriented (create, edit,
          review, navigate into individual posts) — Investors get totals
          only, per the role's read-only scope. */}
      {(visibleCreateCards.length > 0 || canViewOwnContent || canViewHistory || canManageSiteData || canManageTeam || canManageCategories) && (
        <>
          <h2 className="font-headline-lg text-primary text-xl mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {visibleCreateCards.map((card) => (
              <Link
                key={card.type}
                href={`/author/create/${card.type}`}
                className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container hover:border-primary/50 transition-all"
              >
                <span className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${card.icon}`} />
                </span>
                <div>
                  <h3 className="font-headline-md text-base text-on-surface">Create {card.label}</h3>
                  <p className="font-body-md text-xs text-on-surface-variant">New {card.label.toLowerCase()} draft</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {canViewOwnContent && <Link
              href="/author/content"
              className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-low hover:border-primary/50 transition-all"
            >
              <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-list" />
              </span>
              <div>
                <h3 className="font-headline-md text-base text-on-surface">My Content</h3>
                <p className="font-body-md text-xs text-on-surface-variant">
                  View, edit, delete, and submit your own articles, blogs, and videos
                </p>
              </div>
            </Link>}

            {canViewHistory && (
              <Link
                href="/author/history"
                className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-low hover:border-primary/50 transition-all"
              >
                <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-clock-rotate-left" />
                </span>
                <div>
                  <h3 className="font-headline-md text-base text-on-surface">Content History</h3>
                  <p className="font-body-md text-xs text-on-surface-variant">
                    Every author&apos;s content, at every stage, with full review history
                  </p>
                </div>
              </Link>
            )}

            {canManageSiteData && (
                <Link
                  href="/author/site-data"
                  className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-low hover:border-primary/50 transition-all"
                >
                  <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-database" />
                  </span>
                  <div>
                    <h3 className="font-headline-md text-base text-on-surface">Manage Site Data</h3>
                    <p className="font-body-md text-xs text-on-surface-variant">Politicians, biographies, parties, states, assemblies and Parliament</p>
                  </div>
                </Link>
            )}
            {canManageCategories && (
                <Link
                  href="/author/categories"
                  className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-low hover:border-primary/50 transition-all"
                >
                  <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-folder-tree" />
                  </span>
                  <div>
                    <h3 className="font-headline-md text-base text-on-surface">UI Visibility &amp; Categories</h3>
                    <p className="font-body-md text-xs text-on-surface-variant">Show or hide homepage sections and categories without deleting data</p>
                  </div>
                </Link>
            )}
            {canManageTeam && (
                <Link
                  href="/author/team"
                  className="flex items-center gap-3 p-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-low hover:border-primary/50 transition-all"
                >
                  <span className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-user-plus" />
                  </span>
                  <div>
                    <h3 className="font-headline-md text-base text-on-surface">Add Team Member</h3>
                    <p className="font-body-md text-xs text-on-surface-variant">
                      Create an Author, Editor, or Investor account with their required documents
                    </p>
                  </div>
                </Link>
            )}
          </div>

          {/* Recent posts */}
          {!loading && canAccessContent && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline-lg text-primary text-xl">{isAdmin ? "Recent Activity" : "Recent Posts"}</h2>
                <Link
                  href={isAdmin ? "/author/history" : "/author/content"}
                  className="font-label-sm text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  VIEW ALL <i className="fa-solid fa-arrow-right text-xs" />
                </Link>
              </div>

              {recentPosts.length === 0 ? (
                <EmptyState compact icon="fa-layer-group" title="No recent content for this website" description={isAdmin ? "Content created by the selected website's team will appear here." : "Create your first article, blog, or video to get started."} actionHref={!isAdmin && visibleCreateCards.length ? `/author/create/${visibleCreateCards[0].type}` : undefined} actionLabel={!isAdmin && visibleCreateCards.length ? `Create ${visibleCreateCards[0].label}` : undefined} />
              ) : (
                <div className="space-y-3">
                  {recentPosts.map((post) => (
                    <Link
                      key={`${post.type}-${post.id}`}
                      href={`/author/view/${post.type.toLowerCase()}/${post.id}${isAdmin ? "?from=history" : ""}`}
                      className="flex items-center gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/20 hover:border-primary/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <i className={`fa-solid ${TYPE_ICON[post.type]} text-primary`} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${STATUS_BADGE[post.status]}`}>
                            {post.status}
                          </span>
                          <span className="text-[10px] font-label-md text-on-surface-variant uppercase">{post.type}</span>
                          {isAdmin && post.author_name && (
                            <span className="text-[10px] font-body-md text-on-surface-variant">by {post.author_name}</span>
                          )}
                        </div>
                        <h3 className="font-headline-md text-sm text-on-surface truncate">{post.title}</h3>
                      </div>
                      <span className="text-xs font-body-md text-on-surface-variant flex-shrink-0">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
