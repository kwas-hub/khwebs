import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Clock, CalendarDays, Link as LinkIcon, Mail } from "lucide-react";
import { FullCal } from "@/components/admin/FullCal";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

type Slot = { id: string; tenant_id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number; active: boolean };
type Appt = {
  id: string; tenant_id: string; appointment_date: string; appointment_time: string; end_time: string | null;
  title: string | null; salutation: string; first_name: string; last_name: string; phone: string;
  email: string; note: string | null; status: "pending" | "confirmed" | "cancelled";
  source: string; color: string; public_visible: boolean; assigned_user_id: string | null;
};
type ExtCal = { id: string; tenant_id: string; name: string; url: string; color: string; active: boolean; public_visible: boolean; assigned_user_id: string | null };
type Profile = { user_id: string; email: string; display_name: string };
type SiteSettings = { id: string; tenant_id: string; booking_enabled: boolean };

const emptyAppt = (tenantId: string): Partial<Appt> => ({
  appointment_date: new Date().toISOString().slice(0, 10),
  appointment_time: "09:00", end_time: "09:30",
  title: "Eigener Termin", salutation: "", first_name: "", last_name: "",
  phone: "", email: "", note: "", status: "confirmed", source: "manual",
  color: "#0ea5b7", public_visible: false, assigned_user_id: null,
  tenant_id: tenantId,
});

const Termine = () => {
  const { isAdmin, isEditor, isGuest } = useUserRole();
  const { currentTenant, isTenantAdmin } = useTenant();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [extCals, setExtCals] = useState<ExtCal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Partial<Appt> | null>(null);
  const [calDialogOpen, setCalDialogOpen] = useState(false);
  const [editingCal, setEditingCal] = useState<Partial<ExtCal> | null>(null);

  const load = async () => {
    if (!currentTenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      // 🔑 Alle Abfragen mit tenant_id Filter
      const [s, a, st, ec, pr] = await Promise.all([
        supabase.from("availability_slots").select("*").eq("tenant_id", currentTenant.id).order("weekday").order("start_time"),
        supabase.from("appointments").select("*").eq("tenant_id", currentTenant.id).order("appointment_date").order("appointment_time"),
        supabase.from("site_settings").select("*").eq("tenant_id", currentTenant.id).maybeSingle(),
        supabase.from("external_calendars").select("*").eq("tenant_id", currentTenant.id).order("name"),
        supabase.from("profiles").select("user_id, email, display_name"),
      ]);
      
      if (s.data) setSlots(s.data as Slot[]);
      if (a.data) setAppts(a.data as Appt[]);
      if (st.data) { 
        setBookingEnabled(st.data.booking_enabled); 
        setSettingsId(st.data.id); 
      } else if (st.error && st.error.code === 'PGRST116') {
        // Keine Einstellungen vorhanden -> erstellen
        const { data: newSettings } = await supabase
          .from("site_settings")
          .insert({ tenant_id: currentTenant.id, booking_enabled: true })
          .select()
          .single();
        if (newSettings) {
          setBookingEnabled(true);
          setSettingsId(newSettings.id);
        }
      }
      if (ec.data) setExtCals(ec.data as ExtCal[]);
      if (pr.data) setProfiles(pr.data as Profile[]);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { 
    load(); 
  }, [currentTenant?.id]);

  // ---------- Verfügbarkeit ----------
  const addSlot = async () => {
    if (!currentTenant?.id) return;
    const { error } = await supabase.from("availability_slots").insert({
      weekday: 1, start_time: "09:00", end_time: "17:00", slot_minutes: 30, active: true,
      tenant_id: currentTenant.id,
    });
    if (error) toast.error(error.message); else load();
  };
  
  const updateSlot = async (id: string, patch: Partial<Slot>) => {
    if (!currentTenant?.id) return;
    setSlots((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
    const { error } = await supabase
      .from("availability_slots")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message);
  };
  
  const deleteSlot = async (id: string) => {
    if (!currentTenant?.id) return;
    const { error } = await supabase
      .from("availability_slots")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message); else load();
  };
  
  const toggleBooking = async (v: boolean) => {
    if (!currentTenant?.id || !settingsId) return;
    setBookingEnabled(v);
    const { error } = await supabase
      .from("site_settings")
      .update({ booking_enabled: v })
      .eq("id", settingsId)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message);
  };

  // ---------- Termine ----------
  const updateApptDetails = async (id: string, patch: Partial<Appt>) => {
    if (!currentTenant?.id) return;
    setAppts((p) => p.map((a) => a.id === id ? { ...a, ...patch } : a));
    const { error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message);
  };

  const updateApptStatus = async (id: string, status: Appt["status"]) => {
    if (!currentTenant?.id) return;
    const appt = appts.find((a) => a.id === id);
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) { toast.error(error.message); return; }
    
    if (appt && (status === "confirmed" || status === "cancelled") && appt.email) {
      const triggerKey = status === "confirmed" ? "appointment_confirmed" : "appointment_cancelled";
      const niceDate = new Date(appt.appointment_date).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const { error: mailErr } = await supabase.functions.invoke("send-template-email", {
        body: {
          to: appt.email,
          triggerKey,
          vars: {
            salutation: appt.salutation || "",
            first_name: appt.first_name || "",
            last_name: appt.last_name || "",
            full_name: `${appt.salutation || ""} ${appt.first_name || ""} ${appt.last_name || ""}`.trim(),
            date: niceDate,
            time: (appt.appointment_time || "").slice(0, 5),
            title: appt.title || "",
            note: appt.note || "",
          },
        },
      });
      if (mailErr) toast.error("Status gespeichert, E-Mail fehlgeschlagen: " + mailErr.message);
      else toast.success(status === "confirmed" ? "Bestätigt – Mail gesendet" : "Abgelehnt – Mail gesendet");
    } else {
      toast.success("Status aktualisiert");
    }
    load();
  };

  const deleteAppt = async (id: string) => {
    if (!currentTenant?.id) return;
    if (!confirm("Termin wirklich löschen?")) return;
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message); else load();
  };

  const saveAppt = async () => {
    if (!editingAppt || !currentTenant?.id) return;
    const payload: any = { ...editingAppt, tenant_id: currentTenant.id };
    delete payload.id;
    payload.appointment_time = payload.appointment_time?.length === 5 ? `${payload.appointment_time}:00` : payload.appointment_time;
    if (payload.end_time && payload.end_time.length === 5) payload.end_time = `${payload.end_time}:00`;
    
    if (editingAppt.id) {
      const { error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", editingAppt.id)
        .eq("tenant_id", currentTenant.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("appointments").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Termin gespeichert");
    setDialogOpen(false); setEditingAppt(null); load();
  };

  // ---------- Externe Kalender ----------
  const saveExtCal = async () => {
    if (!editingCal || !currentTenant?.id) return;
    if (!editingCal.name || !editingCal.url) {
      toast.error("Name und URL erforderlich"); return;
    }
    const payload = {
      tenant_id: currentTenant.id,
      name: editingCal.name, 
      url: editingCal.url,
      color: editingCal.color || "#7c3aed", 
      active: editingCal.active ?? true,
      public_visible: editingCal.public_visible ?? false,
      assigned_user_id: editingCal.assigned_user_id || null,
    };
    if (editingCal.id) {
      const { error } = await supabase
        .from("external_calendars")
        .update(payload)
        .eq("id", editingCal.id)
        .eq("tenant_id", currentTenant.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("external_calendars").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Kalender gespeichert");
    setCalDialogOpen(false); setEditingCal(null); load();
  };
  
  const deleteExtCal = async (id: string) => {
    if (!currentTenant?.id) return;
    if (!confirm("Kalender wirklich löschen?")) return;
    const { error } = await supabase
      .from("external_calendars")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error(error.message); else load();
  };

  const filteredAppts = useMemo(
    () => appts.filter((a) => statusFilter === "all" ? true : a.status === statusFilter),
    [appts, statusFilter]
  );

  const visibleExtCals = useMemo(
    () => isGuest ? extCals.filter((c) => c.public_visible && c.active) : extCals,
    [extCals, isGuest]
  );

  // Berechtigungen: Bearbeiten nur für Tenant-Admins oder globale Admins
  const canEdit = isTenantAdmin || isAdmin;

  // Kein Mandant ausgewählt
  if (!currentTenant) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Termine</h1>
          <Card className="p-12 text-center text-muted-foreground">
            <p>Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // Ladezustand
  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Termine</h1>
          <Card className="p-12 text-center text-muted-foreground">
            <p>Lade Termine...</p>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 text-foreground">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Termine</h1>
            <p className="text-sm text-muted-foreground">
              Mandant: <span className="font-medium">{currentTenant.name}</span>
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Switch checked={bookingEnabled} onCheckedChange={toggleBooking} />
              <Label>Buchung im Frontend {bookingEnabled ? "aktiv" : "ausgeblendet"}</Label>
            </div>
          )}
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="bg-muted/50 border flex-wrap h-auto">
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
            {canEdit && <TabsTrigger value="list">Liste</TabsTrigger>}
            {canEdit && <TabsTrigger value="availability">Verfügbarkeit</TabsTrigger>}
            {canEdit && <TabsTrigger value="external">Externe Kalender</TabsTrigger>}
            {isAdmin && <TabsTrigger value="emails">E-Mail-Vorlagen</TabsTrigger>}
          </TabsList>

          {/* ============= KALENDER ============= */}
          <TabsContent value="calendar" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="pending">Offen</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                  <SelectItem value="cancelled">Abgesagt</SelectItem>
                </SelectContent>
              </Select>
              {canEdit && (
                <Button onClick={() => { setEditingAppt(emptyAppt(currentTenant.id)); setDialogOpen(true); }} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Termin erstellen
                </Button>
              )}
              {extCals.length > 0 && (
                <div className="flex gap-2 ml-auto flex-wrap">
                  {visibleExtCals.filter((c) => c.active).map((c) => (
                    <span key={c.id} className="text-xs flex items-center gap-1.5 bg-muted px-2 py-1 rounded">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Card className="p-2 md:p-4 bg-card border-border">
              <FullCal
                appointments={isGuest ? appts.filter((a) => a.public_visible) : appts}
                externalCalendars={visibleExtCals}
                statusFilter={statusFilter}
                onEventClick={(id) => {
                  if (!canEdit) return;
                  const a = appts.find((x) => x.id === id);
                  if (a) {
                    setEditingAppt({ ...a, appointment_time: a.appointment_time.slice(0,5), end_time: a.end_time?.slice(0,5) || null });
                    setDialogOpen(true);
                  }
                }}
                onDateClick={(d) => {
                  if (!canEdit) return;
                  setEditingAppt({ ...emptyAppt(currentTenant.id), appointment_date: d.toISOString().slice(0,10) });
                  setDialogOpen(true);
                }}
              />
            </Card>
          </TabsContent>

          {/* ============= LISTE ============= */}
          {canEdit && (
            <TabsContent value="list" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <Label>Filter:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="pending">Offen</SelectItem>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="cancelled">Abgesagt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="hidden md:block overflow-x-auto bg-card border-border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[130px]">Datum/Zeit</TableHead>
                      <TableHead className="w-[160px]">Titel/Quelle</TableHead>
                      <TableHead className="w-[180px]">Person</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Notiz</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppts.map((a) => {
                      const isManual = a.source === "manual";
                      return (
                        <TableRow key={a.id} className="hover:bg-muted/30 align-top">
                          <TableCell className="space-y-1">
                            <Input type="date" className="h-7 text-[11px] bg-background" value={a.appointment_date} onChange={(e) => updateApptDetails(a.id, { appointment_date: e.target.value })} />
                            <div className="flex gap-1">
                              <Input type="time" className="h-7 text-[11px] bg-background font-bold" value={a.appointment_time.slice(0,5)} onChange={(e) => updateApptDetails(a.id, { appointment_time: e.target.value + ":00" })} />
                              <Input type="time" className="h-7 text-[11px] bg-background" value={a.end_time?.slice(0,5) || ""} placeholder="Ende" onChange={(e) => updateApptDetails(a.id, { end_time: e.target.value ? e.target.value + ":00" : null })} />
                            </div>
                          </TableCell>
                          <TableCell className="space-y-1">
                            <Input 
                              className="h-7 text-xs bg-background" 
                              placeholder="Titel" 
                              value={!isManual ? "Anfrage" : (a.title || "")} 
                              onChange={(e) => updateApptDetails(a.id, { title: e.target.value })} 
                            />
                            <div className="text-[10px] text-muted-foreground uppercase">{a.source}</div>
                            <label className="flex items-center gap-1 text-[10px]">
                              <input type="checkbox" checked={a.public_visible} onChange={(e) => updateApptDetails(a.id, { public_visible: e.target.checked })} /> öffentlich
                            </label>
                          </TableCell>
                          <TableCell className="space-y-1">
                            {!isManual && (
                              <>
                                <Select value={a.salutation || "_none"} onValueChange={(v) => updateApptDetails(a.id, { salutation: v === "_none" ? "" : v })}>
                                  <SelectTrigger className="h-7 text-[11px] bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">—</SelectItem>
                                    <SelectItem value="Herr">Herr</SelectItem>
                                    <SelectItem value="Frau">Frau</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input className="h-7 text-xs bg-background" placeholder="Vorname" value={a.first_name} onChange={(e) => updateApptDetails(a.id, { first_name: e.target.value })} />
                                <Input className="h-7 text-xs bg-background font-medium" placeholder="Nachname" value={a.last_name} onChange={(e) => updateApptDetails(a.id, { last_name: e.target.value })} />
                              </>
                            )}
                          </TableCell>
                          <TableCell className="space-y-1">
                            {!isManual && (
                              <>
                                <Input className="h-7 text-xs bg-background" placeholder="Telefon" value={a.phone || ""} onChange={(e) => updateApptDetails(a.id, { phone: e.target.value })} />
                                <Input className="h-7 text-xs bg-background" placeholder="E-Mail" value={a.email || ""} onChange={(e) => updateApptDetails(a.id, { email: e.target.value })} />
                              </>
                            )}
                            <Select value={a.assigned_user_id || "_none"} onValueChange={(v) => updateApptDetails(a.id, { assigned_user_id: v === "_none" ? null : v })}>
                              <SelectTrigger className="h-7 text-[11px] bg-background"><SelectValue placeholder="User..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">— kein User —</SelectItem>
                                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.email}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Textarea className="h-16 text-xs bg-background" value={a.note || ""} onChange={(e) => updateApptDetails(a.id, { note: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v as Appt["status"])}>
                              <SelectTrigger className={`h-8 text-xs font-bold ${a.status === 'confirmed' ? 'text-green-600' : a.status === 'cancelled' ? 'text-destructive' : 'text-orange-500'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Offen</SelectItem>
                                <SelectItem value="confirmed">Bestätigt</SelectItem>
                                <SelectItem value="cancelled">Abgesagt</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteAppt(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {filteredAppts.map((a) => (
                  <Card key={a.id} className="p-4 bg-card border-border space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {new Date(a.appointment_date).toLocaleDateString("de-DE")} - {a.appointment_time.slice(0,5)}
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8 -mt-1 -mr-1" onClick={() => deleteAppt(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setEditingAppt({ ...a, appointment_time: a.appointment_time.slice(0,5), end_time: a.end_time?.slice(0,5) || null }); setDialogOpen(true); }}>
                      Bearbeiten
                    </Button>
                    <div className="text-xs">{a.first_name} {a.last_name} · {a.email}</div>
                    <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v as Appt["status"])}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="confirmed">Bestätigt</SelectItem>
                        <SelectItem value="cancelled">Abgesagt</SelectItem>
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
              </div>
              {filteredAppts.length === 0 && <p className="text-center py-10 text-muted-foreground">Keine Termine.</p>}
            </TabsContent>
          )}

          {/* ============= VERFÜGBARKEIT ============= */}
          {canEdit && (
            <TabsContent value="availability" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Verfügbare Zeitfenster (Frontend-Buchung)</h3>
                </div>
                <Button onClick={addSlot} size="sm"><Plus className="mr-2 h-4 w-4" />Neues Fenster</Button>
              </div>
              <div className="grid gap-3">
                {slots.map((s) => (
                  <Card key={s.id} className={`p-4 border-l-4 ${s.active ? 'border-l-primary bg-card' : 'border-l-muted bg-muted/20 opacity-70'} border-border`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Wochentag</Label>
                        <Select value={String(s.weekday)} onValueChange={(v) => updateSlot(s.id, { weekday: Number(v) })}>
                          <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Von</Label>
                        <Input className="bg-background h-9" type="time" value={s.start_time.slice(0,5)} onChange={(e) => updateSlot(s.id, { start_time: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bis</Label>
                        <Input className="bg-background h-9" type="time" value={s.end_time.slice(0,5)} onChange={(e) => updateSlot(s.id, { end_time: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Slot (Min)</Label>
                        <Input className="bg-background h-9" type="number" min={5} step={5} value={s.slot_minutes} onChange={(e) => updateSlot(s.id, { slot_minutes: Number(e.target.value) })} />
                      </div>
                      <div className="flex items-center gap-2 pb-2 h-9">
                        <Switch checked={s.active} onCheckedChange={(v) => updateSlot(s.id, { active: v })} />
                        <Label className="text-xs">Aktiv</Label>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive ml-auto" onClick={() => deleteSlot(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ============= EXTERNE KALENDER ============= */}
          {canEdit && (
            <TabsContent value="external" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Externe Kalender (ICS-URL)</h3>
                </div>
                <Button onClick={() => { setEditingCal({ name: "", url: "", color: "#7c3aed", active: true, public_visible: false, tenant_id: currentTenant.id }); setCalDialogOpen(true); }} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Hinzufügen
                </Button>
              </div>
              <div className="grid gap-2">
                {extCals.map((c) => (
                  <Card key={c.id} className="p-3 flex items-center gap-3 bg-card border-border">
                    <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.url}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {c.active ? <Badge>Aktiv</Badge> : <Badge variant="secondary">Inaktiv</Badge>}
                      {c.public_visible && <Badge variant="outline">Öffentlich</Badge>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setEditingCal(c); setCalDialogOpen(true); }}>Bearbeiten</Button>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteExtCal(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
                {extCals.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Noch keine externen Kalender. Z.B. .ics-Link von Google/Apple/Outlook einfügen.</p>}
              </div>
            </TabsContent>
          )}

          {/* ============= E-MAIL-VORLAGEN ============= */}
          {isAdmin && (
            <TabsContent value="emails" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="font-bold">E-Mail-Vorlagen für Terminanfragen</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <EmailTemplateEditor
                  triggerKey="appointment_confirmed"
                  title="✓ Bestätigung"
                  description="Wird gesendet, wenn ein Termin bestätigt wird."
                  variableHints={["full_name", "salutation", "first_name", "last_name", "date", "time", "title", "note"]}
                  defaultSubject="Ihr Termin wurde bestätigt"
                  defaultBody={`Sehr geehrte/r {{full_name}},

wir freuen uns, Ihnen Ihren Termin am {{date}} um {{time}} Uhr zu bestätigen.

Mit freundlichen Grüßen
KH Webs`}
                />
                <EmailTemplateEditor
                  triggerKey="appointment_cancelled"
                  title="✗ Absage"
                  description="Wird gesendet, wenn eine Anfrage abgelehnt wird."
                  variableHints={["full_name", "salutation", "first_name", "last_name", "date", "time", "title", "note"]}
                  defaultSubject="Ihre Terminanfrage wurde abgelehnt"
                  defaultBody={`Sehr geehrte/r {{full_name}},

leider können wir Ihren Wunschtermin am {{date}} um {{time}} Uhr nicht bestätigen.

Mit freundlichen Grüßen
KH Webs`}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* ============= TERMIN DIALOG ============= */}
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingAppt(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAppt?.id ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
            </DialogHeader>
            {editingAppt && (
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Titel</Label>
                    <Input value={editingAppt.source !== 'manual' ? "Anfrage" : (editingAppt.title || "")} onChange={(e) => setEditingAppt({ ...editingAppt, title: e.target.value })} />
                  </div>
                  <div><Label>Datum</Label><Input type="date" value={editingAppt.appointment_date || ""} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Von</Label><Input type="time" value={(editingAppt.appointment_time || "").slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_time: e.target.value })} /></div>
                    <div><Label>Bis</Label><Input type="time" value={(editingAppt.end_time || "").toString().slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, end_time: e.target.value })} /></div>
                  </div>
                  
                  {editingAppt.source !== 'manual' && (
                    <>
                      <div><Label>Anrede</Label>
                        <Select value={editingAppt.salutation || "_none"} onValueChange={(v) => setEditingAppt({ ...editingAppt, salutation: v === "_none" ? "" : v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">—</SelectItem>
                            <SelectItem value="Herr">Herr</SelectItem>
                            <SelectItem value="Frau">Frau</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div /> {/* Spacer */}
                      <div><Label>Vorname</Label><Input value={editingAppt.first_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, first_name: e.target.value })} /></div>
                      <div><Label>Nachname</Label><Input value={editingAppt.last_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, last_name: e.target.value })} /></div>
                      <div><Label>Telefon</Label><Input value={editingAppt.phone || ""} onChange={(e) => setEditingAppt({ ...editingAppt, phone: e.target.value })} /></div>
                      <div><Label>E-Mail</Label><Input value={editingAppt.email || ""} onChange={(e) => setEditingAppt({ ...editingAppt, email: e.target.value })} /></div>
                    </>
                  )}

                  <div><Label>Status</Label>
                    <Select value={editingAppt.status || "pending"} onValueChange={(v) => setEditingAppt({ ...editingAppt, status: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="confirmed">Bestätigt</SelectItem>
                        <SelectItem value="cancelled">Abgesagt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Farbe</Label><Input type="color" value={editingAppt.color || "#0ea5b7"} onChange={(e) => setEditingAppt({ ...editingAppt, color: e.target.value })} /></div>
                  <div><Label>Zugewiesener User</Label>
                    <Select value={editingAppt.assigned_user_id || "_none"} onValueChange={(v) => setEditingAppt({ ...editingAppt, assigned_user_id: v === "_none" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— kein User —</SelectItem>
                        {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Notiz</Label><Textarea value={editingAppt.note || ""} onChange={(e) => setEditingAppt({ ...editingAppt, note: e.target.value })} /></div>
                  <div className="col-span-2 flex items-center gap-2 pt-2">
                    <Switch checked={editingAppt.public_visible || false} onCheckedChange={(v) => setEditingAppt({ ...editingAppt, public_visible: v })} />
                    <Label>Veröffentlichen (für andere User sichtbar)</Label>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={saveAppt}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============= EXT-KALENDER DIALOG ============= */}
        <Dialog open={calDialogOpen} onOpenChange={(v) => { setCalDialogOpen(v); if (!v) setEditingCal(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCal?.id ? "Kalender bearbeiten" : "Externer Kalender (ICS)"}</DialogTitle>
            </DialogHeader>
            {editingCal && (
              <div className="grid gap-3 py-2">
                <div><Label>Name</Label><Input value={editingCal.name || ""} onChange={(e) => setEditingCal({ ...editingCal, name: e.target.value })} /></div>
                <div><Label>ICS-URL (https:// oder webcal://)</Label><Input value={editingCal.url || ""} onChange={(e) => setEditingCal({ ...editingCal, url: e.target.value })} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Farbe</Label><Input type="color" value={editingCal.color || "#7c3aed"} onChange={(e) => setEditingCal({ ...editingCal, color: e.target.value })} /></div>
                  <div><Label>Zugewiesener User</Label>
                    <Select value={editingCal.assigned_user_id || "_none"} onValueChange={(v) => setEditingCal({ ...editingCal, assigned_user_id: v === "_none" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— kein User —</SelectItem>
                        {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={editingCal.active ?? true} onCheckedChange={(v) => setEditingCal({ ...editingCal, active: v })} /><Label>Aktiv</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editingCal.public_visible || false} onCheckedChange={(v) => setEditingCal({ ...editingCal, public_visible: v })} /><Label>Veröffentlichen (für andere User sichtbar)</Label></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCalDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={saveExtCal}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Termine;
