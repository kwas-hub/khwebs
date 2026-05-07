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
import { Plus, Trash2, ChevronUp, ChevronDown, Settings } from "lucide-react";
import { toast } from "sonner";

type FieldType = "text" | "number" | "email" | "textarea" | "radio" | "checkbox" | "html";
type Field = {
  id: string; form_id: string; field_type: FieldType; label: string; field_name: string;
  options: string[]; html_content: string; required: boolean; position: number; placeholder: string;
};
type Form = { id: string; title: string; description: string; published: boolean; position: number; submit_label: string; success_message: string };
type Submission = { id: string; form_id: string; data: Record<string, any>; created_at: string };

const generateIdFromLabel = (label: string) => {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    || "field_id";
};

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
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position", { ascending: true });
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

    const newFields = [...fields];
    const currentField = newFields[index];
    const swapField = newFields[newIndex];

    const tempPos = currentField.position;
    currentField.position = swapField.position;
    swapField.position = tempPos;

    newFields[index] = swapField;
    newFields[newIndex] = currentField;
    setFields(newFields);

    try {
      const update1 = supabase.from("form_fields").update({ position: currentField.position }).eq("id", currentField.id);
      const update2 = supabase.from("form_fields").update({ position: swapField.position }).eq("id", swapField.id);
      const [res1, res2] = await Promise.all([update1, update2]);
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
    } catch (error: any) {
      toast.error("Fehler beim Verschieben: " + error.message);
      if (activeId) loadFields(activeId);
    }
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
      form_id: activeId, field_type: type, label: defaultLabel,
      field_name: generateIdFromLabel(defaultLabel), position: maxPos + 1, 
      options: type === "radio" || type === "checkbox" ? ["Option 1", "Andere"] : [],
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

  const updateSubmissionData = async (submissionId: string, key: string, newValue: string) => {
    const sub = subs.find(s => s.id === submissionId);
    if (!sub) return;
    const updatedData = { ...sub.data, [key]: newValue };
    setSubs(prev => prev.map(s => s.id === submissionId ? { ...s, data: updatedData } : s));
    const { error } = await supabase.from("form_submissions").update({ data: updatedData }).eq("id", submissionId);
    if (error) toast.error("Speichern fehlgeschlagen");
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
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Formulare</h1>
          <Button onClick={addForm}><Plus className="h-4 w-4 mr-2" />Neues Formular</Button>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
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
                        {(["text","number","email","textarea","radio","checkbox","html"] as FieldType[]).map((t) => (
                          <Button key={t} size="sm" variant="secondary" onClick={() => addField(t)} className="h-7 text-[10px] font-bold uppercase">+ {t}</Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {fields.map((f, index) => (
                        <Card key={f.id} className="p-4 space-y-4 bg-muted/20 border-border group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-0.5 mr-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveField(index, 'up')}><ChevronUp className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === fields.length - 1} onClick={() => moveField(index, 'down')}><ChevronDown className="h-4 w-4" /></Button>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 uppercase tracking-widest">{f.field_type}</span>
                              <span className="text-[10px] font-mono opacity-50">ID: {f.field_name}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive group-hover:opacity-100 opacity-0 transition-opacity" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>

                          {f.field_type === "html" ? (
                            <Textarea className="font-mono text-xs bg-zinc-950 text-green-500 rounded-lg p-4" rows={8} value={f.html_content} onChange={(e) => updateField(f.id, { html_content: e.target.value })} />
                          ) : (
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Label (ID)</Label><Input className="h-9" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} /></div>
                              <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Platzhalter</Label><Input className="h-9" value={f.placeholder} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} /></div>
                            </div>
                          )}

                          {(f.field_type === "radio" || f.field_type === "checkbox") && (
                            <div className="space-y-2 pt-4 border-t">
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

          <TabsContent value="submissions" className="mt-6">
            <Card className="overflow-hidden bg-card border-border">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/50 text-[11px] uppercase font-bold tracking-wider">
                    <TableRow><TableHead>Datum</TableHead><TableHead>Formular</TableHead><TableHead>Daten</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(s.created_at).toLocaleString("de-DE")}</TableCell>
                        <TableCell className="font-bold text-sm">{forms.find(f => f.id === s.form_id)?.title || "—"}</TableCell>
                        <TableCell>
                          <div className="grid lg:grid-cols-2 gap-2">
                            {Object.entries(s.data).map(([k, v]) => (
                              <div key={k} className="flex flex-col gap-1 p-2 bg-muted/30 rounded-lg">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground">{k}</span>
                                <Input className="h-7 text-xs bg-background" value={String(v)} onChange={(e) => updateSubmissionData(s.id, k, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden divide-y">
                {subs.map((s) => (
                  <div key={s.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase text-muted-foreground">{new Date(s.created_at).toLocaleString("de-DE")}</span><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}><Trash2 className="h-4 w-4" /></Button></div>
                    {Object.entries(s.data).map(([k, v]) => (
                      <div key={k} className="space-y-1"><Label className="text-[10px] font-bold uppercase">{k}</Label><Input className="h-8 text-sm" value={String(v)} onChange={(e) => updateSubmissionData(s.id, k, e.target.value)} /></div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
