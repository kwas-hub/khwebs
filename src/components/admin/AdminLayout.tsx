import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Newspaper, 
  CalendarDays, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/admin/NotificationBell";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Aktuelle News", url: "/admin/news", icon: Newspaper, end: false },
  { title: "Termine", url: "/admin/termine", icon: CalendarDays, end: false },
  { title: "Formulare", url: "/admin/formulare", icon: FileText, end: false },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = roles?.some((r) => r.role === "admin") ?? false;
      setIsAdmin(admin);
      if (!admin) toast.error("Keine Admin-Berechtigung");
      setLoading(false);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Dynamischer Lade-Bildschirm
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground animate-pulse">
      Initialisiere...
    </div>
  );
  
  // Dynamische Fehler-Ansicht
  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="p-8 bg-card border border-border rounded-3xl text-center shadow-2xl">
        <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <h1 className="text-xl font-bold">Kein Zugriff</h1>
        <p className="text-muted-foreground mt-2">Du verfügst nicht über Admin-Rechte.</p>
        <Button onClick={logout} className="mt-6">Zurück zum Login</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 p-6 border-r border-border bg-card">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight text-lg">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-2">
          {items.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group
                ${isActive 
                  ? "bg-secondary text-secondary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}
              `}
            >
              <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span className="font-medium">{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-border">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* --- MOBILE HEADER --- */}
      <header className="md:hidden h-16 flex items-center justify-between px-6 border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-bold">Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-secondary rounded-xl transition-colors"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* --- MOBILE NAV OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background md:hidden animate-in fade-in slide-in-from-top duration-300">
          <nav className="flex flex-col gap-4 p-8 pt-24">
            {items.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.end}
                className={({ isActive }) => `
                  flex items-center gap-4 px-6 py-4 rounded-2xl text-lg font-semibold
                  ${isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}
                `}
              >
                <item.icon className="w-6 h-6" />
                {item.title}
              </NavLink>
            ))}
            <button 
              onClick={logout}
              className="mt-10 flex items-center gap-4 px-6 py-4 rounded-2xl text-destructive bg-destructive/10"
            >
              <LogOut className="w-6 h-6" />
              Abmelden
            </button>
          </nav>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex h-16 items-center justify-end px-10 border-b border-border bg-background/50 backdrop-blur-xl gap-2">
           <NotificationBell />
           <ThemeToggle />
           <div className="flex items-center gap-4 text-sm text-muted-foreground ml-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Admin Mode Online
           </div>
        </header>

        <div className="flex-1 p-6 md:p-10 overflow-auto">
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
