import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "editor" | "guest" | "user";
export type UserStatus = "new" | "active" | "blocked";

interface AuthCtx {
  session: Session | null;
  userId: string | null;
  role: AppRole | null;
  status: UserStatus | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isGuest: boolean;
  canBackend: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [r, p] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("status").eq("user_id", uid).maybeSingle(),
    ]);
    const rs = (r.data ?? []).map((x: any) => x.role);
    const next: AppRole | null = rs.includes("admin") ? "admin"
      : rs.includes("editor") ? "editor"
      : rs.includes("guest") ? "guest"
      : rs.includes("user") ? "user" : null;
    setRole(next);
    setStatus(((p.data?.status as any) ?? "new") as UserStatus);
  };

  useEffect(() => {
    // Listener FIRST (synchronous state updates), then check existing session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) {
        setRole(null); setStatus(null); setLoading(false);
      } else {
        // Defer DB calls (avoid deadlocks in callback)
        setTimeout(() => { loadProfile(sess.user.id).finally(() => setLoading(false)); }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    setSession(null); setRole(null); setStatus(null);
    await supabase.auth.signOut();
  };

  const value: AuthCtx = {
    session, userId: session?.user.id ?? null, role, status, loading,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
    isGuest: role === "guest",
    canBackend: role === "admin" || role === "editor" || role === "guest",
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};
