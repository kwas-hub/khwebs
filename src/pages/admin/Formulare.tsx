import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, MessageSquareWarning, Calendar, Clock, FileText, GripVertical, Copy } from "lucide-react";
import { toast } from "sonner";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminFormRow,
  AdminFieldGroup,
  AdminDivider,
} from "@/components/admin";

type FieldType = "text" | "number" | "email" | "textarea" | "radio" | "checkbox" | "select" | "html";
type Field = {
  id: string; form_id: string; field_type: FieldType; label: string; field_name: string;
  options: string[]; html_content: string; required: boolean; position: number; placeholder: string;
};
type Form = { id: string; tenant_id: string; title: string; description: string; published: boolean; position: number; submit_label: string; success_message: string };
type Submission = { id: string; tenant_id: string; form_id: string; data: Record<string, any>; created_at: string; status: "open" | "confirmed" | "cancelled"; internal_note: string };

const generateIdFromLabel = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_") || "field_id";

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Textfeld", icon: "📝" },
  { value: "number", label: "Zahl", icon: "🔢" },
  { value: "email", label: "E-Mail", icon: "✉️" },
  { value: "textarea", label: "Textbereich", icon: "📄" },
  { value: "radio", label: "Radio-Buttons", icon: "🔘" },
  { value: "checkbox", label: "Checkboxen", icon: "☑️" },
  { value: "select", label: "Dropdown", icon: "📋" },
  { value: "html", label: "HTML/Script", icon: "</>" },
];

const Formulare = () => {
  const { isAdmin } = useUserRole();
  const { userId } = useAuth();
  const { currentTenant, isTenantAdmin } = useTenant();
  const [forms, setForms] = useState<Form[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [submissionFilterForm, setSubmissionFilterForm] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadForms = async () => {
    if (!currentTenant?.id) {
      setForms([]);
      return;
    }
    
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("position")
      .order("created_at");
    
    if (error) {
      console.error("Fehler beim Laden der Formulare:", error);
      toast.error("Formulare konnten nicht geladen werden");
      return;
    }
    
    setForms((data ?? []) as Form[]);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  };
  
  const loadFields = async (formId: string) => {
    const { data, error } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("position");
    
    if (error) {
      console.error("Fehler beim Laden der Felder:", error);
      return;
    }
    
    setFields((data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Field[]);
  };
  
  const loadSubs = async () => {
    if (!currentTenant?.id) return;
    
    const { data, error } = await supabase
      .from("form_submissions")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Fehler beim Laden der Eingaben:", error);
      return;
    }
    
    setSubs((data ?? []) as Submission[]);
  };

  useEffect(() => { 
    if (currentTenant?.id) {
      loadForms(); 
      loadSubs(); 
    }
    setLoading(false);
  }, [currentTenant?.id]);
  
  useEffect(() => { 
    if (activeId) loadFields(activeId); 
  }, [activeId]);

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
    // Prüfe Mandant
    if (!currentTenant?.id) {
      toast.error("Kein Mandant ausgewählt");
      return;
    }
    
    // Prüfe Berechtigung
    if (!isTenantAdmin) {
      toast.error("Nur Mandanten-Administratoren können Formulare erstellen");
      return;
    }
    
    setIsCreating(true);
    
    // Bestimme nächste Position
    const nextPosition = forms.length;
    
    const { data, error } = await supabase
      .from("forms")
      .insert({ 
        title: "Neues Formular",
        description: "",
        tenant_id: currentTenant.id,
        position: nextPosition,
        published: false,
        submit_label: "Absenden",
        success_message: "Vielen Dank für Ihre Nachricht!"
      })
      .select()
      .single();
    
    setIsCreating(false);
    
    if (error) {
      console.error("Fehler beim Erstellen:", error);
      if (error.message.includes("violates row-level security")) {
        toast.error("Keine Berechtigung: Bitte kontaktieren Sie den Administrator");
      } else {
        toast.error(error.message);
      }
      return;
    }
    
    toast.success("Formular erfolgreich erstellt");
    await loadForms(); 
    setActiveId(data.id);
  };
  
  const updateForm = async (id: string, patch: Partial<Form>) => {
    if (!currentTenant) return;
    setForms((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase
      .from("forms")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      toast.error(error.message);
    }
  };
  
  const deleteForm = async (id: string) => {
    if (!currentTenant) return;
    if (!confirm("Formular wirklich löschen?")) return;
    
    const { error } = await supabase
      .from("forms")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Formular gelöscht");
    setActiveId(null); 
    loadForms();
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
      html_content: type === "html" ? `<div class="html-content">\n  <!-- HTML Inhalt hier -->\n</div>` : "",
      required: false,
      placeholder: ""
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Feld hinzugefügt");
    loadFields(activeId);
  };

  const updateField = async (id: string, patch: Partial<Field>) => {
    if (patch.label !== undefined) patch.field_name = generateIdFromLabel(patch.label);
    setFields((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
    const { error } = await supabase.from("form_fields").update(patch).eq("id", id);
    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      toast.error(error.message);
    }
  };
  
  const deleteField = async (id: string) => {
    if (!confirm("Feld wirklich löschen?")) return;
    
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Feld gelöscht");
    if (activeId) loadFields(activeId);
  };
  
  const updateOption = (fieldId: string, index: number, value: string) => {
    const f = fields.find(x => x.id === fieldId); 
    if (!f) return;
    const o = [...f.options]; 
    o[index] = value;
    updateField(fieldId, { options: o });
  };
  
  const addOption = (fieldId: string) => {
    const f = fields.find(x => x.id === fieldId); 
    if (!f) return;
    updateField(fieldId, { options: [...f.options, `Option ${f.options.length + 1}`] });
  };
  
  const removeOption = (fieldId: string, index: number) => {
    const f = fields.find(x => x.id === fieldId); 
    if (!f || f.options.length <= 1) return;
    updateField(fieldId, { options: f.options.filter((_, i) => i !== index) });
  };

  const updateSubmissionData = async (id: string, key: string, value: string) => {
    if (!currentTenant) return;
    const sub = subs.find(s => s.id === id); 
    if (!sub) return;
    const data = { ...sub.data, [key]: value };
    setSubs(p => p.map(s => s.id === id ? { ...s, data } : s));
    const { error } = await supabase
      .from("form_submissions")
      .update({ data })
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) toast.error("Speichern fehlgeschlagen");
  };

  const updateSubmissionField = async (id: string, patch: Partial<Submission>) => {
    if (!currentTenant) return;
    setSubs(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
    const { error } = await supabase
      .from("form_submissions")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
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
        toast.message("Status gespeichert", { description: "Keine E-Mail-Adresse vorhanden." });
        return;
      }
      
      const triggerKey = `form_${sub.form_id}_${status === "confirmed" ? "confirmed" : "cancelled"}`;
      const formTitle = forms.find(f => f.id === sub.form_id)?.title || "";
      
      const { error } = await supabase.functions.invoke("send-template-email", {
        body: { to: email, triggerKey, vars: { ...sub.data, form_title: formTitle } },
      });
      
      if (error) {
        toast.error("Status gespeichert, aber E-Mail-Versand fehlgeschlagen: " + error.message);
      } else {
        toast.success(status === "confirmed" ? "Bestätigt – E-Mail gesendet" : "Abgelehnt – E-Mail gesendet");
      }
    } else {
      toast.success("Status gespeichert");
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!currentTenant) return;
    if (!confirm("Eintrag wirklich löschen?")) return;
    
    const { error } = await supabase
      .from("form_submissions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Eintrag gelöscht");
    loadSubs();
  };

  const duplicateForm = async (form: Form) => {
    if (!currentTenant || !isTenantAdmin) return;
    
    const newTitle = `${form.title} (Kopie)`;
    const { data: newForm, error: formError } = await supabase
      .from("forms")
      .insert({
        tenant_id: currentTenant.id,
        title: newTitle,
        description: form.description,
        published: false,
        position: forms.length,
        submit_label: form.submit_label,
        success_message: form.success_message,
      })
      .select()
      .single();
    
    if (formError) {
      toast.error(formError.message);
      return;
    }
    
    // Kopiere Felder
    for (const field of fields) {
      await supabase.from("form_fields").insert({
        form_id: newForm.id,
        field_type: field.field_type,
        label: field.label,
        field_name: field.field_name,
        options: field.options,
        html_content: field.html_content,
        required: field.required,
        position: field.position,
        placeholder: field.placeholder,
      });
    }
    
    toast.success("Formular dupliziert");
    await loadForms();
    setActiveId(newForm.id);
  };

  const activeForm = forms.find((f) => f.id === activeId);
  const filteredSubs = useMemo(() =>
    submissionFilterForm === "all" ? subs : subs.filter(s => s.form_id === submissionFilterForm),
    [subs, submissionFilterForm]);

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminPageHeader icon={FileText} title="Formulare" description="Verwalte Formulare und Formulareingaben" />
          <AdminCard className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={FileText} 
          title="Formulare" 
          description={`Verwalte Formulare und Eingaben für ${currentTenant.name}`}
          badge={`${forms.length} Formular(e)`}
          actions={
            isTenantAdmin && (
              <Button onClick={addForm} disabled={isCreating}>
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Wird erstellt...
                  </div>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Neues Formular
                  </>
                )}
              </Button>
            )
          }
        />

        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="builder">
              Formular-Builder
            </TabsTrigger>
            <TabsTrigger value="submissions">
              Eingaben
              <Badge variant="secondary" className="ml-2">{subs.length}</Badge>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="emails">
                <Mail className="h-3.5 w-3.5 mr-1" />
                E-Mail-Vorlagen
              </TabsTrigger>
            )}
          </TabsList>

          {/* BUILDER TAB */}
          <TabsContent value="builder">
            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              {/* Linke Spalte: Formular-Liste */}
              <AdminCard title="Formulare" description="Wähle ein Formular zum Bearbeiten" className="h-fit">
                <div className="space-y-1">
                  {forms.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveId(f.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        activeId === f.id 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate flex-1">{f.title || "(Unbenannt)"}</div>
                        {f.published ? (
                          <Badge variant="secondary" className="text-[9px] ml-2">Öffentlich</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] ml-2">Entwurf</Badge>
                        )}
                      </div>
                      {f.description && (
                        <div className="text-[10px] opacity-70 mt-0.5 truncate">{f.description}</div>
                      )}
                    </button>
                  ))}
                  {forms.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Keine Formulare vorhanden</p>
                      {isTenantAdmin && (
                        <Button variant="outline" size="sm" onClick={addForm} className="mt-2" disabled={isCreating}>
                          <Plus className="h-3 w-3 mr-1" />
                          Erstes Formular erstellen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </AdminCard>

              {/* Rechte Spalte: Formular-Editor */}
              {activeForm ? (
                <div className="space-y-6">
                  {/* Formular-Einstellungen */}
                  <AdminCard 
                    title="Formular-Einstellungen"
                    description="Allgemeine Einstellungen für dieses Formular"
                  >
                    <div className="space-y-4">
                      <AdminFormRow columns={2}>
                        <AdminFieldGroup label="Titel" required>
                          <Input 
                            value={activeForm.title} 
                            onChange={(e) => updateForm(activeForm.id, { title: e.target.value })} 
                            placeholder="z.B. Kontaktformular"
                          />
                        </AdminFieldGroup>
                        <AdminFieldGroup label="Button-Text" optional>
                          <Input 
                            value={activeForm.submit_label || "Absenden"} 
                            onChange={(e) => updateForm(activeForm.id, { submit_label: e.target.value })} 
                            placeholder="Absenden"
                          />
                        </AdminFieldGroup>
                      </AdminFormRow>

                      <AdminFieldGroup label="Beschreibung" optional>
                        <Textarea 
                          rows={2} 
                          value={activeForm.description || ""} 
                          onChange={(e) => updateForm(activeForm.id, { description: e.target.value })} 
                          placeholder="Wird oberhalb des Formulars angezeigt..."
                        />
                      </AdminFieldGroup>

                      <AdminFieldGroup label="Erfolgsmeldung" optional>
                        <Textarea 
                          rows={2} 
                          value={activeForm.success_message || ""} 
                          onChange={(e) => updateForm(activeForm.id, { success_message: e.target.value })} 
                          placeholder="Nachricht nach erfolgreichem Absenden..."
                        />
                      </AdminFieldGroup>

                      <AdminDivider spacing="sm" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch 
                            checked={activeForm.published} 
                            onCheckedChange={(v) => updateForm(activeForm.id, { published: v })} 
                          />
                          <Label className="text-sm font-medium cursor-pointer">Öffentlich sichtbar</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => duplicateForm(activeForm)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Duplizieren
                          </Button>
                          {isTenantAdmin && (
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => deleteForm(activeForm.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Löschen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </AdminCard>

                  {/* Formular-Felder */}
                  <AdminCard 
                    title="Formular-Felder"
                    description="Ziehe Felder, um sie anzuordnen"
                    actions={
                      isTenantAdmin && (
                        <div className="flex flex-wrap gap-1">
                          {FIELD_TYPES.map((t) => (
                            <Button 
                              key={t.value} 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => addField(t.value)} 
                              className="h-7 text-[10px] font-bold uppercase"
                            >
                              {t.icon} {t.label}
                            </Button>
                          ))}
                        </div>
                      )
                    }
                  >
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="p-4 space-y-3 bg-muted/20 border rounded-lg group hover:border-primary/30 transition-all">
                          {/* Feld-Header */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5" 
                                  disabled={index === 0} 
                                  onClick={() => moveField(index, 'up')}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5" 
                                  disabled={index === fields.length - 1} 
                                  onClick={() => moveField(index, 'down')}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              <Badge variant="secondary" className="uppercase tracking-widest text-[9px]">
                                {field.field_type}
                              </Badge>
                              <span className="text-[9px] font-mono text-muted-foreground">
                                name=<span className="text-foreground font-mono">{field.field_name}</span>
                              </span>
                              <label className="flex items-center gap-1 text-[9px] ml-1 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={field.required} 
                                  onChange={(e) => updateField(field.id, { required: e.target.checked })} 
                                  className="h-3 w-3"
                                />
                                <span>Pflicht</span>
                              </label>
                            </div>
                            {isTenantAdmin && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                                onClick={() => deleteField(field.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          {/* HTML-Feld Sonderbehandlung */}
                          {field.field_type === "html" ? (
                            <Textarea 
                              className="font-mono text-xs bg-zinc-950 text-green-400 rounded-lg p-3 min-h-[150px]"
                              value={field.html_content || ""} 
                              onChange={(e) => updateField(field.id, { html_content: e.target.value })} 
                            />
                          ) : (
                            <>
                              <AdminFormRow columns={2}>
                                <AdminFieldGroup label="Label" optional>
                                  <Input 
                                    className="h-8 text-sm" 
                                    value={field.label} 
                                    onChange={(e) => updateField(field.id, { label: e.target.value })} 
                                  />
                                </AdminFieldGroup>
                                <AdminFieldGroup label="Platzhalter" optional>
                                  <Input 
                                    className="h-8 text-sm" 
                                    value={field.placeholder || ""} 
                                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })} 
                                  />
                                </AdminFieldGroup>
                              </AdminFormRow>
                            </>
                          )}

                          {/* Optionen für Radio/Checkbox/Select */}
                          {(field.field_type === "radio" || field.field_type === "checkbox" || field.field_type === "select") && (
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-[9px] font-bold uppercase text-muted-foreground">Optionen</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {field.options.map((opt, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <Input 
                                      className="h-7 text-xs bg-background" 
                                      value={opt} 
                                      onChange={(e) => updateOption(field.id, idx, e.target.value)} 
                                    />
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                                      onClick={() => removeOption(field.id, idx)}
                                      disabled={field.options.length <= 1}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[9px] font-bold uppercase" 
                                  onClick={() => addOption(field.id)}
                                >
                                  + Option hinzufügen
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {fields.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                          <p className="text-sm">Noch keine Felder vorhanden</p>
                          <p className="text-xs mt-1">Klicke auf einen Feld-Typ oben, um es hinzuzufügen</p>
                        </div>
                      )}
                    </div>
                  </AdminCard>
                </div>
              ) : (
                <AdminCard className="p-12 text-center">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground mb-2">Kein Formular ausgewählt</p>
                  <p className="text-xs text-muted-foreground">Wähle ein Formular aus der Liste aus oder erstelle ein neues.</p>
                </AdminCard>
              )}
            </div>
          </TabsContent>

          {/* SUBMISSIONS TAB */}
          <TabsContent value="submissions">
            <AdminSection spacing="lg">
              {/* Filter-Bar */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Filter:</Label>
                  <Select value={submissionFilterForm} onValueChange={setSubmissionFilterForm}>
                    <SelectTrigger className="w-64 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📋 Alle Formulare</SelectItem>
                      {forms.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {filteredSubs.length} Eintrag(e)
                </Badge>
              </div>

              {/* Submissions Liste */}
              <div className="space-y-4">
                {filteredSubs.map((submission) => {
                  const email = findEmail(submission);
                  const dateObj = new Date(submission.created_at);
                  const formTitle = forms.find(f => f.id === submission.form_id)?.title || "Unbekanntes Formular";
                  
                  return (
                    <AdminCard key={submission.id} className="hover:border-primary/30 transition-all">
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Datum/Zeit Spalte */}
                        <div className="flex flex-row lg:flex-col gap-2 lg:w-28 flex-shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 rounded-md border text-xs font-medium">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {dateObj.toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 rounded-md border text-xs font-medium">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {dateObj.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Formular-Info Spalte */}
                        <div className="lg:w-48 flex-shrink-0">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Formular</div>
                          <div className="p-2 bg-muted/30 rounded-md border text-sm font-medium truncate">
                            {formTitle}
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase h-5 mt-2 bg-background">
                            ID: {submission.form_id.slice(0, 8)}
                          </Badge>
                        </div>

                        {/* Daten Spalte */}
                        <div className="flex-1 min-w-[200px]">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Eingabe-Daten</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(submission.data).map(([key, value]) => (
                              <div key={key} className="flex flex-col p-2 bg-muted/20 rounded-md border border-border/50">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground truncate">{key}</span>
                                <Input 
                                  className="h-7 text-xs bg-transparent border-none p-0 focus-visible:ring-0 mt-0.5" 
                                  value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} 
                                  onChange={(e) => updateSubmissionData(submission.id, key, e.target.value)} 
                                />
                              </div>
                            ))}
                          </div>
                          {!email && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase">
                              <MessageSquareWarning className="h-3 w-3" /> Keine E-Mail-Adresse erkannt
                            </div>
                          )}
                        </div>

                        {/* Notiz Spalte */}
                        <div className="lg:w-56 flex-shrink-0">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Interne Notiz</div>
                          <Textarea 
                            className="text-xs leading-tight min-h-[70px] bg-muted/10 resize-none border-border/60 p-2" 
                            placeholder="Optionale interne Notiz..."
                            value={submission.internal_note || ""} 
                            onChange={(e) => updateSubmissionField(submission.id, { internal_note: e.target.value })} 
                          />
                        </div>

                        {/* Status & Aktionen Spalte */}
                        <div className="flex flex-row lg:flex-col items-center gap-2 lg:w-36 flex-shrink-0">
                          <Select 
                            value={submission.status} 
                            onValueChange={(v) => updateSubmissionStatus(submission.id, v as any)}
                          >
                            <SelectTrigger className={`h-8 text-xs font-bold ${
                              submission.status === 'confirmed' ? 'text-emerald-600 border-emerald-200 bg-emerald-50/50' : 
                              submission.status === 'cancelled' ? 'text-red-600 border-red-200 bg-red-50/50' : 
                              'text-amber-600 border-amber-200 bg-amber-50/50'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">📋 Offen</SelectItem>
                              <SelectItem value="confirmed">✅ Bestätigt</SelectItem>
                              <SelectItem value="cancelled">❌ Abgelehnt</SelectItem>
                            </SelectContent>
                          </Select>
                          {isTenantAdmin && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-destructive h-8 w-8 hover:bg-destructive/10" 
                              onClick={() => deleteSubmission(submission.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </AdminCard>
                  );
                })}
                {filteredSubs.length === 0 && (
                  <AdminCard className="p-12 text-center border-2 border-dashed">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">Keine Formulareingaben vorhanden</p>
                    <p className="text-xs text-muted-foreground mt-1">Sobald jemand ein Formular absendet, erscheint es hier.</p>
                  </AdminCard>
                )}
              </div>
            </AdminSection>
          </TabsContent>

          {/* EMAIL TEMPLATES TAB */}
          {isAdmin && (
            <TabsContent value="emails">
              <AdminSection spacing="md">
                <AdminCard 
                  title="E-Mail-Vorlagen" 
                  description="Konfiguriere E-Mail-Vorlagen für Bestätigungen und Ablehnungen pro Formular"
                >
                  <div className="space-y-6">
                    <div className="bg-muted/30 rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Verfügbare Variablen:</strong> Alle Feld-Namen des Formulars (z. B. <code className="bg-muted px-1 rounded">{"{{vorname}}"}</code>, 
                        <code className="bg-muted px-1 rounded">{"{{email}}"}</code>) sowie <code className="bg-muted px-1 rounded">{"{{form_title}}"}</code>.
                      </p>
                    </div>

                    {forms.map((form) => (
                      <details key={form.id} className="group border rounded-lg" open={activeForm?.id === form.id}>
                        <summary className="cursor-pointer p-3 bg-muted/30 rounded-lg font-semibold flex items-center justify-between">
                          <span>{form.title}</span>
                          <Badge variant={form.published ? "default" : "secondary"} className="text-[9px]">
                            {form.published ? "Veröffentlicht" : "Entwurf"}
                          </Badge>
                        </summary>
                        <div className="p-4 space-y-4">
                          <EmailTemplateEditor
                            triggerKey={`form_${form.id}_confirmed`}
                            title="✓ Bestätigungs-E-Mail"
                            defaultSubject={`Ihre Anfrage wurde angenommen`}
                            defaultBody={`Hallo,\n\nvielen Dank für Ihre Anfrage zu „{{form_title}}". Wir haben sie geprüft und freuen uns, sie zu bestätigen.\n\nMit freundlichen Grüßen\nIhr Team`}
                          />
                          <EmailTemplateEditor
                            triggerKey={`form_${form.id}_cancelled`}
                            title="✗ Ablehnungs-E-Mail"
                            defaultSubject={`Ihre Anfrage konnte nicht angenommen werden`}
                            defaultBody={`Hallo,\n\nleider können wir Ihre Anfrage zu „{{form_title}}" nicht bearbeiten.\n\nMit freundlichen Grüßen\nIhr Team`}
                          />
                        </div>
                      </details>
                    ))}

                    {forms.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>Keine Formulare vorhanden</p>
                        <p className="text-xs mt-1">Erstelle zuerst ein Formular, um E-Mail-Vorlagen zu konfigurieren.</p>
                      </div>
                    )}
                  </div>
                </AdminCard>
              </AdminSection>
            </TabsContent>
          )}
        </Tabs>
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default Formulare;