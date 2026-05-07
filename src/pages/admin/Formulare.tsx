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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, MessageSquareWarning, Calendar, Clock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Hilfskomponente für den Kalender (Placeholder oder deine FullCalendar Integration)
// Da "FullCal" in deinem Code extern war, hier die Struktur, wie sie die Props empfängt
const FullCal = ({ appointments, onEventClick, onDateClick }: any) => (
  <div className="p-8 text-center border-2 border-dashed rounded-lg">
    <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
    <p className="mt-2 text-sm text-muted-foreground">Kalender-Ansicht geladen ({appointments.length} Termine)</p>
    <Button variant="outline" size="sm" className="mt-4" onClick={() => onDateClick(new Date())}>Test: Klick auf heute</Button>
  </div>
);

type FieldType = "text" | "number" | "email" | "textarea" | "radio" | "checkbox" | "select" | "html";
type Field = {
  id: string; form_id: string; field_type: FieldType; label: string; field_name: string;
  options: string[]; html_content: string; required: boolean; position: number; placeholder: string;
};
type Form = { id: string; title: string; description: string; published: boolean; position: number; submit_label: string; success_message: string };
type Submission = { id: string; form_id: string; data: Record<string, any>; created_at: string; status: "open" | "confirmed" | "cancelled"; internal_note: string };

const generateIdFromLabel = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_") || "field_id";

const FIELD_TYPES: FieldType[] = ["text", "number", "email", "textarea", "radio", "checkbox", "select", "html"];

const Formulare = () => {
  const { isAdmin, isEditor } = useUserRole();
  const [forms, setForms] = useState<Form[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [appts, setAppts] = useState<any[]>([]); // Deine Termine aus der DB
  const [submissionFilterForm, setSubmissionFilterForm] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);

  const emptyAppt = () => ({
    title: "Anfrage", // Standardmäßig "Anfrage"
    appointment_date: new Date().toISOString().slice(0,10),
    appointment_time: "10:00",
    end_time: "11:00",
    status: "pending",
    public_visible: false,
    color: "#0ea5e9",
    source: "manuell"
  });

  const loadForms = async () => {
    const { data } = await supabase.from("forms").select("*").order("position").order("created_at");
    setForms((data ?? []) as Form[]);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  };

  const loadSubs = async () => {
    const { data } = await supabase.from("form_submissions").select("*").order("created_at", { ascending: false });
    setSubs((data ?? []) as Submission[]);
  };

  const loadAppts = async () => {
    const { data } = await supabase.from("appointments").select("*").order("appointment_date");
    setAppts(data || []);
  };

  useEffect(() => { loadForms(); loadSubs(); loadAppts(); }, []);
  useEffect(() => { if (activeId) loadFields(activeId); }, [activeId]);

  const loadFields = async (formId: string) => {
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position");
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };

  const updateForm = async (id: string, patch: Partial<Form>) => {
    setForms((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    await supabase.from("forms").update(patch).eq("id", id);
  };

  const saveAppt = async () => {
    const { error } = await supabase.from("appointments").upsert(editingAppt);
    if (error) return toast.error(error.message);
    toast.success("Termin gespeichert");
    setDialogOpen(false);
    loadAppts();
  };

  const deleteAppt = async (id: string) => {
    if (!confirm("Termin löschen?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    loadAppts();
  };

  const findEmail = (sub: Submission): string | null => {
    for (const v of Object.values(sub.data)) {
      if (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    }
    return null;
  };

  const updateSubmissionStatus = async (id: string, status: Submission["status"]) => {
    const { error } = await supabase.from("form_submissions").update({ status }).eq("id", id);
    if (!error) {
        toast.success("Status aktualisiert");
        loadSubs();
    }
  };

  const filteredSubs = useMemo(() =>
    submissionFilterForm === "all" ? subs : subs.filter(s => s.form_id === submissionFilterForm),
    [subs, submissionFilterForm]);

  const activeForm = forms.find((f) => f.id === activeId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Verwaltung</h1>
          <Button onClick={() => { setEditingAppt(emptyAppt()); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Neuer Termin
          </Button>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="bg-muted/50 border flex-wrap h-auto">
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
            <TabsTrigger value="builder">Formular-Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
            {isAdmin && <TabsTrigger value="emails">E-Mail-Vorlagen</TabsTrigger>}
          </TabsList>

          {/* ============= KALENDER CONTENT ============= */}
          <TabsContent value="calendar" className="space-y-4 mt-4">
             <Card className="p-4 bg-card border-border">
                <FullCal 
                    appointments={appts}
                    onEventClick={(id: string) => {
                        const a = appts.find(x => x.id === id);
                        if (a) {
                            setEditingAppt(a);
                            setDialogOpen(true);
                        }
                    }}
                    onDateClick={(d: Date) => {
                        setEditingAppt({ ...emptyAppt(), appointment_date: d.toISOString().slice(0,10) });
                        setDialogOpen(true);
                    }}
                />
             </Card>
          </TabsContent>

          {/* ============= BUILDER CONTENT (Gekürzt für Übersicht) ============= */}
          <TabsContent value="builder" className="mt-6">
            <div className="grid md:grid-cols-[250px_1fr] gap-6">
                <Card className="p-3 space-y-1 h-fit">
                    {forms.map((f) => (
                        <button key={f.id} onClick={() => setActiveId(f.id)} className={`w-full text-left px-3 py-2 rounded ${activeId === f.id ? "bg-primary text-white" : "hover:bg-muted"}`}>
                            {f.title}
                        </button>
                    ))}
                </Card>
                {activeForm && (
                    <Card className="p-6 space-y-4">
                         <Label>Formular Name</Label>
                         <Input value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} />
                         <p className="text-xs text-muted-foreground text-center py-4 border-dashed border-2">Hier Felder bearbeiten...</p>
                    </Card>
                )}
            </div>
          </TabsContent>

          {/* ============= SUBMISSIONS CONTENT ============= */}
          <TabsContent value="submissions" className="space-y-4 mt-6">
            <div className="space-y-3">
              {filteredSubs.map((s) => (
                <Card key={s.id} className="p-4 flex flex-col lg:flex-row gap-4 items-center">
                    <div className="flex-1">
                        <div className="font-bold">{forms.find(f => f.id === s.form_id)?.title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        {Object.entries(s.data).slice(0, 4).map(([k, v]) => (
                            <div key={k} className="text-[10px] border px-2 py-1 rounded bg-muted/30">
                                <strong>{k}:</strong> {String(v)}
                            </div>
                        ))}
                    </div>
                    <Select value={s.status} onValueChange={(v) => updateSubmissionStatus(s.id, v as any)}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="open">Offen</SelectItem>
                            <SelectItem value="confirmed">Bestätigt</SelectItem>
                            <SelectItem value="cancelled">Abgelehnt</SelectItem>
                        </SelectContent>
                    </Select>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ============= EMAIL TEMPLATES ============= */}
          {isAdmin && (
            <TabsContent value="emails" className="mt-6">
                <p className="text-sm text-muted-foreground">E-Mail Editoren hier verfügbar...</p>
            </TabsContent>
          )}
        </Tabs>

        {/* ============= DER ZENTRALE DIALOG ============= */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingAppt?.id ? "Termin Details" : "Neuer Termin"}</DialogTitle>
            </DialogHeader>
            {editingAppt && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Titel</Label>
                    <Input 
                      value={editingAppt.title || ""} 
                      onChange={(e) => setEditingAppt({ ...editingAppt, title: e.target.value })} 
                    />
                  </div>
                  <div><Label>Datum</Label><Input type="date" value={editingAppt.appointment_date || ""} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Von</Label><Input type="time" value={editingAppt.appointment_time?.slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, appointment_time: e.target.value })} /></div>
                    <div><Label>Bis</Label><Input type="time" value={editingAppt.end_time?.slice(0,5)} onChange={(e) => setEditingAppt({ ...editingAppt, end_time: e.target.value })} /></div>
                  </div>

                  {/* LOGIK: Nur anzeigen wenn der Termin eine ID hat (Bestandsaufnahme/Formular) */}
                  {editingAppt.id && (
                    <div className="col-span-2 grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
                      <p className="col-span-2 text-[10px] font-bold uppercase text-muted-foreground">Kundendaten</p>
                      <div className="col-span-2">
                        <Label>Anrede</Label>
                        <Select value={editingAppt.salutation || ""} onValueChange={(v) => setEditingAppt({ ...editingAppt, salutation: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Herr">Herr</SelectItem><SelectItem value="Frau">Frau</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label>Vorname</Label><Input className="h-8" value={editingAppt.first_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, first_name: e.target.value })} /></div>
                      <div><Label>Nachname</Label><Input className="h-8" value={editingAppt.last_name || ""} onChange={(e) => setEditingAppt({ ...editingAppt, last_name: e.target.value })} /></div>
                      <div><Label>Telefon</Label><Input className="h-8" value={editingAppt.phone || ""} onChange={(e) => setEditingAppt({ ...editingAppt, phone: e.target.value })} /></div>
                      <div><Label>E-Mail</Label><Input className="h-8" value={editingAppt.email || ""} onChange={(e) => setEditingAppt({ ...editingAppt, email: e.target.value })} /></div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <Label>Notiz</Label>
                    <Textarea value={editingAppt.note || ""} onChange={(e) => setEditingAppt({ ...editingAppt, note: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              {editingAppt?.id && (
                <Button variant="destructive" size="sm" className="mr-auto" onClick={() => { deleteAppt(editingAppt.id); setDialogOpen(false); }}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={saveAppt}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
