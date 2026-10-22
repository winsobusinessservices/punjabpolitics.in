// Pages where pop-ups (the interests survey) must stay away: sign-in, sign-up and password pages.
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function isAuthPath(pathname) {
  const path = String(pathname || "");
  return AUTH_PATHS.some((authPath) => path === authPath || path.startsWith(`${authPath}/`));
}
