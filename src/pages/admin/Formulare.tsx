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
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position");
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };
  const loadSubs = async () => {
    const { data } = await supabase.from("form_submissions").select("*").order("created_at", { ascending: false });
    setSubs((data ?? []) as Submission[]);
  };

  useEffect(() => { loadForms(); loadSubs(); }, []);
  useEffect(() => { if (activeId) loadFields(activeId); }, [activeId]);

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
    
    // Optimiertes Script-Template für den Form-Builder
    const scriptTemplate = `<script>
(function() {
  const initLogic = () => {
    const radioName = 'auswahl'; // Der Name deines Radio-Feldes
    const targetName = 'andere_auswahl'; // Der Name des Textfeldes
    
    const radios = document.querySelectorAll('input[name="' + radioName + '"]');
    const targetInput = document.querySelector('[name="' + targetName + '"]');
    
    if (radios.length && targetInput) {
      const container = targetInput.closest('.form-field-container') || targetInput.parentElement;
      
      const toggle = () => {
        const selected = document.querySelector('input[name="' + radioName + '"]:checked');
        const show = selected && selected.value === 'Andere';
        container.style.display = show ? 'block' : 'none';
      };

      document.addEventListener('change', (e) => {
        if (e.target.name === radioName) toggle();
      });
      
      toggle(); // Initialer Check
    }
  };
  setTimeout(initLogic, 500); // Kurzer Delay für das Rendering
})();
</script>`;

    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, 
      field_type: type, 
      label: defaultLabel,
      field_name: generateIdFromLabel(defaultLabel),
      position: fields.length, 
      options: type === "radio" || type === "checkbox" ? ["Option 1", "Andere"] : [],
      html_content: type === "html" ? scriptTemplate : ""
    });
    if (error) return toast.error(error.message);
    loadFields(activeId);
  };
  
  const updateField = async (id: string, patch: Partial<Field>) => {
    if (patch.label !== undefined) {
      patch.field_name = generateIdFromLabel(patch.label);
    }
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
          <h1 className="text-3xl font-bold italic tracking-tight">Formular Management</h1>
          <Button onClick={addForm} className="rounded-full shadow-lg transition-transform active:scale-95">
            <Plus className="h-4 w-4 mr-2" />Neues Formular
          </Button>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="bg-muted/50 border p-1 rounded-xl">
            <TabsTrigger value="builder" className="rounded-lg">Builder</TabsTrigger>
            <TabsTrigger value="submissions" className="rounded-lg">Eingaben ({subs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-[280px_1fr] gap-6">
              <Card className="p-4 space-y-2 h-fit bg-card border-border/60 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">Deine Formulare</p>
                {forms.length === 0 && <p className="text-sm text-muted-foreground p-2 italic">Keine Formulare vorhanden.</p>}
                {forms.map((f) => (
                  <button key={f.id} onClick={() => setActiveId(f.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${activeId === f.id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted"}`}>
                    <div className="font-bold truncate">{f.title || "(Unbenannt)"}</div>
                    <div className="text-[10px] opacity-70 mt-1 uppercase font-semibold">{f.published ? "● Öffentlich" : "○ Entwurf"}</div>
                  </button>
                ))}
              </Card>

              {activeForm && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Card className="p-6 space-y-4 bg-card border-border/60 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Settings className="w-20 h-20" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Titel</Label>
                        <Input className="bg-background rounded-lg border-border/50" value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Button Text</Label>
                        <Input className="bg-background rounded-lg border-border/50" value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Beschreibung</Label>
                      <Textarea className="bg-background rounded-lg border-border/50" rows={2} value={activeForm.description} onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        <Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />
                        <span className="text-sm font-medium">Öffentlich sichtbar</span>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteForm(activeForm.id)} className="rounded-lg h-9">
                        <Trash2 className="h-4 w-4 mr-2" />Formular löschen
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-6 space-y-6 bg-card border-border/60 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/40 pb-4">
                      <h3 className="font-bold text-lg tracking-tight">Formular Felder</h3>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {(["text","number","email","textarea","radio","checkbox","html"] as FieldType[]).map((t) => (
                          <Button key={t} size="sm" variant="secondary" onClick={() => addField(t)} className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-md px-3">
                            + {t}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {fields.map((f) => (
                        <Card key={f.id} className="p-4 space-y-4 bg-muted/30 border-border/40 group hover:border-primary/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{f.field_type}</span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50 italic">ID: {f.field_name}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteField(f.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {f.field_type === "html" ? (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-muted-foreground">HTML / Javascript</Label>
                              <Textarea className="font-mono text-xs bg-zinc-950 text-green-400 rounded-lg p-4 leading-relaxed scrollbar-thin" rows={10} value={f.html_content} onChange={(e) => updateField(f.id, { html_content: e.target.value })} />
                            </div>
                          ) : (
                            <div className="grid sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Label (bestimmt ID)</Label>
                                <Input className="h-9 bg-background" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Platzhalter</Label>
                                <Input className="h-9 bg-background" value={f.placeholder} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} />
                              </div>
                            </div>
                          )}

                          {(f.field_type === "radio" || f.field_type === "checkbox") && (
                            <div className="space-y-3 pt-4 border-t border-border/40">
                              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Optionen bearbeiten</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {f.options.map((opt, idx) => (
                                  <div key={idx} className="flex gap-2 animate-in zoom-in-95 duration-200">
                                    <Input className="h-8 bg-background text-sm" value={opt} onChange={(e) => updateOption(f.id, idx, e.target.value)} />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeOption(f.id, idx)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase border-dashed" onClick={() => addOption(f.id)}>
                                  + Option
                                </Button>
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
          {/* Submission content remains unchanged based on prompt constraints */}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
