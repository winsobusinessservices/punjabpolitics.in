import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "Reset Your Punjab Politics Password",
  description: "Choose a strong new password for your Punjab Politics account. Your reset link is secure, time-limited and can only be used once to update your password.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
