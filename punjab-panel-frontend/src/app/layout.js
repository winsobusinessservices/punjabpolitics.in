import "./globals.css";
import PanelAnalyticsTracker from "@/components/author/PanelAnalyticsTracker";
import { AuthProvider } from "@/context/AuthContext";
import ToastProvider from "@/components/common/ToastProvider";
import ConfirmDialogProvider from "@/components/common/ConfirmDialogProvider";
import AuthorWorkspaceShell from "@/components/author/AuthorWorkspaceShell";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { serializeJsonLd } from "@/lib/seo";
import { AdminSiteProvider } from "@/context/AdminSiteContext";
import { siteThemeStyle } from "@/lib/siteTheme";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";

// Brand colours saved under Website settings. The panel keeps its default
// palette if the API cannot be reached.
async function loadSiteTheme() {
  try {
    const response = await fetch(`${API_BASE_URL}/sites/current`, { cache: "no-store" });
    if (!response.ok) return {};
    return siteThemeStyle((await response.json()).site);
  } catch {
    return {};
  }
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: {
    default: "Editorial Panel | Punjab Politics",
    template: "%s | Punjab Politics Panel",
  },
  description: "Private editorial and administration panel for Punjab Politics.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function RootLayout({ children }) {
  const themeStyle = await loadSiteTheme();
  const siteSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsMediaOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "Punjab Politics",
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/globe.svg`,
          contentUrl: `${SITE_URL}/globe.svg`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: "Punjab Politics",
        description: SITE_DESCRIPTION,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning style={themeStyle}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700;900&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-background font-body-md">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteSchema) }} />

        <ToastProvider />
        <ConfirmDialogProvider>
          <AuthProvider>
            <AdminSiteProvider><PanelAnalyticsTracker /><AuthorWorkspaceShell>{children}</AuthorWorkspaceShell></AdminSiteProvider>
          </AuthProvider>
        </ConfirmDialogProvider>
      </body>
    </html>
  );
}
