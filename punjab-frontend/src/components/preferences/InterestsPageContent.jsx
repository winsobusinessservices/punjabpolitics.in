"use client";

import AuthReturnLink from "@/components/auth/AuthReturnLink";
import InterestsForm from "@/components/preferences/InterestsForm";
import { useAuth } from "@/context/AuthContext";

/**
 * The /my-interests page body. Everyone can answer: signed-in readers are
 * recognised by their account, visitors by their browser.
 */
export default function InterestsPageContent() {
  const { user, loading } = useAuth();

  return (
    <div className="space-y-4">
      {!loading && !user && (
        <p className="rounded-lg bg-primary/5 px-4 py-3 text-center font-body-md text-xs text-on-surface-variant">
          You can answer without an account. To keep your answers on every device,{" "}
          <AuthReturnLink authPath="/login" returnTo="/my-interests" className="font-semibold text-primary hover:underline">
            sign in
          </AuthReturnLink>
          {" "}or{" "}
          <AuthReturnLink authPath="/register" returnTo="/my-interests" className="font-semibold text-primary hover:underline">
            create an account
          </AuthReturnLink>.
        </p>
      )}
      <div className="rounded-xl border border-outline-variant/30 bg-surface p-6 sm:p-8">
        <InterestsForm />
      </div>
    </div>
  );
}
