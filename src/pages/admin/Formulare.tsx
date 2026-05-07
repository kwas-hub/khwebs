import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type FieldType = "text" | "number" | "email" | "textarea" | "radio" | "checkbox" | "html";
type Field = {
  id: string; form_id: string; field_type: FieldType; label: string; field_name: string;
  options: string[]; html_content: string; required: boolean; position: number; placeholder: string;
};
type Form = { id: string; title: string; description: string; published: boolean; position: number; submit_label: string; success_message: string };
type Submission = { id: string; form_id: string; data: Record<string, any>; created_at: string };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "field";

const Formulare = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);

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

  // --- Formular Logik ---
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

  // --- Felder Logik ---
  const addField = async (type: FieldType) => {
    if (!activeId) return;
    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, field_type: type, label: type === "html" ? "HTML/Script" : "Neues Feld",
      field_name: slug(`feld_${fields.length + 1}`), position: fields.length, 
      options: type === "radio" || type === "checkbox" ? ["Option 1"] : [],
      html_content: type === "html" ? "<p>Ihr HTML hier...</p>" : ""
    });
    if (error) return toast.error(error.message);
    loadFields(activeId);
  };
  const updateField = async (id: string, patch: Partial<Field>) => {
    setFields((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("form_fields").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const deleteField = async (id: string) => {
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId) loadFields(activeId);
  };

  // Hilfsfunktion für Optionen (Radio/Checkbox)
  const updateOption = (fieldId: string, index: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const newOptions = [...field.options];
    newOptions[index] = value;
    updateField(fieldId, { options: newOptions });
  };

  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] });
  };

  const removeOption = (fieldId: string, index: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || field.options.length <= 1) return;
    const newOptions = field.options.filter((_, i) => i !== index);
    updateField(fieldId, { options: newOptions });
  };

  // --- Submissions (Eingaben) Editier-Logik ---
  const updateSubmissionData = async (submissionId: string, key: string, newValue: string) => {
    const sub = subs.find(s => s.id === submissionId);
    if (!sub) return;

    const updatedData = { ...sub.data, [key]: newValue };
    
    // Optimistisches UI Update
    setSubs(prev => prev.map(s => s.id === submissionId ? { ...s, data: updatedData } : s));

    const { error } = await supabase
      .from("form_submissions")
      .update({ data: updatedData })
      .eq("id", submissionId);

    if (error) toast.error("Speichern fehlgeschlagen: " + error.message);
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("form_submissions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadSubs();
  };

  const activeForm = forms.find((f) => f.id === activeId);

  return (
    <AdminLayout>
      <div className="space-y-6 text-foreground">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Formulare</h1>
          <Button onClick={addForm}><Plus className="h-4 w-4 mr-2" />Neues Formular</Button>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-[260px_1fr] gap-4">
              <Card className="p-3 space-y-1 h-fit bg-card border-border">
                {forms.length === 0 && <p className="text-sm text-muted-foreground p-2">Noch keine Formulare.</p>}
                {forms.map((f) => (
                  <button key={f.id} onClick={() => setActiveId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <div className="font-medium truncate">{f.title || "(ohne Titel)"}</div>
                    <div className="text-xs opacity-70">{f.published ? "Veröffentlicht" : "Privat"}</div>
                  </button>
                ))}
              </Card>

              {activeForm && (
                <div className="space-y-4">
                  <Card className="p-4 space-y-3 bg-card border-border">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>Titel</Label><Input className="bg-background" value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} /></div>
                      <div><Label>Submit-Button-Text</Label><Input className="bg-background" value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} /></div>
                    </div>
                    <div><Label>Beschreibung</Label><Textarea className="bg-background" rows={2} value={activeForm.description} onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} /></div>
                    <div><Label>Erfolgs-Nachricht</Label><Input className="bg-background" value={activeForm.success_message} onChange={(e) => updateForm(activeForm.id, { success_message: e.target.value })} /></div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />
                        <Label>Im Frontend veröffentlichen</Label>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteForm(activeForm.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />Löschen
                      </Button>
                    </div>
                  </Card>

                  {/* Felder Bereich */}
                  <Card className="p-4 space-y-3 bg-card border-border">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold">Felder</h3>
                      <div className="flex flex-wrap gap-1">
                        {(["text","number","email","textarea","radio","checkbox","html"] as FieldType[]).map((t) => (
                          <Button key={t} size="sm" variant="outline" onClick={() => addField(t)} className="h-8 text-xs">
                            <Plus className="h-3 w-3 mr-1" />{t}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fields.map((f, i) => (
                        <Card key={f.id} className="p-3 space-y-2 bg-muted/20 border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground uppercase">{f.field_type}</span>
                            <div className="flex-1" />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>

                          {f.field_type === "html" ? (
                            <div className="space-y-1">
                              <Label className="text-xs">HTML / Script Inhalt</Label>
                              <Textarea 
                                className="font-mono text-xs bg-background" 
                                rows={6} 
                                value={f.html_content} 
                                onChange={(e) => updateField(f.id, { html_content: e.target.value })}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="grid sm:grid-cols-2 gap-2">
                                <div><Label className="text-xs">Label</Label><Input className="h-8 bg-background" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} /></div>
                                <div><Label className="text-xs">Platzhalter</Label><Input className="h-8 bg-background" value={f.placeholder} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} /></div>
                              </div>

                              {(f.field_type === "radio" || f.field_type === "checkbox") && (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                  <Label className="text-xs font-semibold">Optionen</Label>
                                  <div className="grid gap-2">
                                    {f.options.map((opt, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <Input 
                                          className="h-8 bg-background" 
                                          value={opt} 
                                          onChange={(e) => updateOption(f.id, idx, e.target.value)} 
                                        />
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-8 w-8 text-destructive" 
                                          onClick={() => removeOption(f.id, idx)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 text-[10px] w-fit" 
                                      onClick={() => addOption(f.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" /> Option hinzufügen
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </Card>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
            <Card className="overflow-hidden bg-card border-border">
              {/* Desktop-Ansicht: Tabelle */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[180px]">Datum</TableHead>
                      <TableHead className="w-[150px]">Formular</TableHead>
                      <TableHead>Inhalt bearbeiten</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s) => {
                      const f = forms.find((x) => x.id === s.form_id);
                      return (
                        <TableRow key={s.id} className="align-top border-border">
                          <TableCell className="text-xs text-muted-foreground pt-4">
                            {new Date(s.created_at).toLocaleString("de-DE")}
                          </TableCell>
                          <TableCell className="font-medium pt-4">{f?.title ?? "—"}</TableCell>
                          <TableCell className="py-2">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {Object.entries(s.data).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">{key}</Label>
                                  <Input 
                                    className="h-8 text-sm bg-background"
                                    value={String(value)} 
                                    onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="pt-2 text-right">
                            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {subs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          Keine Eingaben vorhanden.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile-Ansicht: Cards */}
              <div className="md:hidden divide-y divide-border">
                {subs.map((s) => {
                  const f = forms.find((x) => x.id === s.form_id);
                  return (
                    <div key={s.id} className="p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm">{f?.title ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(s.created_at).toLocaleString("de-DE")}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8 -mr-2" onClick={() => deleteSubmission(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(s.data).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">{key}</Label>
                            <Input 
                              className="h-9 text-sm bg-background"
                              value={String(value)} 
                              onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {subs.length === 0 && (
                  <div className="p-10 text-center text-muted-foreground">Keine Eingaben vorhanden.</div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
