import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, CalendarDays, Clock, CheckCircle2 } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({ news: 0, published: 0, pending: 0, upcoming: 0 });

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [news, published, pending, upcoming] = await Promise.all([
        supabase.from("content_blocks").select("id", { count: "exact", head: true }),
        supabase.from("content_blocks").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("appointment_date", today),
      ]);
      setStats({
        news: news.count ?? 0,
        published: published.count ?? 0,
        pending: pending.count ?? 0,
        upcoming: upcoming.count ?? 0,
      });
    };
    load();
  }, []);

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
          <p className="text-muted-foreground">Willkommen im Backend. Übersicht über News & Termine.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-md bg-muted">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Schnellstart</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Erstelle News unter „Aktuelle News"</li>
            <li>Verwalte Verfügbarkeit & Anfragen unter „Termine"</li>
            <li>Aktiviere/Deaktiviere das Buchungs-Widget auf der Webseite</li>
          </ul>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
