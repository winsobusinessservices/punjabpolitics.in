import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign In to Your Punjab Politics Account",
  description: "Sign in to your Punjab Politics account to read and comment on political blogs, follow in-depth analysis, and manage your profile and activity.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }) {
  const requestedPath = String((await searchParams)?.next || "");
  const nextPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/";
  return <LoginForm nextPath={nextPath} />;
}
