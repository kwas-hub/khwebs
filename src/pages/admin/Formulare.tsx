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
  const [allFields, setAllFields] = useState<Field[]>([]); 

  const loadData = async () => {
    // Alles parallel laden um Performance zu optimieren
    const [fRes, sRes, afRes] = await Promise.all([
      supabase.from("forms").select("*").order("position").order("created_at"),
      supabase.from("form_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("form_fields").select("*")
    ]);

    if (fRes.data) {
      setForms(fRes.data as Form[]);
      if (!activeId && fRes.data.length > 0) setActiveId(fRes.data[0].id);
    }
    if (sRes.data) setSubs(sRes.data as Submission[]);
    if (afRes.data) setAllFields(afRes.data as Field[]);
  };

  const loadFields = async (formId: string) => {
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position");
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeId) loadFields(activeId); }, [activeId]);

  // --- Formular Logik (Repariert) ---
  const addForm = async () => {
    const newForm = { 
        title: "Neues Formular", 
        position: forms.length,
        submit_label: "Senden",
        success_message: "Vielen Dank!",
        published: false 
    };
    const { data, error } = await supabase.from("forms").insert(newForm).select().single();
    
    if (error) return toast.error("Fehler beim Erstellen: " + error.message);
    toast.success("Formular erstellt");
    await loadData(); 
    setActiveId(data.id);
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
    setActiveId(null); 
    loadData();
  };

  // --- Felder Logik ---
  const addField = async (type: FieldType) => {
    if (!activeId) return;
    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, field_type: type, label: type === "html" ? "HTML/Script" : "Neues Feld",
      field_name: slug(`feld_${fields.length + 1}`), position: fields.length, options: type === "radio" || type === "checkbox" ? ["Option 1"] : [],
    });
    if (error) return toast.error(error.message);
    loadFields(activeId);
    loadData(); // allFields Cache aktualisieren
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

  // --- Submissions Logik ---
  const updateSubmissionData = async (submissionId: string, key: string, newValue: string) => {
    const sub = subs.find(s => s.id === submissionId);
    if (!sub) return;
    const updatedData = { ...sub.data, [key]: newValue };
    setSubs(prev => prev.map(s => s.id === submissionId ? { ...s, data: updatedData } : s));
    const { error } = await supabase.from("form_submissions").update({ data: updatedData }).eq("id", submissionId);
    if (error) toast.error("Fehler: " + error.message);
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Eintrag löschen?")) return;
    const { error } = await supabase.from("form_submissions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadData();
  };

  const getFieldLabel = (formId: string, key: string) => {
    const field = allFields.find(f => f.form_id === formId && f.field_name === key);
    return field ? field.label : key;
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
                {forms.length === 0 && <p className="text-sm text-muted-foreground p-2">Keine Formulare.</p>}
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
                      <div><Label>Button-Text</Label><Input className="bg-background" value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} /></div>
                    </div>
                    <div><Label>Beschreibung</Label><Textarea className="bg-background" rows={2} value={activeForm.description} onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} /></div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />
                        <Label>Veröffentlicht</Label>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteForm(activeForm.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 bg-card border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Felder</h3>
                        <div className="flex flex-wrap gap-1">
                            {["text", "number", "email", "textarea"].map((t) => (
                                <Button key={t} size="sm" variant="outline" onClick={() => addField(t as FieldType)} className="h-7 text-[10px] uppercase">{t}</Button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {fields.map((f) => (
                             <Card key={f.id} className="p-2 bg-muted/20 border-border flex items-center gap-3">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <Input className="h-8 text-xs bg-background" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} placeholder="Label" />
                                    <Input className="h-8 text-xs bg-background" value={f.field_name} onChange={(e) => updateField(f.id, { field_name: slug(e.target.value) })} placeholder="Slug" />
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                             </Card>
                        ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
             <Card className="border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[150px]">Datum</TableHead>
                      <TableHead>Formular & Inhalt</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s) => (
                      <TableRow key={s.id} className="align-top border-border">
                        <TableCell className="text-[10px] text-muted-foreground pt-4">
                          {new Date(s.created_at).toLocaleString("de-DE")}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-bold text-xs mb-2 text-primary">
                            {forms.find(f => f.id === s.form_id)?.title || "Unbekanntes Formular"}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.entries(s.data).map(([key, value]) => (
                              <div key={key} className="flex flex-col gap-1">
                                <Label className="text-[9px] uppercase text-muted-foreground font-black">
                                  {getFieldLabel(s.form_id, key)}
                                </Label>
                                <Input 
                                  className="h-8 text-sm bg-background border-border"
                                  value={String(value)} 
                                  onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="pt-3">
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
