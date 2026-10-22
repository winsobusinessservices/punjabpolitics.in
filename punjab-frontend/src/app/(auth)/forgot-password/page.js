import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot Your Punjab Politics Password?",
  description: "Forgot your password? Enter your registered email address to receive a secure reset link and regain access to your Punjab Politics account in a few steps.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
