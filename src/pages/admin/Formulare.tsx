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

  const addForm = async () => {
    const { data, error } = await supabase.from("forms").insert({ 
        title: "Neues Formular", 
        position: forms.length,
        submit_label: "Senden",
        success_message: "Gespeichert!"
    }).select().single();
    if (error) return toast.error(error.message);
    loadData(); setActiveId(data.id);
  };

  const updateForm = async (id: string, patch: Partial<Form>) => {
    setForms((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("forms").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const addField = async (type: FieldType) => {
    if (!activeId) return;
    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, field_type: type, label: type === "html" ? "HTML/Script" : "Neues Feld",
      field_name: slug(`feld_${fields.length + 1}`), position: fields.length, options: type === "radio" || type === "checkbox" ? ["Option 1"] : [],
    });
    if (error) return toast.error(error.message);
    loadFields(activeId);
    loadData();
  };

  const updateSubmissionData = async (submissionId: string, key: string, newValue: string) => {
    const sub = subs.find(s => s.id === submissionId);
    if (!sub) return;
    const updatedData = { ...sub.data, [key]: newValue };
    setSubs(prev => prev.map(s => s.id === submissionId ? { ...s, data: updatedData } : s));
    const { error } = await supabase.from("form_submissions").update({ data: updatedData }).eq("id", submissionId);
    if (error) toast.error(error.message);
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

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
          </TabsList>

          {/* BUILDER TAB (Desktop & Mobile optimiert) */}
          <TabsContent value="builder" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-[260px_1fr] gap-4">
              <Card className="p-3 space-y-1 h-fit bg-card border-border">
                {forms.map((f) => (
                  <button key={f.id} onClick={() => setActiveId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <div className="font-medium truncate">{f.title || "(ohne Titel)"}</div>
                  </button>
                ))}
              </Card>

              {activeForm && (
                <div className="space-y-4">
                  <Card className="p-4 space-y-3 bg-card border-border shadow-sm">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>Titel</Label><Input className="bg-background mt-1" value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} /></div>
                      <div><Label>Button-Text</Label><Input className="bg-background mt-1" value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} /></div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />
                      <Label>Veröffentlicht</Label>
                    </div>
                  </Card>

                  <Card className="p-4 bg-card border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="font-semibold">Felder bearbeiten</h3>
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {["text", "email", "textarea"].map((t) => (
                          <Button key={t} size="sm" variant="secondary" onClick={() => addField(t as FieldType)} className="h-7 text-[10px] uppercase">+{t}</Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                        {fields.map((f) => (
                             <Card key={f.id} className="p-3 bg-muted/30 border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                    <Input className="h-9 text-sm bg-background" value={f.label} onChange={(e) => supabase.from("form_fields").update({label: e.target.value}).eq("id", f.id).then(() => loadFields(activeId!))} placeholder="Label" />
                                    <Input className="h-9 text-sm bg-background" value={f.field_name} readOnly placeholder="Slug" />
                                </div>
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive self-end" onClick={() => supabase.from("form_fields").delete().eq("id", f.id).then(() => loadFields(activeId!))}><Trash2 className="h-4 w-4" /></Button>
                             </Card>
                        ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* EINGABEN TAB (VOLL RESPONSIVE) */}
          <TabsContent value="submissions" className="mt-4">
            <Card className="border-border bg-card overflow-hidden">
              {/* DESKTOP TABELLE */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[140px]">Datum</TableHead>
                      <TableHead>Eingabedaten (bearbeitbar)</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s) => (
                      <TableRow key={s.id} className="align-top border-border hover:bg-muted/10">
                        <TableCell className="text-[11px] text-muted-foreground pt-4">
                          {new Date(s.created_at).toLocaleString("de-DE")}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-xs font-bold text-primary mb-3 uppercase tracking-wider">
                            {forms.find(f => f.id === s.form_id)?.title || "Formular"}
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                            {Object.entries(s.data).map(([key, value]) => (
                              <div key={key} className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground/80">
                                  {getFieldLabel(s.form_id, key)}
                                </Label>
                                <Input 
                                  className="h-9 text-sm bg-background/50 border-border"
                                  value={String(value)} 
                                  onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="pt-4">
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE STACK (KARTEN) */}
              <div className="md:hidden divide-y divide-border">
                {subs.map((s) => (
                  <div key={s.id} className="p-4 space-y-4 bg-card">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          {forms.find(f => f.id === s.form_id)?.title}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteSubmission(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid gap-4">
                      {Object.entries(s.data).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                            {getFieldLabel(s.form_id, key)}
                          </Label>
                          <Input 
                            className="h-10 bg-background border-border shadow-sm"
                            value={String(value)} 
                            onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {subs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Keine Eingaben gefunden.</div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
