import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, RotateCw, Trash2, ChevronUp, ChevronDown, Sparkles, Download, FileText, Bug, WifiOff } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Doc = { id: string; name: string; storage_path: string; page_order: PageMeta[]; notes: string; created_at: string };
type PageMeta = { idx: number; rotation: number };
type WordBlock = { text: string; x: number; y: number; w: number; h: number };

const RENDER_SCALE = 1.4;

const AIPage = () => {
  const { userId } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [activePageOrderIdx, setActivePageOrderIdx] = useState(0);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [wordBlocks, setWordBlocks] = useState<WordBlock[]>([]);
  const [pageOcrText, setPageOcrText] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [renderedSize, setRenderedSize] = useState({ w: 0, h: 0 });
  const [ocrDebug, setOcrDebug] = useState<{ response: any; error: string | null; source: string }>({ response: null, error: null, source: "" });
  const [showDebug, setShowDebug] = useState(false);
  const [ocrCache, setOcrCache] = useState<Record<number, WordBlock[]>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDoc = docs.find(d => d.id === activeDocId) || null;
  const pageOrder: PageMeta[] = activeDoc?.page_order || [];
  const activeMeta = pageOrder[activePageOrderIdx];

  /* ---------- LOAD DOC LIST ---------- */
  const loadDocs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("pdf_documents").select("*").order("created_at", { ascending: false });
    setDocs((data ?? []) as unknown as Doc[]);
  }, [userId]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  /* ---------- LOAD PDF ---------- */
  useEffect(() => {
    const run = async () => {
      if (!activeDoc) { setPdfDoc(null); return; }
      setNotes(activeDoc.notes || "");
      setActivePageOrderIdx(0);
      setThumbs({});
      setOcrCache({});
      const { data, error } = await supabase.storage.from("pdfs").download(activeDoc.storage_path);
      if (error) { toast.error("Download fehlgeschlagen"); return; }
      const buf = await data.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(pdf);
    };
    run();
  }, [activeDoc?.id]);

  /* ---------- THUMBNAILS ---------- */
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

  /* ---------- NATIVE PDF.JS TEXTEXTRAKTION (Fallback) ---------- */
  const extractNativeWordBlocks = async (page: any, viewport: any, canvasWidth: number, canvasHeight: number): Promise<WordBlock[]> => {
    try {
      const textContent = await page.getTextContent();
      const items = textContent.items;
      if (!items || !Array.isArray(items)) return [];
      const blocks: WordBlock[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== "object") continue;
        const str = item.str;
        if (!str || str.trim() === "") continue;
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        if (item.transform && Array.isArray(item.transform) && item.transform.length >= 6) {
          const [a, b, c, d, e, f] = item.transform;
          x1 = e;
          y1 = f;
          const w = typeof item.width === "number" ? item.width : 0;
          const h = typeof item.height === "number" ? item.height : 0;
          x2 = e + w;
          y2 = f + h;
        } else if (typeof item.x === "number" && typeof item.y === "number") {
          x1 = item.x;
          y1 = item.y;
          const w = typeof item.width === "number" ? item.width : 0;
          const h = typeof item.height === "number" ? item.height : 0;
          x2 = item.x + w;
          y2 = item.y + h;
        } else {
          continue;
        }
        if (x2 <= x1 || y2 <= y1) continue;
        const [x1v, y1v] = viewport.convertToViewportPoint(x1, y1);
        const [x2v, y2v] = viewport.convertToViewportPoint(x2, y2);
        const left = Math.min(x1v, x2v);
        const top = Math.min(y1v, y2v);
        const width = Math.abs(x2v - x1v);
        const height = Math.abs(y2v - y1v);
        if (width <= 0.5 || height <= 0.5) continue;
        blocks.push({
          text: str,
          x: left / canvasWidth,
          y: top / canvasHeight,
          w: width / canvasWidth,
          h: height / canvasHeight,
        });
      }
      return blocks;
    } catch (err) {
      console.warn("Native Extraktion fehlgeschlagen", err);
      return [];
    }
  };

  /* ---------- SERVER OCR (Edge Function) mit Zerlegung in Wörter ---------- */
  const runServerOCRForImage = async (imageDataUrl: string): Promise<WordBlock[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("pdf-ocr", {
        body: { imageDataUrl },
      });
      if (error) throw error;
      let blocks = data?.blocks;
      if (!blocks || !Array.isArray(blocks)) return [];
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const wordBlocks: WordBlock[] = [];
      for (const block of blocks) {
        const text = block.text || "";
        if (!text.trim()) continue;
        const bbox = block.bbox;
        if (!bbox) continue;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) continue;
        const totalChars = text.length;
        let currentCharPos = 0;
        const blockLeft = bbox.x;
        const blockTop = bbox.y;
        const blockWidth = bbox.w;
        const blockHeight = bbox.h;
        for (const word of words) {
          const wordStart = text.indexOf(word, currentCharPos);
          if (wordStart === -1) {
            currentCharPos += word.length + 1;
            continue;
          }
          const wordEnd = wordStart + word.length;
          const startRatio = wordStart / totalChars;
          const endRatio = wordEnd / totalChars;
          const wordX = blockLeft + startRatio * blockWidth;
          const wordW = (endRatio - startRatio) * blockWidth;
          wordBlocks.push({
            text: word,
            x: wordX,
            y: blockTop,
            w: wordW,
            h: blockHeight,
          });
          currentCharPos = wordEnd + 1;
        }
      }
      return wordBlocks;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  };

  /* ---------- OCR FÜR EINE EINZELNE SEITE (unter Verwendung eines Canvas) ---------- */
  const performOCRForPage = async (pageIndex: number, canvasElement: HTMLCanvasElement): Promise<WordBlock[] | null> => {
    try {
      const imageDataUrl = canvasElement.toDataURL("image/jpeg", 0.85);
      let words = await runServerOCRForImage(imageDataUrl);
      if (words && words.length > 0) {
        await supabase.from("pdf_pages").upsert({
          document_id: activeDoc!.id,
          page_index: pageIndex,
          ocr_text: words.map(w => w.text).join(" "),
          ocr_blocks: words as any,
        }, { onConflict: "document_id,page_index" });
        return words;
      } else {
        if (!pdfDoc) return null;
        const page = await pdfDoc.getPage(pageIndex + 1);
        const pm = pageOrder.find(p => p.idx === pageIndex);
        const rotation = pm?.rotation || 0;
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation });
        const nativeWords = await extractNativeWordBlocks(page, viewport, canvasElement.width, canvasElement.height);
        if (nativeWords.length > 0) {
          await supabase.from("pdf_pages").upsert({
            document_id: activeDoc!.id,
            page_index: pageIndex,
            ocr_text: nativeWords.map(w => w.text).join(" "),
            ocr_blocks: nativeWords as any,
          }, { onConflict: "document_id,page_index" });
          return nativeWords;
        }
        return [];
      }
    } catch (err) {
      console.error(`OCR Fehler für Seite ${pageIndex + 1}:`, err);
      return null;
    }
  };

  /* ---------- OCR FÜR ALLE SEITEN (einmalig, mit Fortschritt) ---------- */
  const runOCRForAllPages = async () => {
    if (!pdfDoc || !activeDoc) {
      toast.error("Kein PDF geladen");
      return;
    }
    if (pageOrder.length === 0) return;
    setOcrRunning(true);
    setOcrProgress({ current: 0, total: pageOrder.length });
    const newCache: Record<number, WordBlock[]> = {};

    for (let i = 0; i < pageOrder.length; i++) {
      const pm = pageOrder[i];
      const pageIdx = pm.idx;

      if (ocrCache[pageIdx]) {
        newCache[pageIdx] = ocrCache[pageIdx];
        setOcrProgress({ current: i + 1, total: pageOrder.length });
        continue;
      }
      const { data: existing } = await supabase
        .from("pdf_pages")
        .select("ocr_blocks")
        .eq("document_id", activeDoc.id)
        .eq("page_index", pageIdx)
        .maybeSingle();
      if (existing && existing.ocr_blocks && (existing.ocr_blocks as any[]).length > 0) {
        const blocks = existing.ocr_blocks as WordBlock[];
        newCache[pageIdx] = blocks;
        setOcrCache(prev => ({ ...prev, [pageIdx]: blocks }));
        setOcrProgress({ current: i + 1, total: pageOrder.length });
        continue;
      }

      const page = await pdfDoc.getPage(pageIdx + 1);
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: pm.rotation });
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      const ctx = tempCanvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const words = await performOCRForPage(pageIdx, tempCanvas);
      if (words && words.length > 0) {
        newCache[pageIdx] = words;
        setOcrCache(prev => ({ ...prev, [pageIdx]: words }));
      } else {
        newCache[pageIdx] = [];
      }
      setOcrProgress({ current: i + 1, total: pageOrder.length });
    }

    setOcrRunning(false);
    toast.success(`OCR für ${pageOrder.length} Seiten abgeschlossen`);
    if (activeMeta && newCache[activeMeta.idx]) {
      setWordBlocks(newCache[activeMeta.idx]);
      setPageOcrText(newCache[activeMeta.idx].map(w => w.text).join(" "));
    }
  };

  /* ---------- SEITE RENDERN + LADEN AUS CACHE/DB (KEINE AUTOMATISCHE OCR) ---------- */
  useEffect(() => {
    const run = async () => {
      if (!pdfDoc || !activeMeta || !canvasRef.current) return;
      setWordBlocks([]);
      setPageOcrText("");
      const page = await pdfDoc.getPage(activeMeta.idx + 1);
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: activeMeta.rotation });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setRenderedSize({ w: viewport.width, h: viewport.height });
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (ocrCache[activeMeta.idx]) {
        const cached = ocrCache[activeMeta.idx];
        setWordBlocks(cached);
        setPageOcrText(cached.map(w => w.text).join(" "));
        setOcrDebug({ response: null, error: null, source: "cache" });
        return;
      }
      const { data: existing } = await supabase
        .from("pdf_pages")
        .select("ocr_blocks")
        .eq("document_id", activeDoc!.id)
        .eq("page_index", activeMeta.idx)
        .maybeSingle();
      if (existing && existing.ocr_blocks && (existing.ocr_blocks as any[]).length > 0) {
        const blocks = existing.ocr_blocks as WordBlock[];
        setWordBlocks(blocks);
        setPageOcrText(blocks.map(w => w.text).join(" "));
        setOcrCache(prev => ({ ...prev, [activeMeta.idx]: blocks }));
        setOcrDebug({ response: null, error: null, source: "database" });
        return;
      }
      setOcrDebug({ response: null, error: null, source: "none" });
    };
    run();
  }, [pdfDoc, activePageOrderIdx, activeMeta?.rotation, activeMeta?.idx, activeDoc?.id, ocrCache]);

  const runOCRCurrentPage = async () => {
    if (!pdfDoc || !activeMeta || !canvasRef.current) return;
    setOcrRunning(true);
    try {
      const canvas = canvasRef.current;
      const words = await performOCRForPage(activeMeta.idx, canvas);
      if (words && words.length > 0) {
        setWordBlocks(words);
        setPageOcrText(words.map(w => w.text).join(" "));
        setOcrCache(prev => ({ ...prev, [activeMeta.idx]: words }));
        toast.success(`${words.length} Wörter erkannt (Seite ${activePageOrderIdx + 1})`);
      } else {
        toast.error("Keine Wörter erkannt");
      }
    } catch (err: any) {
      toast.error("OCR Fehler: " + (err.message || "Unbekannt"));
    } finally {
      setOcrRunning(false);
    }
  };

  /* ---------- WEITERE FUNKTIONEN (Upload, Seitenaktionen, Notes, Export, Insert) ---------- */
  const handleUpload = async (file: File) => {
    if (!userId) return;
    if (file.type !== "application/pdf") { toast.error("Nur PDF-Dateien"); return; }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file);
      if (upErr) throw upErr;
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
  const saveNotes = async (v: string) => {
    setNotes(v);
    if (!activeDoc) return;
    await supabase.from("pdf_documents").update({ notes: v }).eq("id", activeDoc.id);
  };
  const insertAtCursor = (txt: string) => {
    const ta = textareaRef.current;
    if (!ta) { setNotes(n => n + txt); return; }
    const start = ta.selectionStart ?? notes.length;
    const end = ta.selectionEnd ?? notes.length;
    const before = notes.slice(0, start);
    const after = notes.slice(end);
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
  const deleteDoc = async () => {
    if (!activeDoc || !confirm("Dokument wirklich löschen?")) return;
    await supabase.storage.from("pdfs").remove([activeDoc.storage_path]);
    await supabase.from("pdf_documents").delete().eq("id", activeDoc.id);
    setActiveDocId(null); setPdfDoc(null);
    loadDocs();
    toast.success("Dokument gelöscht");
  };
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

  /* ---------- RENDER (responsiv optimiert) ---------- */
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> AI / OCR
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              PDFs hochladen, Seiten bearbeiten, einzelne Wörter übernehmen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeDocId || ""} onValueChange={setActiveDocId}>
              <SelectTrigger className="w-48 sm:w-56 h-9 text-sm">
                <SelectValue placeholder="Historie / PDF wählen" />
              </SelectTrigger>
              <SelectContent>
                {docs.length === 0 && <div className="p-2 text-xs text-muted-foreground">Keine Dokumente</div>}
                {docs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm" className="h-9">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              PDF hochladen
            </Button>
            {activeDoc && (
              <>
                <Button variant="outline" onClick={exportEdited} size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
                <Button variant="destructive" size="icon" onClick={deleteDoc} className="h-9 w-9">
                  <Trash2 className="h-4 w-4" />
                </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[260px_1fr_1fr] gap-4">
            {/* Seitenleiste */}
            <Card className="p-3 space-y-2 overflow-y-auto">
              <div className="flex justify-between items-center px-1 mb-2">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Seiten ({pageOrder.length})</div>
                <Button size="sm" variant="outline" onClick={runOCRForAllPages} disabled={ocrRunning} className="h-6 text-[10px]">
                  {ocrRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  OCR alle
                </Button>
              </div>
              {ocrRunning && (
                <div className="text-xs text-center text-muted-foreground mb-2">
                  OCR Fortschritt: {ocrProgress.current} / {ocrProgress.total}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-1 gap-2">
                {pageOrder.map((pm, i) => (
                  <div key={i} className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${i === activePageOrderIdx ? "border-primary shadow-md" : "border-transparent hover:border-border"}`} onClick={() => setActivePageOrderIdx(i)}>
                    <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                      {thumbs[pm.idx] ? <img src={thumbs[pm.idx]} alt={`Seite ${i + 1}`} className="w-full h-full object-contain" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    <div className="absolute top-1 left-1 bg-background/90 text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</div>
                    <div className="absolute bottom-1 right-1 flex gap-0.5">
                      <Button size="icon" variant="secondary" className="h-6 w-6" onClick={e => { e.stopPropagation(); movePage(i, -1); }} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="secondary" className="h-6 w-6" onClick={e => { e.stopPropagation(); movePage(i, 1); }} disabled={i === pageOrder.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="secondary" className="h-6 w-6" onClick={e => { e.stopPropagation(); rotatePage(i); }}><RotateCw className="h-3 w-3" /></Button>
                      <Button size="icon" variant="destructive" className="h-6 w-6" onClick={e => { e.stopPropagation(); deletePage(i); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Editor */}
            <Card className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Input value={activeDoc.name} className="h-8 text-sm font-bold border-0 px-1 flex-1" onChange={async e => {
                  setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, name: e.target.value } : d));
                  await supabase.from("pdf_documents").update({ name: e.target.value }).eq("id", activeDoc.id);
                }} />
                <div className="flex gap-1">
                  <Button onClick={runOCRCurrentPage} disabled={ocrRunning} size="sm">
                    {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Seite OCR
                  </Button>
                </div>
              </div>
              <Textarea ref={textareaRef} value={notes} onChange={e => saveNotes(e.target.value)} className="flex-1 min-h-[250px] sm:min-h-[300px] md:min-h-[400px] font-mono text-sm" placeholder="Erkannter Text wird hier eingefügt..." />
              <div className="text-[10px] text-muted-foreground mt-1">Klicke auf ein erkanntes Wort in der Vorschau, um es einzufügen.</div>
            </Card>

            {/* Vorschau mit Wort-Overlays */}
            <Card className="p-3 overflow-auto bg-muted/30 relative">
              <div className="relative inline-block max-w-full">
                <canvas ref={canvasRef} className="block max-w-full h-auto shadow-md" />
                {wordBlocks.map((word, i) => (
                  <button key={i} onClick={() => insertAtCursor(word.text)} title={word.text}
                    className="absolute border border-blue-400/60 bg-blue-500/10 hover:bg-blue-500/30 transition-colors cursor-pointer rounded-sm"
                    style={{ left: `${word.x * 100}%`, top: `${word.y * 100}%`, width: `${word.w * 100}%`, height: `${word.h * 100}%` }} />
                ))}
              </div>
              {/* Debug-Bereich */}
              {(ocrDebug.response || ocrDebug.error || ocrDebug.source) && (
                <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">🔍 OCR Debug</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="h-6 px-2">
                      {showDebug ? "Weniger" : "Mehr"} <Bug className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                  <div className="mt-1">Quelle: <span className="font-mono">{ocrDebug.source || "?"}</span></div>
                  {ocrDebug.error && <div className="text-red-600 mt-1">❌ Fehler: {ocrDebug.error}</div>}
                  {showDebug && ocrDebug.response && (
                    <pre className="mt-2 overflow-auto max-h-60 bg-black text-white p-2 rounded text-[10px]">{JSON.stringify(ocrDebug.response, null, 2)}</pre>
                  )}
                  {wordBlocks.length === 0 && !ocrRunning && <div className="text-red-600 mt-1">⚠️ Keine Wörter erkannt.</div>}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AIPage;
