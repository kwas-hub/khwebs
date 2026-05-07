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
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, MessageSquareWarning, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { useUserRole } from "@/hooks/useUserRole";

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
  const { isAdmin } = useUserRole();
  const [forms, setForms] = useState<Form[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [submissionFilterForm, setSubmissionFilterForm] = useState<string>("all");

  const loadForms = async () => {
    const { data } = await supabase.from("forms").select("*").order("position").order("created_at");
    setForms((data ?? []) as Form[]);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  };
  const loadFields = async (formId: string) => {
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position");
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };
  const loadSubs = async () => {
    const { data } = await supabase.from("form_submissions").select("*").order("created_at", { ascending: false });
    setSubs((data ?? []) as Submission[]);
  };

  useEffect(() => { loadForms(); loadSubs(); }, []);
  useEffect(() => { if (activeId) loadFields(activeId); }, [activeId]);

  const moveField = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const arr = [...fields];
    const a = arr[index], b = arr[newIndex];
    const tmp = a.position; a.position = b.position; b.position = tmp;
    arr[index] = b; arr[newIndex] = a;
    setFields(arr);
    await Promise.all([
      supabase.from("form_fields").update({ position: a.position }).eq("id", a.id),
      supabase.from("form_fields").update({ position: b.position }).eq("id", b.id),
    ]);
  };

  const addForm = async () => {
    const { data, error } = await supabase.from("forms").insert({ title: "Neues Formular", position: forms.length }).select().single();
    if (error) return toast.error(error.message);
    await loadForms(); setActiveId(data.id);
  };
  const updateForm = async (id: string, patch: Partial<Form>) => {
    setForms((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("forms").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const deleteForm = async (id: string) => {
    if (!confirm("Formular wirklich löschen?")) return;
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setActiveId(null); loadForms();
  };

  const addField = async (type: FieldType) => {
    if (!activeId) return;
    const defaultLabel = type === "html" ? "HTML/Script" : "Neues Feld";
    const maxPos = fields.length > 0 ? Math.max(...fields.map(f => f.position)) : -1;
    
    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, 
      field_type: type, 
      label: defaultLabel,
      field_name: generateIdFromLabel(defaultLabel), 
      position: maxPos + 1,
      options: ["radio", "checkbox", "select"].includes(type) ? ["Option 1", "Option 2"] : [],
      html_content: type === "html" ? `<script>\n// Logik hier einfügen\n</script>` : ""
    });

    if (error) return toast.error(error.message);
    loadFields(activeId);
  };

  const updateField = async (id: string, patch: Partial<Field>) => {
    if (patch.label !== undefined) patch.field_name = generateIdFromLabel(patch.label);
    setFields((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("form_fields").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const deleteField = async (id: string) => {
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId) loadFields(activeId);
  };
  const updateOption = (fieldId: string, index: number, value: string) => {
    const f = fields.find(x => x.id === fieldId); if (!f) return;
    const o = [...f.options]; o[index] = value;
    updateField(fieldId, { options: o });
  };
  const addOption = (fieldId: string) => {
    const f = fields.find(x => x.id === fieldId); if (!f) return;
    updateField(fieldId, { options: [...f.options, `Option ${f.options.length + 1}`] });
  };
  const removeOption = (fieldId: string, index: number) => {
    const f = fields.find(x => x.id === fieldId); if (!f || f.options.length <= 1) return;
    updateField(fieldId, { options: f.options.filter((_, i) => i !== index) });
  };

  const updateSubmissionData = async (id: string, key: string, value: string) => {
    const sub = subs.find(s => s.id === id); if (!sub) return;
    const data = { ...sub.data, [key]: value };
    setSubs(p => p.map(s => s.id === id ? { ...s, data } : s));
    const { error } = await supabase.from("form_submissions").update({ data }).eq("id", id);
    if (error) toast.error("Speichern fehlgeschlagen");
  };

  const updateSubmissionField = async (id: string, patch: Partial<Submission>) => {
    setSubs(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
    const { error } = await supabase.from("form_submissions").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const findEmail = (sub: Submission): string | null => {
    for (const v of Object.values(sub.data)) {
      if (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    }
    return null;
  };

  const updateSubmissionStatus = async (id: string, status: Submission["status"]) => {
    const sub = subs.find(s => s.id === id);
    await updateSubmissionField(id, { status });
    if (sub && (status === "confirmed" || status === "cancelled")) {
      const email = findEmail(sub);
      if (!email) {
        toast.message("Status gespeichert", { description: "Keine E-Mail vorhanden." });
        return;
      }
      const triggerKey = `form_${sub.form_id}_${status === "confirmed" ? "confirmed" : "cancelled"}`;
      const formTitle = forms.find(f => f.id === sub.form_id)?.title || "";
      const { error } = await supabase.functions.invoke("send-template-email", {
        body: { to: email, triggerKey, vars: { ...sub.data, form_title: formTitle } },
      });
      if (error) toast.error("Status gespeichert, E-Mail-Fehler: " + error.message);
      else toast.success(status === "confirmed" ? "Bestätigt – Mail gesendet" : "Abgelehnt – Mail gesendet");
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("form_submissions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadSubs();
  };

  const activeForm = forms.find((f) => f.id === activeId);
  const filteredSubs = useMemo(() =>
    submissionFilterForm === "all" ? subs : subs.filter(s => s.form_id === submissionFilterForm),
    [subs, submissionFilterForm]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Formulare</h1>
          <Button onClick={addForm}><Plus className="h-4 w-4 mr-2" />Neues Formular</Button>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="bg-muted/50 border flex-wrap h-auto">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
            {isAdmin && <TabsTrigger value="emails">E-Mail-Vorlagen</TabsTrigger>}
          </TabsList>

          <TabsContent value="builder" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-[280px_1fr] gap-6">
              <Card className="p-3 space-y-1 h-fit bg-card border-border shadow-sm">
                {forms.map((f) => (
                  <button key={f.id} onClick={() => setActiveId(f.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all ${activeId === f.id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted"}`}>
                    <div className="font-bold truncate">{f.title || "(Unbenannt)"}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{f.published ? "Öffentlich" : "Entwurf"}</div>
                  </button>
                ))}
              </Card>

              {activeForm && (
                <div className="space-y-6">
                  <Card className="p-6 space-y-4 border-border shadow-sm">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-muted-foreground">Titel</Label><Input value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-muted-foreground">Button Text</Label><Input value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-muted-foreground">Beschreibung</Label><Textarea rows={2} value={activeForm.description} onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} /></div>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-3 text-sm font-medium"><Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />Öffentlich</div>
                      <Button variant="destructive" size="sm" onClick={() => deleteForm(activeForm.id)}><Trash2 className="h-4 w-4 mr-2" />Löschen</Button>
                    </div>
                  </Card>

                  <Card className="p-6 space-y-6 border-border shadow-sm">
                    <div className="flex items-center justify-between border-b pb-4">
                      <h3 className="font-bold">Felder</h3>
                      <div className="flex flex-wrap gap-1">
                        {FIELD_TYPES.map((t) => (
                          <Button key={t} size="sm" variant="secondary" onClick={() => addField(t)} className="h-7 text-[10px] font-bold uppercase">+ {t}</Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {fields.map((f, index) => (
                        <Card key={f.id} className="p-4 space-y-4 bg-muted/20 border-border group">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex flex-col gap-0.5 mr-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveField(index, 'up')}><ChevronUp className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === fields.length - 1} onClick={() => moveField(index, 'down')}><ChevronDown className="h-4 w-4" /></Button>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 uppercase tracking-widest">{f.field_type}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">name=<strong className="text-foreground">{f.field_name}</strong></span>
                              <label className="flex items-center gap-1 text-[10px] ml-2"><input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} /> Pflicht</label>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>

                          {f.field_type === "html" ? (
                            <Textarea className="font-mono text-xs bg-zinc-950 text-green-500 rounded-lg p-4" rows={8} value={f.html_content} onChange={(e) => updateField(f.id, { html_content: e.target.value })} />
                          ) : (
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Label</Label><Input className="h-9" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} /></div>
                              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Platzhalter</Label><Input className="h-9" value={f.placeholder} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} /></div>
                            </div>
                          )}

                          {(f.field_type === "radio" || f.field_type === "checkbox" || f.field_type === "select") && (
                            <div className="space-y-2 pt-4 border-t">
                              <Label className="text-[10px] font-bold uppercase">Optionen</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {f.options.map((opt, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <Input className="h-8 bg-background text-sm" value={opt} onChange={(e) => updateOption(f.id, idx, e.target.value)} />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOption(f.id, idx)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase" onClick={() => addOption(f.id)}>+ Option</Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4 mt-6">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <Label className="text-xs font-bold uppercase">Filter:</Label>
              <Select value={submissionFilterForm} onValueChange={setSubmissionFilterForm}>
                <SelectTrigger className="w-64 bg-card h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Formulare</SelectItem>
                  {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filteredSubs.map((s) => {
                const email = findEmail(s);
                const dateObj = new Date(s.created_at);
                const isFromForm = !!s.form_id;
                const hiddenFields = ["Anrede", "Vorname", "Nachname", "Telefon", "E-Mail"];
                
                return (
                  <Card key={s.id} className="p-4 bg-card border-border shadow-sm hover:border-primary/30 transition-colors">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
                      
                      {/* Datum / Zeit - Spalte 1 */}
                      <div className="flex flex-row lg:flex-col gap-2 lg:w-32 flex-shrink-0">
                        <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded border text-xs font-medium flex-1 justify-center lg:justify-start">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {dateObj.toLocaleDateString("de-DE")}
                        </div>
                        <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded border text-xs font-medium flex-1 justify-center lg:justify-start">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {dateObj.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Titel / Quelle - Spalte 2 */}
                      <div className="lg:w-40 flex-shrink-0">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Titel/Quelle</div>
                        <div className="p-2 bg-muted/30 rounded border text-xs font-bold truncate mb-1">
                          {isFromForm ? "Anfrage" : (forms.find(f => f.id === s.form_id)?.title || "—")}
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase h-5 bg-background">REQUEST</Badge>
                      </div>

                      {/* Daten - Spalte 3 (Flexibel) */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Eingabe-Daten</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {Object.entries(s.data)
                            .filter(([k]) => isFromForm || !hiddenFields.includes(k))
                            .map(([k, v]) => (
                            <div key={k} className="flex flex-col p-1.5 bg-muted/20 rounded border border-border/50">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground leading-none mb-1">{k}</span>
                              <Input 
                                className="h-6 text-[11px] bg-transparent border-none p-0 focus-visible:ring-0" 
                                value={Array.isArray(v) ? v.join(", ") : String(v ?? "")} 
                                onChange={(e) => updateSubmissionData(s.id, k, e.target.value)} 
                              />
                            </div>
                          ))}
                        </div>
                        {!email && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 font-bold uppercase">
                            <MessageSquareWarning className="h-3 w-3" /> Keine E-Mail gefunden
                          </div>
                        )}
                      </div>

                      {/* Notiz - Spalte 4 (Wie im Bild rot markiert) */}
                      <div className="lg:w-48 flex-shrink-0">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notiz</div>
                        <Textarea 
                          className="text-[11px] leading-tight min-h-[80px] bg-muted/10 resize-none border-border/60 p-2" 
                          placeholder="Interne Notiz..."
                          value={s.internal_note || ""} 
                          onChange={(e) => updateSubmissionField(s.id, { internal_note: e.target.value })} 
                        />
                      </div>

                      {/* Status / Aktionen - Spalte 5 */}
                      <div className="flex flex-row lg:flex-col items-center gap-2 lg:w-36 flex-shrink-0">
                        <Select value={s.status} onValueChange={(v) => updateSubmissionStatus(s.id, v as any)}>
                          <SelectTrigger className={`h-8 text-[11px] font-bold ${s.status === 'confirmed' ? 'text-green-600 border-green-200 bg-green-50/50' : s.status === 'cancelled' ? 'text-destructive border-red-200 bg-red-50/50' : 'text-orange-500 border-orange-200 bg-orange-50/50'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Offen</SelectItem>
                            <SelectItem value="confirmed">Bestätigt</SelectItem>
                            <SelectItem value="cancelled">Abgelehnt</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8 hover:bg-destructive/10" onClick={() => deleteSubmission(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>
                  </Card>
                );
              })}
              {filteredSubs.length === 0 && <p className="text-center py-12 text-sm text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">Keine Eingaben vorhanden.</p>}
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="emails" className="space-y-4 mt-6">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="font-bold">E-Mail-Vorlagen pro Formular</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Variablen entsprechen den Feld-Namen des jeweiligen Formulars (z. B. <code>{`{{vorname}}`}</code>, <code>{`{{email}}`}</code>) plus <code>{`{{form_title}}`}</code>.
              </p>
              {forms.map((f) => (
                <details key={f.id} className="group" open={activeForm?.id === f.id}>
                  <summary className="cursor-pointer p-3 bg-muted/30 rounded-lg font-bold flex items-center justify-between">
                    {f.title}
                    <Badge variant="outline">{f.published ? "Öffentlich" : "Entwurf"}</Badge>
                  </summary>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <EmailTemplateEditor
                      triggerKey={`form_${f.id}_confirmed`}
                      title={`✓ Bestätigung – ${f.title}`}
                      defaultSubject={`Ihre Anfrage wurde angenommen`}
                      defaultBody={`Hallo,\n\nvielen Dank für Ihre Anfrage zu „{{form_title}}". Wir haben sie geprüft und freuen uns, sie zu bestätigen.\n\nMit freundlichen Grüßen\nKH Webs`}
                    />
                    <EmailTemplateEditor
                      triggerKey={`form_${f.id}_cancelled`}
                      title={`✗ Ablehnung – ${f.title}`}
                      defaultSubject={`Ihre Anfrage konnte nicht angenommen werden`}
                      defaultBody={`Hallo,\n\nleider können wir Ihre Anfrage zu „{{form_title}}" nicht bearbeiten.\n\nMit freundlichen Grüßen\nKH Webs`}
                    />
                  </div>
                </details>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
