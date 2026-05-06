import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

type Notif = { id: string; type: "appointment" | "submission"; title: string; subtitle: string; created_at: string; href: string };

export const NotificationBell = () => {
  const [items, setItems] = useState<Notif[]>([]);
  const [seenAt, setSeenAt] = useState<string>(() => localStorage.getItem("notif_seen_at") || "1970-01-01T00:00:00Z");

  const load = async () => {
    const [appts, subs] = await Promise.all([
      supabase.from("appointments").select("id,first_name,last_name,appointment_date,appointment_time,created_at,status").order("created_at", { ascending: false }).limit(15),
      supabase.from("form_submissions").select("id,form_id,created_at,data").order("created_at", { ascending: false }).limit(15),
    ]);
    const list: Notif[] = [];
    (appts.data ?? []).forEach((a: any) => list.push({
      id: "a-" + a.id,
      type: "appointment",
      title: `Terminanfrage: ${a.first_name} ${a.last_name}`,
      subtitle: `${a.appointment_date} ${String(a.appointment_time).slice(0,5)}`,
      created_at: a.created_at,
      href: "/admin/termine",
    }));
    (subs.data ?? []).forEach((s: any) => list.push({
      id: "s-" + s.id,
      type: "submission",
      title: `Neue Formular-Eingabe`,
      subtitle: new Date(s.created_at).toLocaleString("de-DE"),
      created_at: s.created_at,
      href: "/admin/formulare",
    }));
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setItems(list.slice(0, 20));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "form_submissions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const unread = items.filter((i) => i.created_at > seenAt).length;

  const markSeen = () => {
    const now = new Date().toISOString();
    setSeenAt(now);
    localStorage.setItem("notif_seen_at", now);
  };

  return (
    <Popover onOpenChange={(o) => o && markSeen()}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-zinc-800/60 transition-colors" aria-label="Benachrichtigungen">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[400px] overflow-auto">
        <div className="p-3 border-b font-semibold text-sm">Benachrichtigungen</div>
        {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">Keine Benachrichtigungen.</div>}
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={n.href} className="block px-3 py-2.5 hover:bg-muted transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{n.subtitle}</div>
                  </div>
                  {n.created_at > seenAt && <Badge variant="default" className="h-1.5 w-1.5 p-0 rounded-full" />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
