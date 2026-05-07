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
  const [allFields, setAllFields] = useState<Field[]>([]); // Cache für alle Labels

  const loadForms = async () => {
    const { data } = await supabase.from("forms").select("*").order("position").order("created_at");
    setForms((data ?? []) as Form[]);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  };

  const loadFields = async (formId: string) => {
    const { data } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("position");
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };

  const loadAllFields = async () => {
    const { data } = await supabase.from("form_fields").select("*");
    setAllFields((data ?? []) as Field[]);
  };

  const loadSubs = async () => {
    const { data } = await supabase.from("form_submissions").select("*").order("created_at", { ascending: false });
    setSubs((data ?? []) as Submission[]);
  };

  useEffect(() => { loadForms(); loadSubs(); loadAllFields(); }, []);
  useEffect(() => { if (activeId) loadFields(activeId); }, [activeId]);

  const updateForm = async (id: string, patch: Partial<Form>) => {
    setForms((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("forms").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

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
    loadSubs();
  };

  // Hilfsfunktion: Findet das lesbare Label zum technischen Key
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
          <Button onClick={() => {/* addForm Logic */}}><Plus className="h-4 w-4 mr-2" />Neues Formular</Button>
        </div>

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="submissions">Eingaben ({subs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            {/* ... Bestehender Builder Code ... */}
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
            <Card className="border-border bg-card overflow-hidden">
              {/* Desktop Ansicht: Tabelle */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[180px]">Datum</TableHead>
                      <TableHead className="w-[150px]">Formular</TableHead>
                      <TableHead>Inhalt bearbeiten</TableHead>
                      <TableHead className="w-[50px] text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s) => (
                      <TableRow key={s.id} className="align-top border-border">
                        <TableCell className="text-xs text-muted-foreground pt-4">
                          {new Date(s.created_at).toLocaleString("de-DE")}
                        </TableCell>
                        <TableCell className="font-medium pt-4">
                          {forms.find(f => f.id === s.form_id)?.title ?? "—"}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {Object.entries(s.data).map(([key, value]) => (
                              <div key={key} className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                                  {getFieldLabel(s.form_id, key)}
                                </Label>
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Ansicht: Karten-Layout */}
              <div className="md:hidden divide-y divide-border">
                {subs.map((s) => (
                  <div key={s.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase">
                          {forms.find(f => f.id === s.form_id)?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive -mt-2" onClick={() => deleteSubmission(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(s.data).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                            {getFieldLabel(s.form_id, key)}
                          </Label>
                          <Input 
                            className="h-9 bg-background"
                            value={String(value)} 
                            onChange={(e) => updateSubmissionData(s.id, key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
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
