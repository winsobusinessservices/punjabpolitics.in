import PanelRoleGate from "@/components/auth/PanelRoleGate";

export const metadata = { robots: { index: false, follow: false, noarchive: true } };

export default function AuthorLayout({ children }) {
  return <PanelRoleGate>{children}</PanelRoleGate>;
}
