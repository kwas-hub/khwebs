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
import { Plus, Trash2 } from "lucide-react";

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
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Termine</h1>
          <div className="flex items-center gap-2">
            <Switch checked={bookingEnabled} onCheckedChange={toggleBooking} />
            <Label>Buchung im Frontend {bookingEnabled ? "aktiv" : "ausgeblendet"}</Label>
          </div>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
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
              <Card className="p-4">
                <Calendar
                  mode="single"
                  selected={calDate}
                  onSelect={setCalDate}
                  modifiers={{ booked: (d) => apptDates.has(d.toISOString().split("T")[0]) }}
                  modifiersClassNames={{ booked: "bg-primary/20 font-bold" }}
                />
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-3">
                  {calDate?.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </h3>
                {dayAppts.length === 0 && <p className="text-muted-foreground text-sm">Keine Termine.</p>}
                <ul className="space-y-2">
                  {dayAppts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="font-medium">{a.appointment_time.slice(0,5)} – {a.first_name} {a.last_name}</div>
                        <div className="text-xs text-muted-foreground">{a.email} · {a.phone}</div>
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

          <TabsContent value="list" className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Filter:</Label>
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
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Termin</TableHead>
                    <TableHead>Anrede</TableHead>
                    <TableHead>Vorname</TableHead>
                    <TableHead>Nachname</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.appointment_date} {a.appointment_time.slice(0,5)}</TableCell>
                      <TableCell>{a.salutation}</TableCell>
                      <TableCell>{a.first_name}</TableCell>
                      <TableCell>{a.last_name}</TableCell>
                      <TableCell>{a.phone}</TableCell>
                      <TableCell>{a.email}</TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v as Appt["status"])}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Offen</SelectItem>
                            <SelectItem value="confirmed">Bestätigt</SelectItem>
                            <SelectItem value="cancelled">Abgesagt</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteAppt(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAppts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Keine Termine.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Lege fest an welchen Wochentagen und Uhrzeiten Termine angefragt werden können.</p>
              <Button onClick={addSlot}><Plus className="mr-2 h-4 w-4" />Zeitfenster</Button>
            </div>
            <div className="grid gap-3">
              {slots.map((s) => (
                <Card key={s.id} className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div>
                    <Label>Wochentag</Label>
                    <Select value={String(s.weekday)} onValueChange={(v) => updateSlot(s.id, { weekday: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Von</Label>
                    <Input type="time" value={s.start_time.slice(0,5)} onChange={(e) => updateSlot(s.id, { start_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>Bis</Label>
                    <Input type="time" value={s.end_time.slice(0,5)} onChange={(e) => updateSlot(s.id, { end_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>Dauer (Min)</Label>
                    <Input type="number" min={5} step={5} value={s.slot_minutes} onChange={(e) => updateSlot(s.id, { slot_minutes: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.active} onCheckedChange={(v) => updateSlot(s.id, { active: v })} />
                    <Label>Aktiv</Label>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => deleteSlot(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
              {slots.length === 0 && <p className="text-muted-foreground text-center py-6">Noch keine Zeitfenster.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Termine;
