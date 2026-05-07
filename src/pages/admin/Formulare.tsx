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
import { Plus, Trash2, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Formulare = () => {
  const [appts, setAppts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);

  // 1. Funktion für komplett frische Termine (Ohne ID!)
  const createFreshAppt = (initialDate = new Date().toISOString().slice(0, 10)) => {
    return {
      title: "Anfrage", // Dein Wunsch: Titel standardmäßig "Anfrage"
      appointment_date: initialDate,
      appointment_time: "10:00",
      end_time: "11:00",
      status: "pending",
      public_visible: false,
      color: "#0ea5e9",
      // WICHTIG: Keine ID hier definieren!
    };
  };

  const loadAppts = async () => {
    const { data } = await supabase.from("appointments").select("*").order("appointment_date");
    setAppts(data || []);
  };

  useEffect(() => { loadAppts(); }, []);

  const saveAppt = async () => {
    const { error } = await supabase.from("appointments").upsert(editingAppt);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setDialogOpen(false);
    loadAppts();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Terminverwaltung</h1>
          <Button onClick={() => { 
            setEditingAppt(createFreshAppt()); 
            setDialogOpen(true); 
          }}>
            <Plus className="mr-2 h-4 w-4" /> Termin erstellen
          </Button>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card className="p-6">
              {/* Hier simuliert: Wenn du im Kalender auf einen Tag klickst */}
              <div className="grid grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => (
                  <Button key={i} variant="outline" className="h-24 flex flex-col items-start p-2" onClick={() => {
                    setEditingAppt(createFreshAppt(`2024-05-0${i+1}`));
                    setDialogOpen(true);
                  }}>
                    <span className="text-xs text-muted-foreground">{i+1}. Mai</span>
                  </Button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">Klicke auf ein Feld um einen neuen Termin mit Titel "Anfrage" zu erstellen.</p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ============= DER DIALOG ============= */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if(!open) setEditingAppt(null); setDialogOpen(open); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingAppt?.id ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
            </DialogHeader>
            
            {editingAppt && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Titel</Label>
                    <Input 
                      value={editingAppt.title || ""} 
                      onChange={(e) => setEditingAppt({ ...editingAppt, title: e.target.value })} 
                    />
                  </div>

                  <div><Label>Datum</Label><Input type="date" value={editingAppt.appointment_date || ""} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_date: e.target.value })} /></div>
                  <div className="flex gap-2">
                    <div className="flex-1"><Label>Von</Label><Input type="time" value={editingAppt.appointment_time?.slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_time: e.target.value })} /></div>
                    <div className="flex-1"><Label>Bis</Label><Input type="time" value={editingAppt.end_time?.slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, end_time: e.target.value })} /></div>
                  </div>

                  {/* LOGIK: 
                      Nur wenn editingAppt.id existiert (Bestandstermin / Formular), 
                      werden die persönlichen Felder angezeigt. 
                  */}
                  {editingAppt.id && (
                    <div className="col-span-2 space-y-3 border-t pt-4 mt-2">
                      <Badge variant="secondary">Kontaktdaten (Bestandstermin)</Badge>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label>Anrede</Label>
                          <Select value={editingAppt.salutation || ""} onValueChange={(v) => setEditingAppt({ ...editingAppt, salutation: v })}>
                            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                            <SelectContent><SelectItem value="Herr">Herr</SelectItem><SelectItem value="Frau">Frau</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <Input placeholder="Vorname" value={editingAppt.first_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, first_name: e.target.value })} />
                        <Input placeholder="Nachname" value={editingAppt.last_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, last_name: e.target.value })} />
                        <Input placeholder="Telefon" value={editingAppt.phone || ""} onChange={(e) => setEditingAppt({ ...editingAppt, phone: e.target.value })} />
                        <Input placeholder="E-Mail" value={editingAppt.email || ""} onChange={(e) => setEditingAppt({ ...editingAppt, email: e.target.value })} />
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <Label>Interne Notiz</Label>
                    <Textarea value={editingAppt.note || ""} onChange={(e) => setEditingAppt({ ...editingAppt, note: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={saveAppt}>Termin speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
