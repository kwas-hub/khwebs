import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "guest" | "user";

export const useUserRole = () => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const rs = (roles ?? []).map((r) => r.role as AppRole);
      // Hierarchie: admin > editor > guest > user
      const r: AppRole | null = rs.includes("admin") ? "admin"
        : rs.includes("editor") ? "editor"
        : rs.includes("guest") ? "guest"
        : rs.includes("user") ? "user"
        : null;
      setRole(r);
      setLoading(false);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange(() => init());
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  return {
    role, userId, loading,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
    isGuest: role === "guest",
    canBackend: role === "admin" || role === "editor" || role === "guest",
  };
};
