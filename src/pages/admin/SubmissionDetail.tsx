import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const SubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("form_submissions").select("*").eq("id", submissionId).maybeSingle();
      if (!s) { toast.error("Nicht gefunden"); return; }
      setSub(s);
      const [fr, ff] = await Promise.all([
        supabase.from("forms").select("*").eq("id", s.form_id).maybeSingle(),
        supabase.from("form_fields").select("*").eq("form_id", s.form_id).order("position"),
      ]);
      setForm(fr.data); setFields(ff.data ?? []);
      // Mark as read
      if (!s.read_at) {
        await supabase.from("form_submissions").update({ read_at: new Date().toISOString() }).eq("id", s.id);
      }
    };
    load();
  }, [submissionId]);

  const updateNote = async (note: string) => {
    setSub((p: any) => ({ ...p, internal_note: note }));
    await supabase.from("form_submissions").update({ internal_note: note }).eq("id", sub.id);
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    toast.loading("Erzeuge PDF...", { id: "pdf" });
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
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

  if (!sub) return <AdminLayout><div className="animate-pulse p-8">Lade...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
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

        <Card className="p-8" ref={printRef}>
          <div className="space-y-4">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6" /> {form?.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Eingegangen am {new Date(sub.created_at).toLocaleString("de-DE")}
                </p>
              </div>
              <Badge variant={sub.status === "confirmed" ? "default" : sub.status === "cancelled" ? "destructive" : "secondary"}>
                {sub.status}
              </Badge>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {fields.filter(f => f.field_type !== "html").map((f) => {
                const v = sub.data[f.field_name];
                return (
                  <div key={f.id} className="break-inside-avoid">
                    <dt className="text-xs font-bold uppercase text-muted-foreground">{f.label}</dt>
                    <dd className="text-sm font-medium mt-0.5 break-words">
                      {Array.isArray(v) ? v.join(", ") : (v ?? <span className="text-muted-foreground italic">—</span>)}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {sub.internal_note && (
              <div className="border-t pt-4">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Interne Notiz</div>
                <p className="text-sm whitespace-pre-wrap">{sub.internal_note}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <label className="text-xs font-bold uppercase text-muted-foreground">Interne Notiz bearbeiten</label>
          <Textarea
            className="mt-2"
            rows={4}
            value={sub.internal_note || ""}
            onChange={(e) => updateNote(e.target.value)}
            placeholder="Interne Bemerkungen..."
          />
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SubmissionDetail;
