"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useIsClient } from "@/hooks/useIsClient";
import { getManagedPages, getPoliticalCalendar, getPoliticalRallys, getUpcomingElections, getSiteHeaderSettings, getSectionVisibility, getSiteNavigation } from "@/features/news/news.api";
import { getCategoryDefinitions } from "@/features/news/news.api";
import SearchBox from "@/components/search/SearchBox";
import MobileMenu from "./MobileMenu";
import ProfileMenu from "./ProfileMenu";
import ChangePasswordModal from "@/components/auth/ChangePasswordModal";
import PremiumBadge from "@/components/common/PremiumBadge";
import { usePremium } from "@/lib/usePremium";
import HeaderWeather from "@/components/layout/HeaderWeather";
import { useSite } from "@/context/SiteContext";
import { mediaUrl } from "@/lib/api";


// Renders only after mount so the server-rendered markup (which has no
// notion of the visitor's clock) never mismatches the client's first paint.
// `now` is computed fresh at render time rather than stored in state — the
// effect only ever schedules a re-render (via the `tick` counter) or sets
// state from an async callback, never synchronously, so there's no
// setState-in-effect cascade to fix.




// A short date + title list beside the logo (events, rallies, elections).
// `className` decides where it shows, e.g. "hidden md:flex" or "flex md:hidden".
function ScheduleList({ title, href, load, className }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    load().then((data) => setItems(data.slice(0, 2))).catch(() => {});
  }, [load]);

  if (!items.length) return null;

  return (
    <Link href={href} className={`${className} flex-col gap-2 items-start group`}>
      <span className="flex items-center gap-2 font-headline-md text-base text-primary group-hover:underline">
        <i className="fa-solid fa-calendar-days" />
        {title}
      </span>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm font-body-md text-on-surface-variant">
          <span className="font-label-md text-xs text-on-primary bg-primary px-2.5 py-1 rounded-sm flex-shrink-0">
            {item.date}
          </span>
          <span className="truncate max-w-[240px] group-hover:text-primary transition-colors">{item.title}</span>
        </div>
      ))}
    </Link>
  );
}

const UpcomingEvents = ({ className }) => <ScheduleList title="Upcoming Events" href="/political-calendar" load={getPoliticalCalendar} className={className} />;
const UpcomingRallies = ({ className }) => <ScheduleList title="Upcoming Rallies" href="/political-rallies" load={getPoliticalRallys} className={className} />;
const UpcomingElections = ({ className }) => <ScheduleList title="Upcoming Elections" href="/elections" load={getUpcomingElections} className={className} />;

function HeaderCountdown({ countdown, fallback = null, mobile = false }) {
  const mounted = useIsClient();
  const [now, setNow] = useState(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);
  if (!mounted || now === null || !countdown?.enabled || !countdown.targetAt) return null;
  const remaining = new Date(countdown.targetAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return fallback;
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const units = [["Days", days], ["Hrs", hours], ["Min", minutes], ["Sec", seconds]];
  return (
    <Link href={countdown.link || "/elections"} className={`group w-full rounded-lg border border-primary/10 bg-surface-container-low p-2.5 transition-colors hover:border-primary/10 hover:bg-primary/5 ${mobile ? "flex md:hidden" : "hidden max-w-[19rem] md:block"} flex-col`}>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-headline-md text-sm text-primary"><i className="fa-solid fa-hourglass-half mr-2" />{countdown.title || "Election Results"}</span>
        <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white">Live</span>
      </span>
      <span className="mt-2 grid grid-cols-4 gap-1.5">
        {units.map(([label, value]) => <span key={label} className="rounded border border-outline-variant/25 bg-surface px-1 py-1.5 text-center"><strong className="block text-sm leading-none text-on-surface">{String(value).padStart(2, "0")}</strong><small className="mt-1 block text-[7px] uppercase tracking-wide text-on-surface-variant">{label}</small></span>)}
      </span>
      <span className="mt-2 flex items-center justify-end text-[9px] font-bold uppercase tracking-wide text-primary">{countdown.buttonLabel || "View results"}<i className="fa-solid fa-arrow-right ml-1.5 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
  );
}



// Desktop menu item with a dropdown. The menu bar scrolls horizontally (which
// would clip an absolutely positioned panel), so the panel is fixed-positioned
// from the item's on-screen position.
function NavDropdown({ link, className, children }) {
  const [rect, setRect] = useState(null);
  const closeTimer = useRef(null);
  const anchorRef = useRef(null);
  const open = () => {
    window.clearTimeout(closeTimer.current);
    setRect(anchorRef.current?.getBoundingClientRect() || null);
  };
  const close = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setRect(null), 120);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!rect) return undefined;
    const hide = () => setRect(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [rect]);

  return (
    <div ref={anchorRef} className="flex h-full items-center" onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close} onKeyDown={(event) => { if (event.key === "Escape") setRect(null); }}>
      <Link href={link.href} className={className} aria-haspopup="true" aria-expanded={Boolean(rect)}>
        {children}
        <i className="fa-solid fa-chevron-down ml-1.5 text-[9px]" aria-hidden="true" />
      </Link>
      {rect && (
        <div role="menu" className="fixed z-[200] min-w-48 rounded-lg border border-outline-variant/30 bg-surface py-2 shadow-lg" style={{ top: rect.bottom, left: rect.left }}>
          {link.children.map((child) => (
            <Link key={child.href} role="menuitem" href={child.href} onClick={() => setRect(null)} className="block whitespace-nowrap px-4 py-2 font-label-md text-sm text-on-surface-variant transition-colors hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary focus:outline-none">
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_HEADER_SETTINGS = {
  logoLayout: { left: ["rallies", "weather"], right: ["elections", "events"] },
  showOnMobile: { rallies: true, weather: false, elections: false, events: false },
  showUpcomingRallies: true,
  showWeather: true,
  showUpcomingEvents: true,
  showUpcomingElections: true,
  menuItems: [],
  countdown: { enabled: false },
};

const DESKTOP_ONLY = "hidden md:flex";
const MOBILE_ONLY = "flex md:hidden";

// One item beside the logo, for desktop (mobile=false) or phones (mobile=true).
// show* flags control desktop and tablet; showOnMobile controls phones.
function LogoSideItem({ id, settings, featureVisibility, mobile }) {
  const className = mobile ? MOBILE_ONLY : DESKTOP_ONLY;
  const ralliesEnabled = featureVisibility.political_rallys !== false;
  if (id === "rallies") {
    const showRallies = (mobile ? settings.showOnMobile?.rallies : settings.showUpcomingRallies !== false) && ralliesEnabled;
    const rallies = showRallies ? <UpcomingRallies className={className} /> : null;
    // The countdown takes the rallies slot; on phones it follows the rallies mobile switch.
    if (settings.countdown?.enabled && (!mobile || settings.showOnMobile?.rallies)) return <HeaderCountdown countdown={settings.countdown} fallback={rallies} mobile={mobile} />;
    return rallies;
  }
  if (mobile ? !settings.showOnMobile?.[id] : settings[{ weather: "showWeather", events: "showUpcomingEvents", elections: "showUpcomingElections" }[id]] === false) return null;
  if (id === "weather") return <HeaderWeather className={className} />;
  if (id === "events") return featureVisibility.political_calendar !== false ? <UpcomingEvents className={className} /> : null;
  if (id === "elections") return <UpcomingElections className={className} />;
  return null;
}

export default function Header({ showMasthead = true }) {
  const site = useSite();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isPremium } = usePremium();
  const [profileOpen, setProfileOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSettings, setHeaderSettings] = useState(DEFAULT_HEADER_SETTINGS);
  const [featureVisibility, setFeatureVisibility] = useState({});
  const [managedPages, setManagedPages] = useState({});
  const [siteCategories, setSiteCategories] = useState([]);
  const [siteNavigation, setSiteNavigation] = useState({ more: [], legal: [] });
  const profileButtonRef = useRef(null);

  useEffect(() => {
    getSiteHeaderSettings().then((settings) => setHeaderSettings((current) => ({ ...current, ...settings, showOnMobile: { ...current.showOnMobile, ...(settings.showOnMobile || {}) }, menuItems: Array.isArray(settings.menuItems) ? settings.menuItems : [], countdown: { ...current.countdown, ...(settings.countdown || {}) } }))).catch(() => {});
    getSectionVisibility().then(setFeatureVisibility).catch(() => {});
    getManagedPages().then(setManagedPages).catch(() => {});
    getCategoryDefinitions().then(setSiteCategories).catch(() => {});
    getSiteNavigation().then(setSiteNavigation).catch(() => {});
  }, []);

  const openProfileMenu = () => {
    setAnchorRect(profileButtonRef.current.getBoundingClientRect());
    setProfileOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };
    const visibleNavLinks = (headerSettings.menuItems || [])
    .filter((link) => link.enabled !== false && link.label && link.href && (!link.feature || featureVisibility[link.feature] !== false) && (!link.requiresServices || site.services_enabled))
    // The Premium menu item (opens /premium) is only for subscribers; everyone else gets the crown button (plans).
    .filter((link) => link.href !== "/premium" || isPremium)
    // Each item may carry a dropdown of enabled sub-items.
    .map((link) => ({ ...link, children: Array.isArray(link.children) ? link.children.filter((child) => child.enabled !== false && child.label && child.href) : [] }));

  return (
    <>
    {showMasthead && <header
      className="relative w-full bg-[#FEFEFE] shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
      style={{ zIndex: 185, backgroundColor: "#FEFEFE" }}
    >
      <div className="w-full bg-surface border-b border-outline-variant/30 py-4">
        <div className="max-w-full mx-auto px-4 md:px-16 grid grid-cols-3 items-center">
          <div className="flex flex-col items-start gap-3">
            {(headerSettings.logoLayout?.left || []).map((id) => <LogoSideItem key={id} id={id} settings={headerSettings} featureVisibility={featureVisibility} />)}
          </div>

          <div className="flex flex-col items-center gap-1.5 justify-self-center md:gap-2">
            <Link href="/" className="block">
              <Image src={site.logo_url ? mediaUrl(site.logo_url) : "/globe.svg"} alt={site.name} width={160} height={64} className="h-20 w-auto object-contain md:h-30" priority unoptimized={Boolean(site.logo_url)} />
            </Link>
            <p className="whitespace-nowrap font-label-md text-[15px] tracking-[0.08em] text-on-surface-variant sm:text-base">
              A Product By{" "}
              <a href="https://indianrajniti.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary transition-colors hover:text-secondary hover:underline">
                indianrajniti.in
              </a>
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 justify-self-end">
            {(headerSettings.logoLayout?.right || []).map((id) => <LogoSideItem key={id} id={id} settings={headerSettings} featureVisibility={featureVisibility} />)}
          </div>
        </div>
        {/* Phones: the side columns are too narrow, so mobile-enabled items stack under the logo. */}
        <div className="flex flex-col gap-3 px-4 empty:hidden md:hidden [&:not(:empty)]:pt-3">
          {[...(headerSettings.logoLayout?.left || []), ...(headerSettings.logoLayout?.right || [])].map((id) => <LogoSideItem key={id} id={id} settings={headerSettings} featureVisibility={featureVisibility} mobile />)}
        </div>
      </div>
    </header>}

      <nav
        className="sticky top-0 z-[190] isolate border-b border-outline-variant/30 bg-surface py-2 shadow-sm"
        style={{ position: "sticky", top: 0, zIndex: 190, backgroundColor: "#faf9f7" }}
      >
        <div className="max-w-full mx-auto px-4 md:px-16 gap-10 flex min-w-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary active:scale-95"
          >
            <i className="fa-solid fa-bars text-lg" aria-hidden="true" />
          </button>

          <div className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap lg:flex">
            {visibleNavLinks.map((link) => {
              const isActive = pathname === link.href || link.children.some((child) => pathname === child.href);
              const className = isActive
                ? "h-full flex items-center px-1 border-b-2 border-secondary text-primary font-bold py-3"
                : "h-full flex items-center font-label-md text-on-surface-variant hover:text-primary transition-all px-1 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300";
              const content = <>
                {link.href === "/premium" && <PremiumBadge variant="icon" className="mr-1.5 text-xs" />}
                {link.label.toUpperCase()}
              </>;
              return link.children.length
                ? <NavDropdown key={link.href} link={link} className={className}>{content}</NavDropdown>
                : <Link key={link.href} href={link.href} className={className}>{content}</Link>;
            })}

          
          </div>
           

          <div className="flex min-w-0 shrink-0 items-center gap-1">
                {!isPremium && <Link
                href="/subscription"
                aria-label="Premium"
                className="group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary transition-colors hover:bg-secondary hover:text-on-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
               >
                <i className="fa-solid fa-crown text-sm" aria-hidden="true" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-inverse-surface px-2.5 py-1 font-label-md text-xs text-inverse-on-surface opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  Premium
                </span>
               </Link>}
               <Link
                href="/support"
                aria-label="Support Us"
                className="group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
               >
                <i className="fa-solid fa-hand-holding-heart text-sm" aria-hidden="true" />
                {/* Name shown on hover or keyboard focus (an icon's alt attribute does nothing). */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-inverse-surface px-2.5 py-1 font-label-md text-xs text-inverse-on-surface opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  Support Us
                </span>
               </Link>
            
                <SearchBox
                  autoFocus
                  onNavigate={() => setSearchOpen(false)}
                  placeholder="Search..."
                  wrapperClassName="hidden w-40 sm:block"
                  inputClassName="w-full border-b border-outline-variant/50 bg-transparent py-1 text-sm font-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
             

            {!loading && user ? (
              <button
                ref={profileButtonRef}
                onClick={openProfileMenu}
                className="flex min-w-0 items-center gap-2 rounded-full border border-outline-variant/30 py-1 pl-1 pr-2 hover:border-primary transition-colors cursor-pointer sm:pr-3"
              >
                <span className="relative w-8 h-8 shrink-0">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-container">
                    {user.profilePicture ? (
                      <Image src={mediaUrl(user.profilePicture)} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-user text-white text-sm" />
                    )}
                  </span>
                  {isPremium && (
                    <span title="Premium member" className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-on-secondary ring-2 ring-surface">
                      <i className="fa-solid fa-crown text-[8px]" aria-hidden="true" />
                      <span className="sr-only">Premium member</span>
                    </span>
                  )}
                </span>
                <span className="hidden font-label-md text-sm text-on-surface max-w-[120px] truncate sm:block">{user.name}</span>
                <i className="fa-solid fa-chevron-down text-[10px] text-on-surface-variant" />
              </button>
            ) : (
              !loading && (
                <>
                  <Link
                    href="/login"
                    className="whitespace-nowrap border border-primary px-2 py-2 font-label-md text-xs text-primary transition-all duration-300 hover:bg-primary hover:text-on-primary sm:px-4 sm:py-1 sm:text-sm"
                  >
                    LOGIN
                  </Link>
                  <Link
                    href="/register"
                    className="whitespace-nowrap bg-primary px-2 py-2 font-label-md text-xs text-on-primary transition-all duration-300 hover:bg-primary-container sm:px-4 sm:py-1.5 sm:text-sm"
                  >
                    SIGN UP
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} navLinks={visibleNavLinks} featureVisibility={featureVisibility} managedPages={managedPages} siteCategories={siteCategories} siteNavigation={siteNavigation} />

      {user && (
        <>
          <ProfileMenu
            open={profileOpen}
            anchorRect={anchorRect}
            onClose={() => setProfileOpen(false)}
            user={user}
            onChangePassword={() => setChangePasswordOpen(true)}
            onLogout={handleLogout}
          />
          <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
        </>
      )}
    </>
  );
}
