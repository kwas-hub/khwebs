import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, RotateCw, Trash2, ChevronUp, ChevronDown, Sparkles, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

// pdfjs setup
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Doc = { id: string; name: string; storage_path: string; page_order: PageMeta[]; notes: string; created_at: string };
type PageMeta = { idx: number; rotation: number };
type Block = { text: string; bbox: { x: number; y: number; w: number; h: number } };

const RENDER_SCALE = 1.4;

const AIPage = () => {
  const { userId } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [activePageOrderIdx, setActivePageOrderIdx] = useState(0);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pageOcrText, setPageOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renderedSize, setRenderedSize] = useState({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDoc = docs.find(d => d.id === activeDocId) || null;
  const pageOrder: PageMeta[] = activeDoc?.page_order || [];
  const activeMeta = pageOrder[activePageOrderIdx];

  /* ------- LOAD DOC LIST ------- */
  const loadDocs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("pdf_documents").select("*").order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
  }, [userId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  /* ------- LOAD PDF when activeDoc changes ------- */
  useEffect(() => {
    const run = async () => {
      if (!activeDoc) { setPdfDoc(null); return; }
      setNotes(activeDoc.notes || "");
      setActivePageOrderIdx(0);
      setThumbs({});
      const { data, error } = await supabase.storage.from("pdfs").download(activeDoc.storage_path);
      if (error) { toast.error("Download fehlgeschlagen"); return; }
      const buf = await data.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(pdf);
    };
    run();
  }, [activeDoc?.id]);

  /* ------- THUMBNAILS ------- */
  useEffect(() => {
    if (!pdfDoc || pageOrder.length === 0) return;
    let cancelled = false;
    const run = async () => {
      const out: Record<number, string> = {};
      for (const pm of pageOrder) {
        if (cancelled) return;
        if (out[pm.idx] !== undefined) continue;
        try {
          const page = await pdfDoc.getPage(pm.idx + 1);
          const vp = page.getViewport({ scale: 0.25, rotation: pm.rotation });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          out[pm.idx] = c.toDataURL("image/jpeg", 0.6);
        } catch (e) { /* ignore */ }
      }
      if (!cancelled) setThumbs(out);
    };
    run();
    return () => { cancelled = true; };
  }, [pdfDoc, pageOrder.length]);

  /* ------- RENDER ACTIVE PAGE ------- */
  useEffect(() => {
    const run = async () => {
      if (!pdfDoc || !activeMeta || !canvasRef.current) return;
      setBlocks([]); setPageOcrText("");
      const page = await pdfDoc.getPage(activeMeta.idx + 1);
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: activeMeta.rotation });
      const canvas = canvasRef.current;
      canvas.width = viewport.width; canvas.height = viewport.height;
      setRenderedSize({ w: viewport.width, h: viewport.height });
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      // Load existing OCR if any
      const { data } = await supabase.from("pdf_pages").select("*")
        .eq("document_id", activeDoc!.id).eq("page_index", activeMeta.idx).maybeSingle();
      if (data) {
        setBlocks((data.ocr_blocks as Block[]) || []);
        setPageOcrText(data.ocr_text || "");
      }
    };
    run();
  }, [pdfDoc, activePageOrderIdx, activeMeta?.rotation, activeMeta?.idx]);

  /* ------- UPLOAD ------- */
  const handleUpload = async (file: File) => {
    if (!userId) return;
    if (file.type !== "application/pdf") { toast.error("Nur PDF-Dateien"); return; }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file);
      if (upErr) throw upErr;
      // Determine page count
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const order: PageMeta[] = Array.from({ length: pdf.numPages }, (_, i) => ({ idx: i, rotation: 0 }));
      const { data, error } = await supabase.from("pdf_documents").insert({
        owner_id: userId, name: file.name, storage_path: path, page_order: order as any, notes: "",
      }).select().single();
      if (error) throw error;
      toast.success("PDF hochgeladen");
      await loadDocs();
      setActiveDocId(data.id);
    } catch (e: any) {
      toast.error(e.message || "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  /* ------- PAGE ACTIONS ------- */
  const persistOrder = async (newOrder: PageMeta[], focusIdx?: number) => {
    if (!activeDoc) return;
    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, page_order: newOrder } : d));
    if (focusIdx !== undefined) setActivePageOrderIdx(Math.max(0, Math.min(focusIdx, newOrder.length - 1)));
    await supabase.from("pdf_documents").update({ page_order: newOrder as any }).eq("id", activeDoc.id);
  };
  const rotatePage = (i: number) => {
    const next = pageOrder.map((p, idx) => idx === i ? { ...p, rotation: (p.rotation + 90) % 360 } : p);
    persistOrder(next, i);
  };
  const deletePage = (i: number) => {
    if (pageOrder.length <= 1) { toast.error("Mindestens 1 Seite erforderlich"); return; }
    const next = pageOrder.filter((_, idx) => idx !== i);
    persistOrder(next, Math.min(i, next.length - 1));
  };
  const movePage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pageOrder.length) return;
    const next = [...pageOrder];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next, j);
  };

  /* ------- NOTES ------- */
  const saveNotes = async (v: string) => {
    setNotes(v);
    if (!activeDoc) return;
    await supabase.from("pdf_documents").update({ notes: v }).eq("id", activeDoc.id);
  };

  /* ------- OCR ------- */
  const runOCR = async () => {
    if (!canvasRef.current || !activeDoc || !activeMeta) return;
    setOcrLoading(true); setBlocks([]); setPageOcrText("");
    try {
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
      const { data, error } = await supabase.functions.invoke("pdf-ocr", { body: { imageDataUrl: dataUrl } });
      if (error) throw error;
      const ocrBlocks: Block[] = data.blocks || [];
      const fullText: string = data.full_text || "";
      setBlocks(ocrBlocks); setPageOcrText(fullText);
      // Persist
      await supabase.from("pdf_pages").upsert({
        document_id: activeDoc.id, page_index: activeMeta.idx,
        ocr_text: fullText, ocr_blocks: ocrBlocks as any,
      }, { onConflict: "document_id,page_index" } as any).then(async () => {
        // upsert may fail without unique; try delete+insert fallback
      });
      toast.success(`${ocrBlocks.length} Textblöcke erkannt`);
    } catch (e: any) {
      toast.error("OCR Fehler: " + (e.message || "Unbekannt"));
    } finally {
      setOcrLoading(false);
    }
  };

  /* ------- INSERT TEXT AT CURSOR ------- */
  const insertAtCursor = (txt: string) => {
    const ta = textareaRef.current;
    if (!ta) { setNotes(n => n + txt); return; }
    const start = ta.selectionStart ?? notes.length;
    const end = ta.selectionEnd ?? notes.length;
    const before = notes.slice(0, start);
    const after = notes.slice(end);
    // smart linebreak: add newline if previous char isn't whitespace/newline
    const prefix = before.length > 0 && !/\s$/.test(before) ? "\n" : "";
    const suffix = after.length > 0 && !/^\s/.test(after) ? "\n" : "";
    const inserted = prefix + txt.trim() + suffix;
    const next = before + inserted + after;
    setNotes(next);
    saveNotes(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + inserted).length;
      ta.setSelectionRange(pos, pos);
    });
  };

  /* ------- DELETE DOC ------- */
  const deleteDoc = async () => {
    if (!activeDoc || !confirm("Dokument wirklich löschen?")) return;
    await supabase.storage.from("pdfs").remove([activeDoc.storage_path]);
    await supabase.from("pdf_documents").delete().eq("id", activeDoc.id);
    setActiveDocId(null); setPdfDoc(null);
    loadDocs();
    toast.success("Dokument gelöscht");
  };

  /* ------- EXPORT EDITED PDF ------- */
  const exportEdited = async () => {
    if (!pdfDoc || !activeDoc) return;
    toast.loading("Erstelle PDF...", { id: "exp" });
    try {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      let first = true;
      for (const pm of pageOrder) {
        const page = await pdfDoc.getPage(pm.idx + 1);
        const vp = page.getViewport({ scale: 1.5, rotation: pm.rotation });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        const img = c.toDataURL("image/jpeg", 0.85);
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / vp.width, pageH / vp.height);
        const w = vp.width * ratio, h = vp.height * ratio;
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(img, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      }
      pdf.save(`${activeDoc.name.replace(/\.pdf$/i, "")}-bearbeitet.pdf`);
      toast.success("Export fertig", { id: "exp" });
    } catch (e: any) {
      toast.error("Fehler: " + e.message, { id: "exp" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" /> AI / OCR</h1>
            <p className="text-sm text-muted-foreground">PDFs hochladen, Seiten bearbeiten, Text per OCR übernehmen.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeDocId || ""} onValueChange={(v) => setActiveDocId(v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Historie / PDF wählen" /></SelectTrigger>
              <SelectContent>
                {docs.length === 0 && <div className="p-2 text-xs text-muted-foreground">Keine Dokumente</div>}
                {docs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              PDF hochladen
            </Button>
            {activeDoc && (
              <>
                <Button variant="outline" onClick={exportEdited}><Download className="h-4 w-4 mr-2" />Export</Button>
                <Button variant="destructive" size="icon" onClick={deleteDoc}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </div>

        {!activeDoc ? (
          <Card className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Lade ein PDF hoch oder wähle eines aus der Historie aus.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-4">
            {/* SPALTE 1: Seiten */}
            <Card className="p-3 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              <div className="text-[10px] font-bold uppercase text-muted-foreground px-1">Seiten ({pageOrder.length})</div>
              {pageOrder.map((pm, i) => (
                <div key={i}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${i === activePageOrderIdx ? "border-primary shadow-md" : "border-transparent hover:border-border"}`}
                  onClick={() => setActivePageOrderIdx(i)}>
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                    {thumbs[pm.idx] ? (
                      <img src={thumbs[pm.idx]} alt={`Seite ${i + 1}`} className="w-full h-full object-contain" style={{ transform: `rotate(0deg)` /* thumb already rotated via render */ }} />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="absolute top-1 left-1 bg-background/90 text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</div>
                  <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100" style={{ opacity: 1 }}>
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); movePage(i, -1); }} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); movePage(i, 1); }} disabled={i === pageOrder.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); rotatePage(i); }}><RotateCw className="h-3 w-3" /></Button>
                    <Button size="icon" variant="destructive" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deletePage(i); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </Card>

            {/* SPALTE 2: Editor */}
            <Card className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Input value={activeDoc.name} className="h-8 text-sm font-bold border-0 px-1 focus-visible:ring-1"
                  onChange={async (e) => {
                    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, name: e.target.value } : d));
                    await supabase.from("pdf_documents").update({ name: e.target.value }).eq("id", activeDoc.id);
                  }} />
                <Button onClick={runOCR} disabled={ocrLoading} size="sm">
                  {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  OCR Seite {activePageOrderIdx + 1}
                </Button>
              </div>
              <Textarea ref={textareaRef} value={notes} onChange={(e) => saveNotes(e.target.value)}
                className="flex-1 min-h-[400px] font-mono text-sm" placeholder="Erkannter Text wird hier eingefügt..." />
              <div className="text-[10px] text-muted-foreground mt-1">Klicke auf einen erkannten Block in der Vorschau, um ihn an der Cursorposition einzufügen.</div>
            </Card>

            {/* SPALTE 3: Vorschau */}
            <Card className="p-3 max-h-[calc(100vh-220px)] overflow-auto bg-muted/30">
              {ocrLoading && (
                <div className="absolute inset-0 z-10 bg-background/70 flex items-center justify-center backdrop-blur-sm rounded-md">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-bold uppercase">OCR läuft...</span>
                  </div>
                </div>
              )}
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block max-w-full h-auto shadow-md" />
                {/* Overlays */}
                {blocks.map((b, i) => (
                  <button key={i} onClick={() => insertAtCursor(b.text)}
                    title={b.text}
                    className="absolute border-2 border-primary/60 bg-primary/10 hover:bg-primary/30 transition-colors cursor-pointer"
                    style={{
                      left: `${b.bbox.x * 100}%`,
                      top: `${b.bbox.y * 100}%`,
                      width: `${b.bbox.w * 100}%`,
                      height: `${b.bbox.h * 100}%`,
                    }} />
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AIPage;
