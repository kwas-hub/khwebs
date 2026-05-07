import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Newspaper,
  CalendarDays,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  FileText,
  Users as UsersIcon,
  Hourglass,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "editor" | "guest";

const allItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Aktuelle News", url: "/admin/news", icon: Newspaper, end: false, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Termine", url: "/admin/termine", icon: CalendarDays, end: false, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Formulare", url: "/admin/formulare", icon: FileText, end: false, roles: ["admin", "editor"] as AppRole[] },
  { title: "Users", url: "/admin/users", icon: UsersIcon, end: false, roles: ["admin"] as AppRole[] },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userStatus, setUserStatus] = useState<"new" | "active" | "blocked" | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("profiles").select("status").eq("user_id", session.user.id).maybeSingle(),
      ]);
      const rs = (rolesRes.data ?? []).map((r: any) => r.role);
      const r: AppRole | null = rs.includes("admin") ? "admin" : rs.includes("editor") ? "editor" : rs.includes("guest") ? "guest" : null;
      setRole(r);
      setUserStatus((profileRes.data?.status as any) ?? "new");
      setLoading(false);
    };
    init();
  }, [navigate]);

  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground animate-pulse">
      Initialisiere...
    </div>
  );

  // Admin überschreibt Status-Check (Self-Lockout vermeiden)
  const isAdminRole = role === "admin";

  if (!role || (!isAdminRole && (userStatus === "new" || userStatus === "blocked"))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
        <div className="p-8 bg-card border border-border rounded-3xl text-center shadow-2xl max-w-md">
          {userStatus === "blocked" ? (
            <>
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h1 className="text-xl font-bold">Zugang gesperrt</h1>
              <p className="text-muted-foreground mt-2">Dein Konto wurde gesperrt. Bitte kontaktiere den Administrator.</p>
            </>
          ) : (
            <>
              <Hourglass className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h1 className="text-xl font-bold">Warten auf Freischaltung</h1>
              <p className="text-muted-foreground mt-2">Dein Konto ist registriert, muss aber zuerst von einem Administrator freigeschaltet werden.</p>
            </>
          )}
          <Button onClick={logout} className="mt-6">Abmelden</Button>
        </div>
      </div>
    );
  }

  const items = allItems.filter((i) => i.roles.includes(role));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-foreground flex flex-col md:flex-row">

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 p-6 border-r border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-primary shadow-lg shadow-primary/20 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-base leading-none">Admin Panel</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">{role}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              <span className="font-medium text-sm">{item.title}</span>
              {location.pathname === item.url && (
                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-6 border-t border-border/50">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* --- MOBILE HEADER --- */}
      <header className="md:hidden h-14 flex items-center justify-between px-5 border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">Admin Console</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors bg-secondary/50"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md md:hidden animate-in fade-in duration-200">
          <div className="flex flex-col h-full p-8">
            <div className="flex justify-end">
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-secondary rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-6">
              {items.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.end}
                  className="flex items-center gap-4 text-2xl font-bold transition-all active:scale-95"
                >
                  <item.icon size={28} className="text-primary" />
                  {item.title}
                </NavLink>
              ))}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
                <span className="font-medium text-sm text-muted-foreground">Erscheinungsbild</span>
                <ThemeToggle />
              </div>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-destructive/10 text-destructive font-bold"
              >
                <LogOut size={20} /> Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN --- */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex h-16 items-center justify-end px-10 border-b border-border/40 bg-card/30 backdrop-blur-md gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-[11px] font-bold text-green-600 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live System
          </div>
          <div className="h-4 w-px bg-border/60 mx-2" />
          <NotificationBell />
          <ThemeToggle />
        </header>

        <div className="flex-1 p-4 md:p-10 pb-24 md:pb-10 overflow-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>

      {/* Mobile Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-t border-border/50 px-4 flex items-center justify-around z-50">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.end}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 transition-all duration-200",
              isActive ? "text-primary scale-110" : "text-muted-foreground opacity-60"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.title.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default AdminLayout;
