import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Newspaper, CalendarDays, Clock, CheckCircle2, FileText, ExternalLink, BellDot, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPageHeader, AdminCard, AdminSection, AdminContentWrapper } from "@/components/admin";

const Dashboard = () => {
  const { userId } = useAuth();
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState({ news: 0, published: 0, pending: 0, upcoming: 0 });
  const [myAppts, setMyAppts] = useState<any[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !currentTenant) {
      setLoading(false);
      return;
    }
    
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      
      const [news, pub, pend, up, ap, sb, fm] = await Promise.all([
        supabase.from("content_blocks").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenant.id),
        supabase.from("content_blocks").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenant.id).eq("published", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenant.id).eq("status", "pending"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenant.id).gte("appointment_date", today),
        supabase.from("appointments").select("*")
          .eq("tenant_id", currentTenant.id)
          .eq("assigned_user_id", userId)
          .gte("appointment_date", today)
          .order("appointment_date").order("appointment_time").limit(10),
        supabase.from("form_submissions").select("*")
          .eq("tenant_id", currentTenant.id)
          .eq("assigned_user_id", userId)
          .order("assigned_at", { ascending: false }).limit(15),
        supabase.from("forms").select("id,title").eq("tenant_id", currentTenant.id),
      ]);
      
      setStats({
        news: news.count ?? 0, 
        published: pub.count ?? 0,
        pending: pend.count ?? 0, 
        upcoming: up.count ?? 0,
      });
      setMyAppts(ap.data ?? []);
      setMySubs(sb.data ?? []);
      const fmap: Record<string, string> = {};
      (fm.data ?? []).forEach((f: any) => { fmap[f.id] = f.title; });
      setForms(fmap);
      setLoading(false);
    };
    load();
  }, [userId, currentTenant]);

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper>
          <AdminPageHeader 
            icon={LayoutDashboard} 
            title="Dashboard" 
            description="Übersicht & deine zugewiesenen Aufgaben." 
          />
          <AdminCard className="p-12 text-center text-muted-foreground">
            <p>Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper>
        <AdminPageHeader 
          icon={LayoutDashboard} 
          title="Dashboard" 
          description={`Übersicht für Mandant: ${currentTenant.name}`} 
        />

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Lade Dashboard...</div>
        ) : (
          <AdminSection spacing="lg">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AdminCard className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary/10 text-primary"><Newspaper className="h-5 w-5" /></div>
                <div>
                  <div className="text-2xl font-bold">{stats.news}</div>
                  <div className="text-sm text-muted-foreground">News-Bereiche</div>
                </div>
              </AdminCard>
              <AdminCard className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
                <div>
                  <div className="text-2xl font-bold">{stats.published}</div>
                  <div className="text-sm text-muted-foreground">Veröffentlicht</div>
                </div>
              </AdminCard>
              <AdminCard className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary/10 text-primary"><Clock className="h-5 w-5" /></div>
                <div>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <div className="text-sm text-muted-foreground">Offene Anfragen</div>
                </div>
              </AdminCard>
              <AdminCard className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
                <div>
                  <div className="text-2xl font-bold">{stats.upcoming}</div>
                  <div className="text-sm text-muted-foreground">Kommende Termine</div>
                </div>
              </AdminCard>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <AdminCard 
                title="Meine Termine" 
                actions={<Badge variant="secondary">{myAppts.length}</Badge>}
              >
                {myAppts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine zugewiesenen Termine für diesen Mandanten.</p>
                ) : (
                  <ul className="space-y-2">
                    {myAppts.map(a => (
                      <li key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                        <div>
                          <div className="font-medium text-sm">{a.title || `${a.first_name} ${a.last_name}`}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(a.appointment_date).toLocaleDateString("de-DE")} · {a.appointment_time?.slice(0,5)}
                          </div>
                        </div>
                        <Badge variant={a.status === "confirmed" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"}>{a.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>

              <AdminCard 
                title="Meine Formular-Eingaben" 
                actions={<Badge variant="secondary">{mySubs.length}</Badge>}
              >
                {mySubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Dir sind keine Eingaben zugewiesen.</p>
                ) : (
                  <ul className="space-y-2">
                    {mySubs.map(s => (
                      <li key={s.id}>
                        <Link to={`/admin/formulare/${s.id}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 hover:border-primary/40 hover:bg-muted transition group">
                          <div className="flex items-center gap-2 min-w-0">
                            {!s.read_at && <BellDot className="h-4 w-4 text-primary flex-shrink-0 animate-pulse" />}
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{forms[s.form_id] || "Formular"}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(s.created_at).toLocaleString("de-DE")}
                                {!s.read_at && <span className="ml-2 text-primary font-bold">Neu</span>}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>
            </div>
          </AdminSection>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default Dashboard;