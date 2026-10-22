"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const STAFF_ROLES = new Set(["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN", "INVESTOR"]);
const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");

export default function PanelHome() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (STAFF_ROLES.has(user.role)) router.replace("/author/dashboard");
    else window.location.replace(PUBLIC_SITE_URL);
  }, [loading, router, user]);

  return <div className="flex min-h-screen items-center justify-center text-sm text-on-surface-variant">Opening your workspace...</div>;
}
