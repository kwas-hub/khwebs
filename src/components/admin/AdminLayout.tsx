import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Newspaper, 
  CalendarDays, 
  LogOut, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Aktuelle News", url: "/admin/news", icon: Newspaper, end: false },
  { title: "Termine", url: "/admin/termine", icon: CalendarDays, end: false },
];

function AdminNav({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-border/50">
        <div className="flex items-center gap-3 px-4 w-full">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <ShieldCheck size={20} />
          </div>
          <span className="font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            Admin Panel
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Verwaltung
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.end 
                  ? location.pathname === item.url 
                  : location.pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                      className="mx-2 w-[calc(100%-16px)] transition-all duration-200"
                    >
                      <NavLink to={item.url} end={item.end}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span className="font-medium">{item.title}</span>
                        {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={onLogout}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      if (!admin) toast.error("Zugriff verweigert");
      setLoading(false);
    };
    init();
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <ShieldCheck className="h-12 w-12 text-destructive mb-4" />
      <h1 className="text-2xl font-bold">Kein Zutritt</h1>
      <p className="text-muted-foreground mt-2 max-w-xs">
        Du hast keine Administrator-Rechte für diesen Bereich.
      </p>
      <Button variant="outline" className="mt-6" onClick={logout}>
        Zurück zum Login
      </Button>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50 dark:bg-background">
        <AdminNav onLogout={logout} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="sticky top-0 z-10 h-16 flex items-center gap-4 border-b bg-background/80 backdrop-blur-md px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="flex-1">
              <h2 className="text-sm font-medium text-muted-foreground">Admin-Bereich</h2>
            </div>
            {/* Hier könnten noch Benachrichtigungen oder User-Menüs hin */}
          </header>

          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;