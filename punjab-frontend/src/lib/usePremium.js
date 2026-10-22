"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Is the signed-in reader a Premium member right now?
 *   ready      false while the sign-in state is still being read (do not decide anything yet)
 *   isPremium  true for an active Premium subscription (the server reports it with the signed-in user)
 *   endsAt     when the current month ends
 */
export function usePremium() {
  const { user, loading } = useAuth();
  const premium = user?.premium;
  return { ready: !loading, isPremium: Boolean(premium?.active), endsAt: premium?.endsAt || null, signedIn: Boolean(user) };
}
