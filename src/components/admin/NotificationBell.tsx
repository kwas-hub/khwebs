import { useEffect, useState } from "react";
import { Bell, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      subtitle: `${a.appointment_date} um ${String(a.appointment_time).slice(0,5)} Uhr`,
      created_at: a.created_at,
      href: "/admin/termine",
    }));
    (subs.data ?? []).forEach((s: any) => list.push({
      id: "s-" + s.id,
      type: "submission",
      title: `Neue Formular-Eingabe`,
      subtitle: new Date(s.created_at).toLocaleString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
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

  const unreadCount = items.filter((i) => i.created_at > seenAt).length;

  const markSeen = () => {
    const now = new Date().toISOString();
    setSeenAt(now);
    localStorage.setItem("notif_seen_at", now);
  };

  return (
    <Popover onOpenChange={(o) => o && markSeen()}>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "relative p-2.5 rounded-xl transition-all duration-200 active:scale-95",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
            unreadCount > 0 ? "text-primary" : "text-muted-foreground"
          )} 
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-[calc(100vw-32px)] sm:w-96 p-0 shadow-2xl border-border/50 backdrop-blur-xl"
      >
        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
          <h3 className="font-bold text-sm tracking-tight">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0">
              {unreadCount} Neu
            </Badge>
          )}
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden scrollbar-thin">
          {items.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Alles erledigt!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((n) => (
                <li key={n.id} className="relative overflow-hidden group">
                  <Link 
                    to={n.href} 
                    className={cn(
                      "flex items-start gap-4 px-4 py-4 transition-colors",
                      n.created_at > seenAt ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "mt-1 p-2 rounded-lg shrink-0",
                      n.type === "appointment" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                    )}>
                      {n.type === "appointment" ? <Calendar className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                          "text-sm leading-none truncate",
                          n.created_at > seenAt ? "font-bold" : "font-medium"
                        )}>
                          {n.title}
                        </p>
                        {n.created_at > seenAt && (
                          <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/80 line-clamp-1 italic">
                        {n.subtitle}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="p-2 border-t bg-muted/10">
          <Link 
            to="/admin/dashboard" 
            className="block w-full py-2 text-center text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            Alle Aktivitäten anzeigen
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};
