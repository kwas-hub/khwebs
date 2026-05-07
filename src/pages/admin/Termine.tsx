import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Clock, CalendarDays } from "lucide-react";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

type Slot = { id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number; active: boolean };
type Appt = { id: string; appointment_date: string; appointment_time: string; salutation: string; first_name: string; last_name: string; phone: string; email: string; note: string | null; status: "pending" | "confirmed" | "cancelled" };

const Termine = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [calDate, setCalDate] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    const [s, a, st] = await Promise.all([
      supabase.from("availability_slots").select("*").order("weekday").order("start_time"),
      supabase.from("appointments").select("*").order("appointment_date").order("appointment_time"),
      supabase.from("site_settings").select("*").limit(1).maybeSingle(),
    ]);
    if (s.data) setSlots(s.data as Slot[]);
    if (a.data) setAppts(a.data as Appt[]);
    if (st.data) { setBookingEnabled(st.data.booking_enabled); setSettingsId(st.data.id); }
  };
  useEffect(() => { load(); }, []);

  const addSlot = async () => {
    const { error } = await supabase.from("availability_slots").insert({
      weekday: 1, start_time: "09:00", end_time: "17:00", slot_minutes: 30, active: true,
    });
    if (error) toast.error(error.message); else load();
  };

  const updateSlot = async (id: string, patch: Partial<Slot>) => {
    setSlots((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
    const { error } = await supabase.from("availability_slots").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from("availability_slots").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const toggleBooking = async (v: boolean) => {
    setBookingEnabled(v);
    if (!settingsId) return;
    const { error } = await supabase.from("site_settings").update({ booking_enabled: v }).eq("id", settingsId);
    if (error) toast.error(error.message);
  };

  // Neu: Funktion zum Editieren aller Text-Felder eines Termins
  const updateApptDetails = async (id: string, patch: Partial<Appt>) => {
    setAppts((p) => p.map((a) => a.id === id ? { ...a, ...patch } : a));
    const { error } = await supabase.from("appointments").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const updateApptStatus = async (id: string, status: Appt["status"]) => {
    const appt = appts.find((a) => a.id === id);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (appt && (status === "confirmed" || status === "cancelled")) {
      const { error: mailErr } = await supabase.functions.invoke("send-appointment-email", {
        body: {
          to: appt.email,
          firstName: appt.first_name,
          lastName: appt.last_name,
          salutation: appt.salutation,
          date: appt.appointment_date,
          time: appt.appointment_time,
          status,
        },
      });
      if (mailErr) toast.error("Status gespeichert, E-Mail fehlgeschlagen: " + mailErr.message);
      else toast.success(status === "confirmed" ? "Termin bestätigt – Mail gesendet" : "Termin abgelehnt – Mail gesendet");
    }
    load();
  };

  const deleteAppt = async (id: string) => {
    if (!confirm("Termin wirklich löschen?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const filteredAppts = useMemo(
    () => appts.filter((a) => statusFilter === "all" ? true : a.status === statusFilter),
    [appts, statusFilter]
  );

  const apptDates = useMemo(() => new Set(appts.map((a) => a.appointment_date)), [appts]);
  const dayAppts = useMemo(() => {
    if (!calDate) return [];
    const d = calDate.toISOString().split("T")[0];
    return appts.filter((a) => a.appointment_date === d).filter((a) => statusFilter === "all" ? true : a.status === statusFilter);
  }, [appts, calDate, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6 text-foreground">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Termine</h1>
          <div className="flex items-center gap-2">
            <Switch checked={bookingEnabled} onCheckedChange={toggleBooking} />
            <Label>Buchung im Frontend {bookingEnabled ? "aktiv" : "ausgeblendet"}</Label>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
            <TabsTrigger value="availability">Verfügbarkeit</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label>Status-Filter:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="pending">Offen</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                  <SelectItem value="cancelled">Abgesagt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-4 bg-card border-border">
                <Calendar
                  mode="single"
                  selected={calDate}
                  onSelect={setCalDate}
                  modifiers={{ booked: (d) => apptDates.has(d.toISOString().split("T")[0]) }}
                  modifiersClassNames={{ booked: "bg-primary text-primary-foreground font-bold rounded-md" }}
                />
              </Card>
              <Card className="p-4 bg-card border-border">
                <h3 className="font-semibold mb-3">
                  {calDate?.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </h3>
                {dayAppts.length === 0 && <p className="text-muted-foreground text-sm">Keine Termine.</p>}
                <ul className="space-y-2">
                  {dayAppts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between border-b border-border pb-2">
                      <div>
                        <div className="font-medium">{a.appointment_time.slice(0,5)} – {a.first_name} {a.last_name}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </div>
                      <Badge variant={a.status === "confirmed" ? "default" : a.status === "pending" ? "secondary" : "destructive"}>
                        {a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
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

            {/* Desktop Ansicht */}
            <Card className="hidden md:block overflow-hidden bg-card border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">Datum/Zeit</TableHead>
                    <TableHead className="w-[100px]">Person</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppts.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="space-y-1">
                        <Input type="date" className="h-7 text-[11px] bg-background border-none p-1" value={a.appointment_date} onChange={(e) => updateApptDetails(a.id, { appointment_date: e.target.value })} />
                        <Input type="time" className="h-7 text-[11px] bg-background border-none p-1 font-bold" value={a.appointment_time.slice(0,5)} onChange={(e) => updateApptDetails(a.id, { appointment_time: e.target.value })} />
                      </TableCell>
                      <TableCell className="space-y-1">
                         <Select value={a.salutation} onValueChange={(v) => updateApptDetails(a.id, { salutation: v })}>
                            <SelectTrigger className="h-7 text-[11px] bg-background border-none py-0 px-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Herr">Herr</SelectItem>
                              <SelectItem value="Frau">Frau</SelectItem>
                            </SelectContent>
                         </Select>
                        <Input className="h-7 text-xs bg-background" value={a.first_name} onChange={(e) => updateApptDetails(a.id, { first_name: e.target.value })} />
                        <Input className="h-7 text-xs bg-background font-medium" value={a.last_name} onChange={(e) => updateApptDetails(a.id, { last_name: e.target.value })} />
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Input className="h-7 text-xs bg-background" value={a.phone} onChange={(e) => updateApptDetails(a.id, { phone: e.target.value })} />
                        <Input className="h-7 text-xs bg-background" value={a.email} onChange={(e) => updateApptDetails(a.id, { email: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v as Appt["status"])}>
                          <SelectTrigger className={`w-32 h-8 text-xs font-bold border-none shadow-none ${a.status === 'confirmed' ? 'text-green-600' : a.status === 'cancelled' ? 'text-destructive' : 'text-orange-500'}`}>
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
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile Ansicht */}
            <div className="md:hidden space-y-3">
              {filteredAppts.map((a) => (
                <Card key={a.id} className="p-4 bg-card border-border space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 font-bold">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {new Date(a.appointment_date).toLocaleDateString("de-DE")} - {a.appointment_time.slice(0,5)}
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8 -mt-1 -mr-1" onClick={() => deleteAppt(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                      <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v as Appt["status"])}>
                        <SelectTrigger className="h-8 bg-background border-none p-0 h-auto font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Offen</SelectItem>
                          <SelectItem value="confirmed">Bestätigt</SelectItem>
                          <SelectItem value="cancelled">Abgesagt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Name</Label>
                      <div className="font-medium">{a.first_name} {a.last_name}</div>
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-border">
                    <div className="text-xs">{a.email}</div>
                    <div className="text-xs text-muted-foreground">{a.phone}</div>
                  </div>
                </Card>
              ))}
            </div>
            {filteredAppts.length === 0 && <p className="text-center py-10 text-muted-foreground">Keine Termine vorhanden.</p>}
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Verfügbare Zeitfenster</h3>
              </div>
              <Button onClick={addSlot} size="sm"><Plus className="mr-2 h-4 w-4" />Neues Fenster</Button>
            </div>

            <div className="grid gap-3">
              {slots.map((s) => (
                <Card key={s.id} className={`p-4 transition-all border-l-4 ${s.active ? 'border-l-primary bg-card' : 'border-l-muted bg-muted/20 opacity-70'} border-border`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Wochentag</Label>
                      <Select value={String(s.weekday)} onValueChange={(v) => updateSlot(s.id, { weekday: Number(v) })}>
                        <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                        </SelectContent>
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
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground text-nowrap">Slot (Min)</Label>
                      <Input className="bg-background h-9" type="number" min={5} step={5} value={s.slot_minutes} onChange={(e) => updateSlot(s.id, { slot_minutes: Number(e.target.value) })} />
                    </div>
                    <div className="flex items-center gap-2 pb-2 h-9">
                      <Switch checked={s.active} onCheckedChange={(v) => updateSlot(s.id, { active: v })} id={`active-${s.id}`} />
                      <Label htmlFor={`active-${s.id}`} className="text-xs font-bold">{s.active ? "Aktiv" : "Inaktiv"}</Label>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 hover:bg-destructive/10" onClick={() => deleteSlot(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {slots.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                  Keine Zeitfenster definiert. Füge eines hinzu, um Buchungen zu ermöglichen.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Termine;
