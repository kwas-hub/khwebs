import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Newspaper, CalendarDays, Clock, CheckCircle2, FileText, ExternalLink, BellDot } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { userId } = useAuth();
  const [stats, setStats] = useState({ news: 0, published: 0, pending: 0, upcoming: 0 });
  const [myAppts, setMyAppts] = useState<any[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [news, pub, pend, up, ap, sb, fm] = await Promise.all([
        supabase.from("content_blocks").select("id", { count: "exact", head: true }),
        supabase.from("content_blocks").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("appointment_date", today),
        supabase.from("appointments").select("*")
          .eq("assigned_user_id", userId).gte("appointment_date", today)
          .order("appointment_date").order("appointment_time").limit(10),
        supabase.from("form_submissions").select("*")
          .eq("assigned_user_id", userId).order("assigned_at", { ascending: false }).limit(15),
        supabase.from("forms").select("id,title"),
      ]);
      setStats({
        news: news.count ?? 0, published: pub.count ?? 0,
        pending: pend.count ?? 0, upcoming: up.count ?? 0,
      });
      setMyAppts(ap.data ?? []);
      setMySubs(sb.data ?? []);
      const fmap: Record<string, string> = {};
      (fm.data ?? []).forEach((f: any) => { fmap[f.id] = f.title; });
      setForms(fmap);
    };
    load();
  }, [userId]);

  const cards = [
    { label: "News-Bereiche", value: stats.news, icon: Newspaper },
    { label: "Veröffentlicht", value: stats.published, icon: CheckCircle2 },
    { label: "Offene Anfragen", value: stats.pending, icon: Clock },
    { label: "Kommende Termine", value: stats.upcoming, icon: CalendarDays },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Übersicht & deine zugewiesenen Aufgaben.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-md bg-muted"><c.icon className="h-5 w-5" /></div>
              <div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Meine Termine</h2>
              <Badge variant="secondary">{myAppts.length}</Badge>
            </div>
            {myAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine zugewiesenen Termine.</p>
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
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Meine Formular-Eingaben</h2>
              <Badge variant="secondary">{mySubs.length}</Badge>
            </div>
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
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
