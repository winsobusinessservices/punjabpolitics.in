import RegisterForm from "./RegisterForm";

export const metadata = {
  title: "Create Your Free Punjab Politics Account",
  description: "Create a free Punjab Politics account to join discussions on Punjab political blogs, comment on expert analysis and stay connected with our community.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
