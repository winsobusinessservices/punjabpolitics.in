"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useIsClient } from "@/hooks/useIsClient";
import SearchBox from "@/components/search/SearchBox";
import Link from "next/link";
import { PANEL_SITE_URL } from "@/lib/env";
import { slugify } from "@/lib/slugify";
import { usePremium } from "@/lib/usePremium";
import PremiumBadge from "@/components/common/PremiumBadge";

const CONTRIBUTOR_ROLES = ["AUTHOR", "EDITOR", "ADMIN"];
const MODERATOR_ROLES = ["EDITOR", "ADMIN"];

function NavLinks({ pathname, onClose, links = [], isPremium = false }) {
  return (
    <section className=" mb-8 bg-surface-container-low p-4 rounded-lg ">
      <h3 className="font-headline-md text-primary text-lg mb-4 border-b border-outline-variant/30 pb-2 tracking-wide">
        Menu
      </h3>
      <ul className="space-y-3 font-body-md text-on-surface-variant">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <li key={link.label}>
              <Link
                href={link.href}
                onClick={onClose}
                className={
                  isActive
                    ? "text-primary font-bold underline"
                    : "hover:text-primary transition-colors duration-300 hover:underline"
                }
              >
                {link.href === "/premium" && <PremiumBadge variant="icon" className="mr-1.5 text-xs" />}
                {link.label}
              </Link>
              {link.children?.length > 0 && (
                <ul className="mt-2 space-y-2 border-l border-outline-variant/40 pl-4 text-sm">
                  {link.children.map((child) => (
                    <li key={child.href}>
                      <Link href={child.href} onClick={onClose} className={pathname === child.href ? "text-primary font-bold underline" : "hover:text-primary transition-colors duration-300 hover:underline"}>
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {!isPremium && (
          <li>
            <Link href="/subscription" onClick={onClose} className="inline-flex items-center gap-1.5 font-semibold text-secondary transition-colors hover:underline">
              <PremiumBadge variant="icon" className="text-xs" /> Get Premium
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

function CategoryList({ title, items, onClose, featureVisibility = {}, managedPages = {} }) {
  const visibleItems = items.filter((item) => {
    if (typeof item !== "string" && item.feature && featureVisibility[item.feature] === false) return false;
    const label = typeof item === "string" ? item : item.label;
    const href = typeof item === "string" ? `/${slugify(label)}` : item.href;
    return managedPages[href.replace(/^\//, "")]?.enabled !== false;
  });
  return (
    <section className="mb-8 bg-surface-container-low p-4 rounded-lg">
      <h3 className="font-headline-md text-primary text-lg mb-4 border-b border-outline-variant/30 pb-2 tracking-wide">
        {title}
      </h3>
      <ul className="space-y-3 font-body-md text-on-surface-variant">
        {visibleItems.map((item) => {
          const label = typeof item === "string" ? item : item.label;
          const href = typeof item === "string" ? null : item.href;
          return (
            <li key={label}>
              {href ? (
                <Link href={href} onClick={onClose} className="hover:text-primary transition-colors duration-300 hover:underline">
                  {label}
                </Link>
              ) : (
                <Link href={`/${slugify(label)}`} onClick={onClose} className="hover:text-primary transition-colors duration-300 hover:underline">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
        <li className="pt-2">
          <Link href="/more" onClick={onClose} className="group text-surface-tint font-label-sm flex items-center gap-1 hover:underline">
            VIEW ALL <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

const ROLE_LABEL = { AUTHOR: "Author", EDITOR: "Editor", ADMIN: "Admin", INVESTOR: "Investor" };

// Investors get a single link into their dashboard in the panel — none
// of the create/manage tools AuthorTools below renders for everyone else.
function InvestorLink({ onClose }) {
  return (
    <section className="mb-8 bg-surface-container-low p-4 rounded-lg">
      <ul className="space-y-3 font-body-md text-on-surface-variant">
        <li>
          <a
            href={`${PANEL_SITE_URL}/author/dashboard`}
            onClick={onClose}
            className="group text-primary font-label-sm flex items-center gap-1 hover:underline"
          >
            INVESTOR DASHBOARD <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
          </a>
        </li>
      </ul>
    </section>
  );
}

function AuthorTools({ onClose, isModerator, isAdmin, canUseWallet, roleLabel, videosEnabled }) {
  return (
    <section className="mb-8 bg-surface-container-low p-4 rounded-lg ">
      <h3 className="font-headline-md text-primary text-lg mb-4 border-b border-outline-variant/30 pb-2 tracking-wide">
        {roleLabel} Tools
      </h3>
      <ul className="space-y-3 font-body-md text-on-surface-variant">
        <li>
          <Link
            href="/author/create/article"
            onClick={onClose}
            className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
          >
            <i className="fa-solid fa-newspaper w-4" /> Create Article
          </Link>
        </li>
        <li>
          <Link
            href="/author/create/blog"
            onClick={onClose}
            className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
          >
            <i className="fa-solid fa-pen-nib w-4" /> Create Blog
          </Link>
        </li>
        {videosEnabled && (
          <li>
            <Link
              href="/author/create/video"
              onClick={onClose}
              className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
            >
              <i className="fa-solid fa-video w-4" /> Create Video
            </Link>
          </li>
        )}
        <li>
          <Link
            href="/author/content"
            onClick={onClose}
            className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
          >
            <i className="fa-solid fa-list w-4" /> My Content
          </Link>
        </li>
        {canUseWallet && (
          <li>
            <Link
              href="/author/wallet"
              onClick={onClose}
              className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
            >
              <i className="fa-solid fa-wallet w-4" /> Wallet
            </Link>
          </li>
        )}
        {isModerator && (
          <>
            <li>
              <Link href="/author/site-data" onClick={onClose} className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline">
                <i className="fa-solid fa-database w-4" /> Manage Site Data
              </Link>
            </li>
            <li>
              <Link
                href="/author/review"
                onClick={onClose}
                className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
              >
                <i className="fa-solid fa-clipboard-check w-4" /> Review Queue
              </Link>
            </li>
            <li>
              <Link
                href="/author/history"
                onClick={onClose}
                className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
              >
                <i className="fa-solid fa-clock-rotate-left w-4" /> Content History
              </Link>
            </li>
          </>
        )}
        {isAdmin && (
          <>
            <li>
              <Link href="/author/categories" onClick={onClose} className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline">
                <i className="fa-solid fa-folder-tree w-4" /> Manage Categories
              </Link>
            </li>
            <li>
              <Link href="/author/policies" onClick={onClose} className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline">
                <i className="fa-solid fa-scale-balanced w-4" /> Manage Policies
              </Link>
            </li>
            <li>
            <Link
              href="/author/team"
              onClick={onClose}
              className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
            >
              <i className="fa-solid fa-user-plus w-4" /> Add Team Member
            </Link>
          </li>
            <li>
            <Link
              href="/author/career"
              onClick={onClose}
              className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline"
            >
              <i className="fa-solid fa-briefcase"></i> Create Job/ View Applicants
            </Link>
          </li>
            <li>
              <Link href="/author/wallet-admin" onClick={onClose} className="flex items-center gap-2 hover:text-primary transition-colors duration-300 hover:underline">
                <i className="fa-solid fa-money-check-dollar w-4" /> Wallet Access
              </Link>
            </li>
          </>

        )}
        <li className="pt-2 border-t border-outline-variant/20">
          <Link
            href="/author/dashboard"
            onClick={onClose}
            className="group text-primary font-label-sm flex items-center gap-1 hover:underline"
          >
            {roleLabel.toUpperCase()} DASHBOARD{" "}
            <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

export default function MobileMenu({ open, onClose, navLinks = [], featureVisibility = {}, managedPages = {}, siteCategories = [], siteNavigation = { more: [], legal: [] } }) {
  const mounted = useIsClient();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const canManageContent = user && CONTRIBUTOR_ROLES.includes(user.role);
  const isModerator = user && MODERATOR_ROLES.includes(user.role);
  const isAdmin = user?.role === "ADMIN";
  const isInvestor = user?.role === "INVESTOR";
  const canUseWallet = ["AUTHOR", "EDITOR"].includes(user?.role);
  const roleLabel = ROLE_LABEL[user?.role] || "Author";

  if (!mounted) return null;

  // Rendered via portal directly into <body> so this drawer escapes the
  // stacking context that Header's backdrop-blur creates — otherwise later
  // siblings like <main> paint over it regardless of z-index.
  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-[200] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-surface z-[210] transition-transform duration-300 overflow-y-auto shadow-2xl flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-primary text-on-primary">
          <h2 className="font-display-lg text-2xl tracking-tight">Categories</h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-6">
          <SearchBox
            onNavigate={onClose}
            placeholder="Search politicians, parties, states..."
            wrapperClassName="mb-6"
            inputClassName="w-full pr-3 py-2 border border-outline-variant/40 rounded-full bg-surface-container-low text-on-surface text-sm focus:border-primary focus:outline-none font-body-md"
          />

          <NavLinks pathname={pathname} onClose={onClose} links={navLinks} isPremium={isPremium} />

          {canManageContent && (
            <AuthorTools
              onClose={onClose}
              isModerator={isModerator}
              isAdmin={isAdmin}
              canUseWallet={canUseWallet}
              roleLabel={roleLabel}
              videosEnabled={featureVisibility.feature_videos !== false}
            />
          )}

          {isInvestor && <InvestorLink onClose={onClose} />}

          {siteCategories.length > 0 && <CategoryList title="Website Categories" items={siteCategories.map((category) => ({ label: category.name, href: `/category/${category.slug}` }))} onClose={onClose} featureVisibility={featureVisibility} managedPages={managedPages} />}

          <CategoryList title="More" items={siteNavigation.more || []} onClose={onClose} featureVisibility={featureVisibility} managedPages={managedPages} />

          <div className="mb-6 flex flex-col justify-center items-center  text-lg font-display-lg text-on-surface-variant tracking-tight">
            {(siteNavigation.legal || []).filter((item) => (!item.feature || featureVisibility[item.feature] !== false) && (!item.pageKey || managedPages[item.pageKey]?.enabled !== false)).map((i) => (
              <Link
                key={i.label}
                href={i.href}
                className=" font-label-md mb-3 text-on-surface-variant hover:text-primary transition-all px-1 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-0 hover:after:w-1/2 after:bg-primary after:transition-all after:duration-300"
              >
                {i.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
