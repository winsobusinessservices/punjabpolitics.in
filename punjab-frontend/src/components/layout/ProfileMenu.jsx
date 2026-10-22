"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export default function ProfileMenu({ open, anchorRect, onClose, user, onChangePassword, onLogout }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Portals can only be rendered after the browser document is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!e.target.closest("[data-profile-menu]")) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!mounted || !open || !anchorRect) return null;

  return createPortal(
    <div
      data-profile-menu
      className="fixed z-[210] w-56 bg-surface-container-lowest rounded-lg shadow-2xl border border-outline-variant/20 overflow-hidden"
      style={{ top: anchorRect.bottom + 8, right: window.innerWidth - anchorRect.right }}
    >
      <div className="px-4 py-3 border-b border-outline-variant/20">
        <p className="font-label-md text-sm text-on-surface truncate">{user.name}</p>
        {user.email && <p className="font-body-md text-xs text-on-surface-variant truncate">{user.email}</p>}
      </div>
      <Link
        href="/profile"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-body-md text-on-surface hover:bg-surface-container transition-colors text-left"
      >
        <i className="fa-solid fa-user text-primary w-4" />
        My Profile
      </Link>
            <Link
        href="/my-activity"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-body-md text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer"
      >
        <i className="fa-solid fa-clock-rotate-left text-primary w-4" />
        My Activity
      </Link>
      <Link
        href="/my-interests"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-body-md text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer"
      >
        <i className="fa-solid fa-sliders text-primary w-4" />
        My Interests
      </Link>
      <button
        onClick={() => {
          onClose();
          onChangePassword();
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-body-md text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer"
      >
        <i className="fa-solid fa-key text-primary w-4" />
        Change Password
      </button>
      <button
        onClick={() => {
          onClose();
          onLogout();
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-body-md text-error hover:bg-surface-container transition-colors text-left border-t border-outline-variant/20 cursor-pointer"
      >
        <i className="fa-solid fa-arrow-right-from-bracket w-4" />
        Logout
      </button>
    </div>,
    document.body
  );
}
