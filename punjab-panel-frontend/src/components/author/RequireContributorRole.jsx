"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission } from "@/lib/permissions";

const CONTRIBUTOR_ROLES = ["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN"];

/**
 * `roles`/`roleLabel` let a page narrow this to a subset (e.g. moderators
 * only, for the review queue) while every existing `<RequireContributorRole>`
 * call with no props keeps the original Author/Editor/Admin behavior.
 */
export default function RequireContributorRole({ children, roles = CONTRIBUTOR_ROLES, permissions, roleLabel = "an authorized team member" }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <i className="fa-solid fa-lock text-4xl text-outline-variant mb-4" />
        <h1 className="font-display-lg text-2xl text-primary mb-2">Sign in required</h1>
        <p className="font-body-md text-on-surface-variant mb-6">
          You need to be signed in as {roleLabel} to access this page.
        </p>
        <Link href="/login" className="inline-block bg-primary text-on-primary px-6 py-2 font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  const authorized = permissions?.length
    ? hasAnyPermission(user, permissions)
    : roles.includes(user.role);

  if (!authorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <i className="fa-solid fa-ban text-4xl text-error mb-4" />
        <h1 className="font-display-lg text-2xl text-primary mb-2">Access Restricted</h1>
        <p className="font-body-md text-on-surface-variant mb-6">
          This section is only available to {roleLabel}. Your current role is{" "}
          <span className="font-label-md text-on-surface">{user.role}</span>.
        </p>
        <Link href="/" className="inline-block bg-primary text-on-primary px-6 py-2 font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  return children;
}
