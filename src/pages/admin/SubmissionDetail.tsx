import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, FileText, Calendar, Clock, User, Mail, Phone, MapPin, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTenant } from "@/contexts/TenantContext";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminFieldGroup,
  AdminDivider,
} from "@/components/admin";

const SubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { currentTenant, isTenantAdmin } = useTenant();
  const [sub, setSub] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!submissionId || !currentTenant?.id) return;
    
    const load = async () => {
      setLoading(true);
      
      const { data: s, error: subError } = await supabase
        .from("form_submissions")
        .select("*")
        .eq("id", submissionId)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      
      if (subError || !s) { 
        toast.error("Eintrag nicht gefunden oder kein Zugriff"); 
        setLoading(false);
        return; 
      }
      
      setSub(s);
      
      const { data: fr, error: formError } = await supabase
        .from("forms")
        .select("*")
        .eq("id", s.form_id)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      
      if (formError) console.error("Formular Fehler:", formError);
      setForm(fr);
      
      const { data: ff } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", s.form_id)
        .order("position");
      
      setFields(ff ?? []);
      
      if (!s.read_at && isTenantAdmin) {
        await supabase
          .from("form_submissions")
          .update({ read_at: new Date().toISOString() })
          .eq("id", s.id)
          .eq("tenant_id", currentTenant.id);
      }
      
      setLoading(false);
    };
    
    load();
  }, [submissionId, currentTenant?.id, isTenantAdmin]);

  const updateNote = async (note: string) => {
    if (!currentTenant?.id || !isTenantAdmin) return;
    
    setSavingNote(true);
    setSub((p: any) => ({ ...p, internal_note: note }));
    
    const { error } = await supabase
      .from("form_submissions")
      .update({ internal_note: note })
      .eq("id", sub.id)
      .eq("tenant_id", currentTenant.id);
    
    if (error) {
      toast.error("Notiz konnte nicht gespeichert werden");
    } else {
      toast.success("Notiz gespeichert");
    }
    setSavingNote(false);
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    toast.loading("Erzeuge PDF...", { id: "pdf" });
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      const img = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const ratio = pageW / canvas.width;
      const h = canvas.height * ratio;
      pdf.addImage(img, "JPEG", 0, 0, pageW, h);
      pdf.save(`eingabe-${sub.id.slice(0,8)}.pdf`);
      toast.success("PDF erstellt", { id: "pdf" });
    } catch (e: any) {
      toast.error("Fehler: " + e.message, { id: "pdf" });
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { icon: CheckCircle2, label: "Bestätigt", variant: "default", color: "emerald" };
      case "cancelled":
        return { icon: XCircle, label: "Abgelehnt", variant: "destructive", color: "red" };
      default:
        return { icon: AlertCircle, label: "Offen", variant: "secondary", color: "amber" };
    }
  };

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminPageHeader 
            icon={FileText} 
            title="Formular-Details" 
            description="Details einer Formulareingabe anzeigen" 
          />
          <AdminCard className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminCard className="p-12 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Lade Formulareingabe...</span>
            </div>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  if (!sub) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
            </Button>
            <AdminCard className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500 opacity-50" />
              <p className="text-muted-foreground">Eintrag nicht gefunden oder Sie haben keine Berechtigung dafür.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/formulare")}>
                Zu den Formularen
              </Button>
            </AdminCard>
          </div>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  const statusConfig = getStatusConfig(sub.status);
  const StatusIcon = statusConfig.icon;
  const dateObj = new Date(sub.created_at);

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        {/* Header mit Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Drucken
            </Button>
            <Button onClick={exportPDF} size="sm">
              <Download className="h-4 w-4 mr-2" /> PDF Export
            </Button>
          </div>
        </div>

        {/* Hauptinhalt */}
        <div ref={printRef}>
          <AdminCard className="overflow-hidden">
            {/* Header-Bereich */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h1 className="text-2xl font-bold">{form?.title || "Formular-Eingabe"}</h1>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{dateObj.toLocaleDateString("de-DE", { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{dateObj.toLocaleTimeString("de-DE", { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span>ID: {sub.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={statusConfig.variant as any}
                  className="text-sm py-1.5 px-3 flex items-center gap-1.5"
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            {/* Formular-Daten */}
            <div className="p-6">
              <AdminSection spacing="md">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Eingabedaten
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {fields
                    .filter((f: any) => f.field_type !== "html")
                    .map((f: any) => {
                      const value = sub.data[f.field_name];
                      let displayValue = Array.isArray(value) ? value.join(", ") : (value ?? "");
                      
                      // Spezielle Formatierung für E-Mail
                      if (f.field_type === "email" && value) {
                        displayValue = <a href={`mailto:${value}`} className="text-primary hover:underline">{value}</a>;
                      }
                      
                      // Spezielle Formatierung für Telefon
                      if (f.field_type === "tel" && value) {
                        displayValue = <a href={`tel:${value}`} className="text-primary hover:underline">{value}</a>;
                      }
                      
                      return (
                        <div key={f.id} className="break-inside-avoid bg-muted/10 rounded-lg p-3 border">
                          <dt className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                            {f.field_type === "email" && <Mail className="h-3 w-3" />}
                            {f.field_type === "tel" && <Phone className="h-3 w-3" />}
                            {f.field_type === "address" && <MapPin className="h-3 w-3" />}
                            {f.label}
                            {f.required && <span className="text-red-500">*</span>}
                          </dt>
                          <dd className="text-sm font-medium mt-1 break-words">
                            {displayValue !== "" && displayValue !== null ? (
                              displayValue
                            ) : (
                              <span className="text-muted-foreground italic">— Nicht angegeben —</span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                </div>
                
                {fields.filter((f: any) => f.field_type === "html").length > 0 && (
                  <>
                    <AdminDivider spacing="md" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Zusätzliche Inhalte
                    </h2>
                    <div className="space-y-4">
                      {fields
                        .filter((f: any) => f.field_type === "html")
                        .map((f: any) => (
                          <div key={f.id} className="p-4 bg-muted/10 rounded-lg border">
                            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                              {f.label}
                            </div>
                            <div 
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: f.html_content || "" }}
                            />
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </AdminSection>
            </div>

            {/* Interne Notiz (Anzeige) */}
            {sub.internal_note && (
              <>
                <AdminDivider spacing="none" />
                <div className="p-6 bg-muted/5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Interne Notiz
                  </h2>
                  <div className="p-4 bg-muted/20 rounded-lg border-l-4 border-primary">
                    <p className="text-sm whitespace-pre-wrap">{sub.internal_note}</p>
                  </div>
                </div>
              </>
            )}
          </AdminCard>
        </div>

        {/* Notiz-Editor (nur für Admins) */}
        {isTenantAdmin && (
          <AdminSection spacing="lg">
            <AdminCard 
              title="Interne Notiz"
              description="Füge eine private Notiz hinzu (nur für Administratoren sichtbar)"
            >
              <AdminFieldGroup label="Notiz" optional>
                <Textarea
                  rows={4}
                  value={sub.internal_note || ""}
                  onChange={(e) => updateNote(e.target.value)}
                  placeholder="Interne Bemerkungen, Hinweise für andere Admins oder Bearbeitungsstatus..."
                  disabled={savingNote}
                  className="resize-y"
                />
              </AdminFieldGroup>
              {savingNote && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <div className="h-2 w-2 animate-spin rounded-full border border-primary border-t-transparent" />
                  Speichern...
                </div>
              )}
            </AdminCard>
          </AdminSection>
        )}

        {/* Footer mit Zusatzinformationen */}
        <AdminDivider spacing="lg" />
        <div className="text-[10px] text-muted-foreground text-center py-4 border-t">
          <p>Formular-ID: {sub.form_id} | Eingabe-ID: {sub.id}</p>
          <p className="mt-1">
            {sub.read_at && (
              <span className="flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" />
                Gelesen am {new Date(sub.read_at).toLocaleString("de-DE")}
              </span>
            )}
          </p>
        </div>
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default SubmissionDetail;