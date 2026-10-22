"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A link to the sign-in or sign-up page that brings the reader back afterwards:
 *   <AuthReturnLink authPath="/login" returnTo="/subscription">Sign in</AuthReturnLink>
 * Without `returnTo` it returns to the page the link is on.
 */
export default function AuthReturnLink({ authPath = "/login", returnTo, children, ...rest }) {
  const pathname = usePathname();
  const target = returnTo || pathname || "/";
  // Only same-site paths are accepted as a return address.
  const safe = target.startsWith("/") && !target.startsWith("//") ? target : "/";
  return (
    <Link href={`${authPath}?next=${encodeURIComponent(safe)}`} {...rest}>
      {children}
    </Link>
  );
}
