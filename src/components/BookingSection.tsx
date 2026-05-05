import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Slot = { id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number; active: boolean };

function generateTimes(slot: Slot): string[] {
  const out: string[] = [];
  const [sh, sm] = slot.start_time.split(":").map(Number);
  const [eh, em] = slot.end_time.split(":").map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur + slot.slot_minutes <= end) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += slot.slot_minutes;
  }
  return out;
}

const BookingSection = () => {
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("");
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ salutation: "Herr", first_name: "", last_name: "", phone: "", email: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: sl }] = await Promise.all([
        supabase.from("site_settings").select("booking_enabled").limit(1).maybeSingle(),
        supabase.from("availability_slots").select("*").eq("active", true),
      ]);
      setEnabled(st?.booking_enabled ?? false);
      setSlots((sl ?? []) as Slot[]);
    })();
  }, []);

  // Load taken slots for selected month
  useEffect(() => {
    if (!date) return;
    const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
    supabase.rpc("get_taken_slots", { _from: from, _to: to }).then(({ data }) => {
      setTaken(new Set((data ?? []).map((r: any) => `${r.appointment_date}_${r.appointment_time.slice(0,5)}`)));
    });
  }, [date]);

  const availableTimes = useMemo(() => {
    if (!date) return [];
    const wd = date.getDay();
    const daySlots = slots.filter((s) => s.weekday === wd);
    const all = daySlots.flatMap(generateTimes);
    const dStr = date.toISOString().split("T")[0];
    return all.filter((t) => !taken.has(`${dStr}_${t}`));
  }, [date, slots, taken]);

  const isDayAvailable = (d: Date) => {
    if (d < new Date(new Date().toDateString())) return false;
    return slots.some((s) => s.weekday === d.getDay());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) { toast.error("Bitte Datum und Uhrzeit wählen"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      appointment_date: date.toISOString().split("T")[0],
      appointment_time: time,
      ...form,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Termin erfolgreich angefragt!");
    setForm({ salutation: "Herr", first_name: "", last_name: "", phone: "", email: "", note: "" });
    setTime("");
  };

  if (!enabled) return null;

  return (
    <section id="termine" className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">Termin anfragen</h2>
          <p className="text-muted-foreground">Wähle Tag, Uhrzeit und sende uns deine Anfrage.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-4">
            <Label className="mb-2 block">1. Tag wählen</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setTime(""); }}
              disabled={(d) => !isDayAvailable(d)}
            />
          </Card>
          <Card className="p-4 space-y-3">
            <Label className="block">2. Uhrzeit wählen</Label>
            {!date && <p className="text-muted-foreground text-sm">Bitte zuerst einen Tag wählen.</p>}
            {date && availableTimes.length === 0 && <p className="text-muted-foreground text-sm">Keine freien Zeiten an diesem Tag.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableTimes.map((t) => (
                <Button key={t} type="button" variant={time === t ? "default" : "outline"} size="sm" onClick={() => setTime(t)}>
                  {t}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        {date && time && (
          <Card className="p-6">
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 text-sm text-muted-foreground">
                Termin: <strong>{date.toLocaleDateString("de-DE")} um {time}</strong>
              </div>
              <div>
                <Label>Anrede</Label>
                <Select value={form.salutation} onValueChange={(v) => setForm({ ...form, salutation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Herr">Herr</SelectItem>
                    <SelectItem value="Frau">Frau</SelectItem>
                    <SelectItem value="Divers">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div>
                <Label>Vorname</Label>
                <Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Bemerkung</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={4} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Wird gesendet..." : "Termin anfragen"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </section>
  );
};

export default BookingSection;
