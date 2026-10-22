import { redirect } from "next/navigation";

export const metadata = { robots: { index: false, follow: false, noarchive: true } };

export default async function StaffPanelRedirect({ params }) {
  const panelUrl = (process.env.NEXT_PUBLIC_PANEL_URL || "https://panel.punjabpolitics.com").replace(/\/$/, "");
  const { path = [] } = await params;
  const panelPath = path.length ? `/author/${path.map(encodeURIComponent).join("/")}` : "/author/dashboard";
  redirect(`${panelUrl}${panelPath}`);
}
