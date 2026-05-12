import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
};

export type Membership = Tenant & { role: "admin" | "member" | string };

interface TenantCtx {
  tenants: Membership[];
  currentTenantId: string | null;
  currentTenant: Membership | null;
  isTenantAdmin: boolean;
  loading: boolean;
  setCurrentTenantId: (id: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<TenantCtx | null>(null);
const STORAGE_KEY = "active-tenant-id";

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { userId } = useAuth();
  const [tenants, setTenants] = useState<Membership[]>([]);
  const [currentTenantId, _setCurrentTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setTenants([]); _setCurrentTenantId(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_tenants")
      .select("role, tenant:tenants(id, name, slug, settings)")
      .eq("user_id", userId);
    if (error) { console.error("load tenants", error); setLoading(false); return; }
    const list: Membership[] = (data ?? [])
      .filter((r: any) => r.tenant)
      .map((r: any) => ({ ...r.tenant, role: r.role, settings: (r.tenant.settings ?? {}) as any }));
    setTenants(list);

    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && list.find(t => t.id === stored);
    _setCurrentTenantId(valid ? stored : (list[0]?.id ?? null));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const setCurrentTenantId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    _setCurrentTenantId(id);
  };

  const currentTenant = useMemo(() => tenants.find(t => t.id === currentTenantId) ?? null, [tenants, currentTenantId]);
  const isTenantAdmin = currentTenant?.role === "admin";

  return (
    <Ctx.Provider value={{ tenants, currentTenantId, currentTenant, isTenantAdmin, loading, setCurrentTenantId, reload: load }}>
      {children}
    </Ctx.Provider>
  );
};

export const useTenant = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTenant must be used inside TenantProvider");
  return c;
};
