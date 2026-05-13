import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Newspaper, CalendarDays, Clock, CheckCircle2, FileText, ExternalLink, BellDot, LayoutDashboard, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { 
  AdminPageHeader, 
  AdminCard, 
  AdminSection, 
  AdminContentWrapper,
  AdminDivider 
} from "@/components/admin";

const Dashboard = () => {
  const { userId } = useAuth();
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState({ news: 0, published: 0, pending: 0, upcoming: 0 });
  const [myAppts, setMyAppts] = useState<any[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    if (!userId || !currentTenant) return;
    
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
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadDashboardData();
      setLoading(false);
    };
    load();
  }, [userId, currentTenant]);

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminPageHeader 
            icon={LayoutDashboard} 
            title="Dashboard" 
            description="Übersicht & deine zugewiesenen Aufgaben." 
          />
          <AdminCard className="p-12 text-center">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={LayoutDashboard} 
          title="Dashboard" 
          description={`Übersicht für Mandant: ${currentTenant.name}`}
          actions={
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshData} 
              disabled={refreshing || loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          }
        />

        {loading ? (
          <AdminCard className="p-12 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Lade Dashboard...</span>
            </div>
          </AdminCard>
        ) : (
          <>
            {/* Statistik-Karten */}
            <AdminSection spacing="lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AdminCard className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Newspaper className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.news}</div>
                      <div className="text-sm text-muted-foreground">News-Bereiche</div>
                    </div>
                  </div>
                </AdminCard>

                <AdminCard className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.published}</div>
                      <div className="text-sm text-muted-foreground">Veröffentlicht</div>
                    </div>
                  </div>
                </AdminCard>

                <AdminCard className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.pending}</div>
                      <div className="text-sm text-muted-foreground">Offene Anfragen</div>
                    </div>
                  </div>
                </AdminCard>

                <AdminCard className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.upcoming}</div>
                      <div className="text-sm text-muted-foreground">Kommende Termine</div>
                    </div>
                  </div>
                </AdminCard>
              </div>
            </AdminSection>

            <AdminDivider spacing="lg" />

            {/* Detail-Bereiche */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Meine Termine */}
              <AdminCard 
                title="Meine Termine" 
                description="Ihnen zugewiesene Termine für diesen Mandanten"
                actions={
                  <Badge variant="secondary" className="font-mono">
                    {myAppts.length}
                  </Badge>
                }
              >
                {myAppts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Keine zugewiesenen Termine für diesen Mandanten.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myAppts.map((appointment, index) => (
                      <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {appointment.title || `${appointment.first_name} ${appointment.last_name}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <CalendarDays className="h-3 w-3 inline mr-1" />
                            {new Date(appointment.appointment_date).toLocaleDateString("de-DE", { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric' 
                            })}
                            {appointment.appointment_time && (
                              <>
                                <Clock className="h-3 w-3 inline ml-2 mr-1" />
                                {appointment.appointment_time.slice(0,5)} Uhr
                              </>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={
                            appointment.status === "confirmed" ? "default" : 
                            appointment.status === "cancelled" ? "destructive" : "secondary"
                          }
                          className="ml-2 flex-shrink-0"
                        >
                          {appointment.status === "confirmed" ? "Bestätigt" :
                           appointment.status === "cancelled" ? "Abgesagt" : "Ausstehend"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </AdminCard>

              {/* Meine Formular-Eingaben */}
              <AdminCard 
                title="Formular-Eingaben" 
                description="Ihnen zugewiesene Formulareingaben"
                actions={
                  <Badge variant="secondary" className="font-mono">
                    {mySubs.length}
                  </Badge>
                }
              >
                {mySubs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ihnen sind keine Eingaben zugewiesen.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mySubs.map((submission) => (
                      <Link 
                        key={submission.id} 
                        to={`/admin/formulare/${submission.id}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:bg-muted/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {!submission.read_at && (
                            <BellDot className="h-4 w-4 text-primary flex-shrink-0 animate-pulse" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">
                              {forms[submission.form_id] || "Formular"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(submission.created_at).toLocaleString("de-DE", {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {!submission.read_at && (
                                <span className="ml-2 text-primary font-semibold">● Neu</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </AdminCard>
            </div>

            {/* Optional: Quick Actions Bereich */}
            <AdminSection spacing="lg">
              <AdminDivider spacing="md" />
              <AdminCard title="Quick Actions" description="Häufig verwendete Aktionen">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Link to="/admin/news">
                    <Button variant="outline" className="w-full justify-start">
                      <Newspaper className="h-4 w-4 mr-2" />
                      News verwalten
                    </Button>
                  </Link>
                  <Link to="/admin/termine">
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Termine verwalten
                    </Button>
                  </Link>
                  <Link to="/admin/formulare">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Formulare
                    </Button>
                  </Link>
                  <Link to="/admin/ai">
                    <Button variant="outline" className="w-full justify-start">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      KI / OCR
                    </Button>
                  </Link>
                </div>
              </AdminCard>
            </AdminSection>
          </>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default Dashboard;