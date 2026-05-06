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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    const { error } = await supabase.from("form_fields").insert({
      form_id: activeId, field_type: type, label: type === "html" ? "HTML/Script" : "Neues Feld",
      field_name: slug(`feld_${fields.length + 1}`), position: fields.length, options: type === "radio" || type === "checkbox" ? ["Option 1"] : [],
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
  const moveField = async (id: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === id);
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const a = fields[idx], b = fields[target];
    await Promise.all([
      supabase.from("form_fields").update({ position: b.position }).eq("id", a.id),
      supabase.from("form_fields").update({ position: a.position }).eq("id", b.id),
    ]);
    if (activeId) loadFields(activeId);
  };

  const activeForm = forms.find((f) => f.id === activeId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Formulare</h1>
          <Button onClick={addForm}><Plus className="h-4 w-4 mr-2" />Neues Formular</Button>
        </div>

        <Tabs defaultValue="builder">
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4">
            <div className="grid md:grid-cols-[260px_1fr] gap-4">
              <Card className="p-3 space-y-1 h-fit">
                {forms.length === 0 && <p className="text-sm text-muted-foreground p-2">Noch keine Formulare.</p>}
                {forms.map((f) => (
                  <button key={f.id} onClick={() => setActiveId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <div className="font-medium truncate">{f.title || "(ohne Titel)"}</div>
                    <div className="text-xs opacity-70">{f.published ? "Veröffentlicht" : "Privat"}</div>
                  </button>
                ))}
              </Card>

              {activeForm && (
                <div className="space-y-4">
                  <Card className="p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>Titel</Label><Input value={activeForm.title} onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} /></div>
                      <div><Label>Submit-Button-Text</Label><Input value={activeForm.submit_label} onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} /></div>
                    </div>
                    <div><Label>Beschreibung</Label><Textarea rows={2} value={activeForm.description} onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} /></div>
                    <div><Label>Erfolgs-Nachricht</Label><Input value={activeForm.success_message} onChange={(e) => updateForm(activeForm.id, { success_message: e.target.value })} /></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={activeForm.published} onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} />
                        <Label>Im Frontend veröffentlichen</Label>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteForm(activeForm.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />Formular löschen
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold">Felder</h3>
                      <div className="flex flex-wrap gap-1">
                        {(["text","number","email","textarea","radio","checkbox","html"] as FieldType[]).map((t) => (
                          <Button key={t} size="sm" variant="outline" onClick={() => addField(t)}>
                            <Plus className="h-3 w-3 mr-1" />{t}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fields.map((f, i) => (
                        <Card key={f.id} className="p-3 space-y-2 bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary">{f.field_type}</span>
                            <div className="flex-1" />
                            <Button size="icon" variant="ghost" onClick={() => moveField(f.id, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => moveField(f.id, 1)} disabled={i === fields.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          {f.field_type !== "html" && (
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div><Label className="text-xs">Label</Label><Input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} /></div>
                              <div><Label className="text-xs">Feldname</Label><Input value={f.field_name} onChange={(e) => updateField(f.id, { field_name: slug(e.target.value) })} /></div>
                              <div><Label className="text-xs">Placeholder</Label><Input value={f.placeholder} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} /></div>
                              <div className="flex items-center gap-2 mt-5"><Switch checked={f.required} onCheckedChange={(v) => updateField(f.id, { required: v })} /><Label>Pflichtfeld</Label></div>
                            </div>
                          )}
                          {(f.field_type === "radio" || f.field_type === "checkbox") && (
                            <div>
                              <Label className="text-xs">Optionen (eine pro Zeile)</Label>
                              <Textarea rows={3} value={f.options.join("\n")} onChange={(e) => updateField(f.id, { options: e.target.value.split("\n").filter(Boolean) })} />
                            </div>
                          )}
                          {f.field_type === "html" && (
                            <div>
                              <Label className="text-xs">HTML/Script</Label>
                              <Textarea rows={5} className="font-mono text-xs" value={f.html_content} onChange={(e) => updateField(f.id, { html_content: e.target.value })} placeholder="<div>...</div>" />
                            </div>
                          )}
                        </Card>
                      ))}
                      {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Noch keine Felder. Oben einen Feldtyp hinzufügen.</p>}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions">
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Formular</TableHead>
                    <TableHead>Daten</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => {
                    const f = forms.find((x) => x.id === s.form_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{new Date(s.created_at).toLocaleString("de-DE")}</TableCell>
                        <TableCell>{f?.title ?? "—"}</TableCell>
                        <TableCell><pre className="text-xs whitespace-pre-wrap max-w-2xl">{JSON.stringify(s.data, null, 2)}</pre></TableCell>
                      </TableRow>
                    );
                  })}
                  {subs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Keine Eingaben.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Formulare;
