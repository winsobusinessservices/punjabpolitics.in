"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminSite } from "@/context/AdminSiteContext";
import { mediaUrl } from "@/lib/api";
import ChangePasswordModal from "@/components/auth/ChangePasswordModal";

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");
const ROLE_LABELS = { AUTHOR: "Author", EDITOR: "Editor", ADMIN: "Admin", SUBADMIN: "Subadmin", INVESTOR: "Investor" };

// Top bar of the panel: workspace menu button (mobile), website name, and the profile menu
// (profile, change password, view website, log out).
export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeSite } = useAdminSite();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const websiteUrl = activeSite?.domain ? `https://${activeSite.domain}` : PUBLIC_SITE_URL;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[210] flex min-h-16 items-center justify-between gap-3 border-b border-outline-variant/45 bg-surface/95 px-4 shadow-sm backdrop-blur lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            title="Open menu"
            aria-label="Open workspace menu"
            onClick={() => window.dispatchEvent(new Event("open-workspace-menu"))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10 lg:hidden"
          >
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{activeSite?.name || "Punjab Politics"}</p>
            <p className="truncate text-xs text-on-surface-variant">Content &amp; Management</p>
          </div>
        </div>

        {user && (
          <div ref={menuRef} className="relative flex flex-col items-center gap-0.5">
            <button
              type="button"
              title="Open profile menu"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-primary text-primary hover:bg-primary/10"
            >
              {user.profilePicture ? (
                <Image src={mediaUrl(user.profilePicture)} alt={user.name || "Profile"} width={36} height={36} unoptimized className="h-full w-full object-cover" />
              ) : (
                <i className="fa-solid fa-user" aria-hidden="true" />
              )}
            </button>
            <span className="text-[11px] font-medium text-primary">{user.role}</span>

            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full z-[250] mt-2 w-56 rounded-lg border border-outline-variant/45 bg-surface shadow-lg">
                <div className="flex flex-col gap-0.5 p-3">
                  <p className="truncate text-sm font-semibold text-primary">{user.name}</p>
                  <p className="text-xs text-on-surface-variant">{ROLE_LABELS[user.role] || user.role} account</p>
                </div>
                <hr className="border-outline-variant/45" />
                <Link role="menuitem" href="/author/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10">
                  <i className="fa-solid fa-user w-4 text-center" aria-hidden="true" /> Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setChangePasswordOpen(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-primary/10"
                >
                  <i className="fa-solid fa-key w-4 text-center" aria-hidden="true" /> Change password
                </button>
                <a role="menuitem" href={websiteUrl} className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10">
                  <i className="fa-solid fa-globe w-4 text-center" aria-hidden="true" /> View website
                </a>
                <hr className="border-outline-variant/45" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-busy={loggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-500 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <i className={`fa-solid ${loggingOut ? "fa-spinner fa-spin" : "fa-right-from-bracket"} w-4 text-center`} aria-hidden="true" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </>
  );
}
