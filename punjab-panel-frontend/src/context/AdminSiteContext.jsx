"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sitesApi } from "@/lib/api";

const AdminSiteContext = createContext({ sites: [], activeSite: null, activeSiteId: "", features: {}, setActiveSiteId: () => {} });

export function AdminSiteProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [sites, setSites] = useState([]);
  const [activeSiteId, setActiveSiteIdState] = useState("");
  const [features, setFeatures] = useState({});

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    const ownSite = user.site ? [user.site] : [];
    const request = user.role === "ADMIN" ? sitesApi.list().then((data) => data.sites || []) : Promise.resolve(ownSite);
    request.then((available) => {
      if (!active) return;
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("punjab_panel_active_site_id") : "";
      const allowedStored = available.some((site) => String(site.id) === String(stored));
      const selected = String(allowedStored ? stored : (user.siteId || available[0]?.id || ""));
      setSites(available);
      setActiveSiteIdState(selected);
      if (selected) window.localStorage.setItem("punjab_panel_active_site_id", selected);
    }).catch(() => {
      if (active) { setSites(ownSite); setActiveSiteIdState(String(user.siteId || "")); }
    });
    return () => { active = false; };
  }, [authLoading, user]);

  useEffect(() => {
    if (!activeSiteId || !user) return;
    let active = true;
    const loadFeatures = () => sitesApi.features(activeSiteId).then((data) => { if (active) setFeatures(data.features || {}); }).catch(() => { if (active) setFeatures({}); });
    loadFeatures();
    window.addEventListener("panel-site-features-changed", loadFeatures);
    return () => { active = false; window.removeEventListener("panel-site-features-changed", loadFeatures); };
  }, [activeSiteId, user]);

  const setActiveSiteId = useCallback((value) => {
    const selected = String(value || "");
    if (!sites.some((site) => String(site.id) === selected)) return;
    setActiveSiteIdState(selected);
    window.localStorage.setItem("punjab_panel_active_site_id", selected);
    window.dispatchEvent(new CustomEvent("panel-site-changed", { detail: { siteId: selected } }));
  }, [sites]);
  const activeSite = sites.find((site) => String(site.id) === String(activeSiteId)) || user?.site || null;
  const value = useMemo(() => ({ sites, activeSite, activeSiteId, features, setActiveSiteId }), [sites, activeSite, activeSiteId, features, setActiveSiteId]);
  return <AdminSiteContext.Provider value={value}>{children}</AdminSiteContext.Provider>;
}

export function useAdminSite() {
  return useContext(AdminSiteContext);
}
