import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Newspaper, CalendarDays, LogOut, Menu, X,
  ShieldCheck, FileText, Users as UsersIcon, Hourglass, Sparkles,
  ChevronLeft, ChevronRight, Building2, Plug,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { TenantSwitcher } from "@/components/admin/TenantSwitcher";
import { cn } from "@/lib/utils";
import { TenantSwitcher } from "@/components/admin/TenantSwitcher";

type AppRole = "admin" | "editor" | "guest";

const allItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Aktuelle News", url: "/admin/news", icon: Newspaper, end: false, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Termine", url: "/admin/termine", icon: CalendarDays, end: false, roles: ["admin", "editor", "guest"] as AppRole[] },
  { title: "Formulare", url: "/admin/formulare", icon: FileText, end: false, roles: ["admin", "editor"] as AppRole[] },
  { title: "AI", url: "/admin/ai", icon: Sparkles, end: false, roles: ["admin", "editor"] as AppRole[] },
  { title: "API", url: "/admin/api-settings", icon: Plug, end: false, roles: ["admin", "editor"] as AppRole[] },
  { title: "Mandanten", url: "/admin/tenants", icon: Building2, end: false, roles: ["admin", "editor"] as AppRole[] },
  { title: "Users", url: "/admin/users", icon: UsersIcon, end: false, roles: ["admin"] as AppRole[] },
];

// Zustand der Sidebar im localStorage speichern
const SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, role, status, loading, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Initialen Zustand aus localStorage laden
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return saved === "true";
  });

  // Redirect immediately when session disappears (logout)
  useEffect(() => {
    if (!loading && !session) navigate("/auth", { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);

  // Sidebar-Zustand speichern
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground animate-pulse">
        Initialisiere...
      </div>
    );
  }

  const isAdminRole = role === "admin";

  if (!role || (!isAdminRole && (status === "new" || status === "blocked"))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
        <div className="p-8 bg-card border border-border rounded-3xl text-center shadow-2xl max-w-md">
          {status === "blocked" ? (
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
          <Button onClick={handleLogout} className="mt-6">Abmelden</Button>
        </div>
      </div>
    );
  }

  const items = allItems.filter((i) => i.roles.includes(role as AppRole));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-foreground flex flex-col md:flex-row">
      {/* DESKTOP SIDEBAR (zuklappbar) */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 h-screen transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Logo / Header Bereich */}
        <div className={cn(
          "flex items-center gap-3 px-2 mb-10 mt-6 transition-all duration-300",
          isSidebarCollapsed ? "justify-center" : "px-2"
        )}>
          <div className="w-10 h-10 bg-primary shadow-lg shadow-primary/20 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold tracking-tight text-base leading-none">Admin Panel</span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">{role}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2">
          {items.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                isSidebarCollapsed && "justify-center px-2"
              )}
              title={isSidebarCollapsed ? item.title : undefined}
            >
              <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium text-sm">{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer Bereich mit Abmelden-Button */}
        <div className="mt-auto space-y-2 pt-6 border-t border-border/50 mb-6">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200",
              isSidebarCollapsed && "justify-center px-2"
            )}
            title={isSidebarCollapsed ? "Abmelden" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium text-sm">Abmelden</span>}
          </button>
        </div>

        {/* Collapse / Expand Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-primary text-primary-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform duration-200 z-50"
          title={isSidebarCollapsed ? "Ausklappen" : "Einklappen"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 hover:bg-secondary rounded-lg transition-colors bg-secondary/50">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* MOBILE OVERLAY MENU */}
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
                <NavLink key={item.url} to={item.url} end={item.end}
                  className="flex items-center gap-4 text-2xl font-bold transition-all active:scale-95">
                  <item.icon size={28} className="text-primary" />
                  {item.title}
                </NavLink>
              ))}
            </div>
            <button onClick={handleLogout}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-destructive/10 text-destructive font-bold">
              <LogOut size={20} /> Abmelden
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex h-16 items-center justify-end px-10 border-b border-border/40 bg-card/30 backdrop-blur-md gap-4">
          <TenantSwitcher />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-[11px] font-bold text-green-600 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live System
          </div>
          <div className="h-4 w-px bg-border/60 mx-2" />
          <NotificationBell />
          <ThemeToggle />
        </header>

        <div className={cn(
          "flex-1 p-4 pb-24 transition-all duration-300",
          "md:p-6 md:pb-10",
          "lg:p-8"
        )}>
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-t border-border/50 px-2 flex items-center justify-around z-50">
        {items.map((item) => (
          <NavLink key={item.url} to={item.url} end={item.end}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 transition-all duration-200",
              isActive ? "text-primary scale-110" : "text-muted-foreground opacity-60"
            )}>
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.title.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default AdminLayout;
