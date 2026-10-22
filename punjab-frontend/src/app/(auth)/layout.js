export const metadata = { robots: { index: false, follow: false } };

import Header from "@/components/layout/Header";

export default function AuthLayout({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
