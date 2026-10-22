"use client";
import { useAuth } from "@/context/AuthContext";
import SitesServicesAdmin from "@/components/author/SitesServicesAdmin";
import { useAdminSite } from "@/context/AdminSiteContext";

export default function ServicesManagementClient() {
  const { user } = useAuth();
  const { activeSite, activeSiteId } = useAdminSite();
  if (!activeSite?.services_enabled) return <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface p-8 text-center text-on-surface-variant">Services are disabled for <strong>{activeSite?.name || "this website"}</strong>. Enable them under Administration → Websites.</div>;
  return <SitesServicesAdmin key={activeSiteId} user={user} initialSiteId={activeSiteId} siteName={activeSite.name} />;
}
