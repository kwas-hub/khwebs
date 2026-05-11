import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, RotateCw, Trash2, ChevronUp, ChevronDown, Sparkles, Download, FileText, Bug, Undo2, Plus, Settings, Scissors, FolderOpen, MoveUp, MoveDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Doc = {
  id: string; name: string; storage_path: string; page_order: PageMeta[]; notes: string;
  created_at: string; checked_out_by: string | null;
  detected_type_id: string | null; matched_keywords: string[];
};
type PageMeta = { idx: number; rotation: number };
type WordBlock = { text: string; x: number; y: number; w: number; h: number };
type DocType = { id: string; name: string; split_enabled?: boolean; split_regex?: string };
type Keyword = { id: string; type_id: string; keyword: string };
type SplitInfo = { pageIndex: number; match: string; position: number };

const RENDER_SCALE = 1.4;
const PAGE_THUMB_SCALE = 0.15;

const AIPage = () => {
  const { userId } = useAuth();
  const [tab, setTab] = useState("dokumente");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [activePageOrderIdx, setActivePageOrderIdx] = useState(0);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [wordBlocks, setWordBlocks] = useState<WordBlock[]>([]);
  const [pageOcrText, setPageOcrText] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgressPercent, setOcrProgressPercent] = useState(0);
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [renderedSize, setRenderedSize] = useState({ w: 0, h: 0 });
  const [ocrDebug, setOcrDebug] = useState<{ response: any; error: string | null; source: string }>({ response: null, error: null, source: "" });
  const [showDebug, setShowDebug] = useState(false);
  const [ocrCache, setOcrCache] = useState<Record<number, WordBlock[]>>({});
  const [splitInfo, setSplitInfo] = useState<SplitInfo | null>(null);
  const [allPagesThumbs, setAllPagesThumbs] = useState<Record<string, Record<number, string>>>({});

  // Document types / Properties
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeSplitRegex, setNewTypeSplitRegex] = useState("");
  const [newTypeSplitEnabled, setNewTypeSplitEnabled] = useState(false);
  const [newKeywordByType, setNewKeywordByType] = useState<Record<string, string>>({});
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  
  // Global split settings
  const [globalSplitEnabled, setGlobalSplitEnabled] = useState(false);
  const [globalSplitRegex, setGlobalSplitRegex] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeDoc = docs.find(d => d.id === activeDocId) || null;
  const pageOrder: PageMeta[] = activeDoc?.page_order || [];
  const activeMeta = pageOrder[activePageOrderIdx];
  const detectedType = useMemo(() => docTypes.find(t => t.id === activeDoc?.detected_type_id) || null, [docTypes, activeDoc?.detected_type_id]);
  const selectedType = useMemo(() => docTypes.find(t => t.id === selectedTypeId) || null, [docTypes, selectedTypeId]);
  const selectedKeywords = useMemo(() => keywords.filter(k => k.type_id === selectedTypeId), [keywords, selectedTypeId]);

  // Meine ausgecheckten Dokumente
  const myCheckedOutDocs = useMemo(() => docs.filter(d => d.checked_out_by === userId), [docs, userId]);
  // Andere Dokumente (nicht vom aktuellen User ausgecheckt)
  const otherDocs = useMemo(() => docs.filter(d => d.checked_out_by !== userId), [docs, userId]);

  /* ---------- LOAD ---------- */
  const loadDocs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("pdf_documents").select("*").order("created_at", { ascending: false });
    setDocs(((data ?? []) as any[]).map(d => ({ ...d, matched_keywords: d.matched_keywords ?? [] })) as Doc[]);
  }, [userId]);
  const loadTypes = useCallback(async () => {
    const [t, k] = await Promise.all([
      supabase.from("document_types").select("*").order("name"),
      supabase.from("document_type_keywords").select("*").order("keyword"),
    ]);
    setDocTypes((t.data ?? []) as DocType[]);
    setKeywords((k.data ?? []) as Keyword[]);
  }, []);
  useEffect(() => { loadDocs(); loadTypes(); }, [loadDocs, loadTypes]);

  // Thumbnails für alle Seiten aller aktiven Dokumente laden
  useEffect(() => {
    const loadAllPageThumbnails = async () => {
      if (!userId) return;
      const newThumbs: Record<string, Record<number, string>> = {};
      
      for (const doc of myCheckedOutDocs) {
        const { data, error } = await supabase.storage.from("pdfs").download(doc.storage_path);
        if (error) continue;
        const buf = await data.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const out: Record<number, string> = {};
        const order: PageMeta[] = doc.page_order;
        for (let i = 0; i < order.length; i++) {
          const pm = order[i];
          try {
            const page = await pdf.getPage(pm.idx + 1);
            const vp = page.getViewport({ scale: PAGE_THUMB_SCALE, rotation: pm.rotation });
            const c = document.createElement("canvas");
            c.width = vp.width; c.height = vp.height;
            await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
            out[pm.idx] = c.toDataURL("image/jpeg", 0.5);
          } catch (e) { /* ignore */ }
        }
        newThumbs[doc.id] = out;
      }
      setAllPagesThumbs(newThumbs);
    };
    loadAllPageThumbnails();
  }, [myCheckedOutDocs, userId]);

  // Funktion zum Auswählen eines Dokuments und einer bestimmten Seite
  const selectDocAndPage = async (docId: string, pageIdx: number) => {
    setActiveDocId(docId);
    setActivePageOrderIdx(pageIdx);
    if (!userId) return;
    const d = docs.find(x => x.id === docId);
    if (!d) return;
    if (d.checked_out_by !== userId) {
      await supabase.from("pdf_documents")
        .update({ checked_out_by: userId, checked_out_at: new Date().toISOString() })
        .eq("id", docId);
      setDocs(p => p.map(x => x.id === docId ? { ...x, checked_out_by: userId } : x));
    }
    setNotes(d.notes || "");
    setSplitInfo(null);
  };
  
  const releaseDoc = async (docId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    await supabase.from("pdf_documents")
      .update({ checked_out_by: null, checked_out_at: null })
      .eq("id", docId);
    toast.success("Dokument zurückgelegt");
    if (activeDocId === docId) {
      setActiveDocId(null);
      setPdfDoc(null);
    }
    loadDocs();
  };

  // Speichere Split-Einstellungen für einen Typ
  const saveTypeSplitSettings = async (typeId: string, splitEnabled: boolean, splitRegex: string) => {
    setDocTypes(p => p.map(t => t.id === typeId ? { ...t, split_enabled: splitEnabled, split_regex: splitRegex } : t));
    await supabase.from("document_types").update({ 
      split_enabled: splitEnabled, 
      split_regex: splitRegex 
    }).eq("id", typeId);
  };

  // Funktion zum Aktualisieren des erkannten Dokuments im Textarea
  const updateDetectedInfoInNotes = async (type: DocType | null, matchedKw: string[]) => {
    if (!activeDoc) return;
    const header = `=== Dokumenttyp: ${type?.name || "Kein Typ erkannt"} ===\n`;
    const keywordsLine = `Erkannte Schlagwörter: ${matchedKw.join(", ") || "Keine"}\n`;
    const separator = "=".repeat(40) + "\n\n";
    
    const newContent = header + keywordsLine + separator + (activeDoc.notes || "");
    setNotes(newContent);
    await supabase.from("pdf_documents").update({ notes: newContent }).eq("id", activeDoc.id);
  };

  // Finde die Stelle, an der das Dokument getrennt werden soll
  const findSplitPoint = (pagesText: string[]): SplitInfo | null => {
    const fullText = pagesText.join(" ");
    
    if (globalSplitEnabled && globalSplitRegex) {
      try {
        const regex = new RegExp(globalSplitRegex, 'i');
        const match = regex.exec(fullText);
        if (match) {
          let charCount = 0;
          for (let i = 0; i < pagesText.length; i++) {
            const pageStart = charCount;
            const pageEnd = charCount + pagesText[i].length;
            if (match.index >= pageStart && match.index < pageEnd) {
              return { pageIndex: i, match: match[0], position: match.index - pageStart };
            }
            charCount = pageEnd + 1;
          }
        }
      } catch (e) { console.warn("Invalid global regex", e); }
    }
    
    if (activeDoc?.detected_type_id) {
      const type = docTypes.find(t => t.id === activeDoc.detected_type_id);
      if (type?.split_enabled && type?.split_regex) {
        try {
          const regex = new RegExp(type.split_regex, 'i');
          const match = regex.exec(fullText);
          if (match) {
            let charCount = 0;
            for (let i = 0; i < pagesText.length; i++) {
              const pageStart = charCount;
              const pageEnd = charCount + pagesText[i].length;
              if (match.index >= pageStart && match.index < pageEnd) {
                return { pageIndex: i, match: match[0], position: match.index - pageStart };
              }
              charCount = pageEnd + 1;
            }
          }
        } catch (e) { console.warn("Invalid type regex", e); }
      }
    }
    
    return null;
  };

  // Führe die Dokumententrennung durch
  const performSplit = async (split: SplitInfo) => {
    if (!activeDoc || !pdfDoc) return;
    
    toast.loading(`Trenne Dokument an Seite ${split.pageIndex + 1}...`, { id: "split" });
    
    try {
      const firstPartPages = pageOrder.slice(0, split.pageIndex + 1);
      const secondPartPages = pageOrder.slice(split.pageIndex + 1);
      
      if (secondPartPages.length === 0) {
        toast.error("Keine Seiten für zweiten Teil vorhanden", { id: "split" });
        return;
      }
      
      const timestamp = Date.now();
      const newDoc1Name = `${activeDoc.name.replace(/\.pdf$/i, "")}_Teil1_${timestamp}.pdf`;
      const newDoc2Name = `${activeDoc.name.replace(/\.pdf$/i, "")}_Teil2_${timestamp}.pdf`;
      
      const { data: newDoc1, error: err1 } = await supabase.from("pdf_documents").insert({
        owner_id: userId,
        name: newDoc1Name,
        storage_path: activeDoc.storage_path,
        page_order: firstPartPages as any,
        notes: `Getrennt von ${activeDoc.name} (Teil 1)`,
        checked_out_by: userId,
        checked_out_at: new Date().toISOString(),
        detected_type_id: activeDoc.detected_type_id,
        matched_keywords: activeDoc.matched_keywords,
      }).select().single();
      
      if (err1) throw err1;
      
      const { data: newDoc2, error: err2 } = await supabase.from("pdf_documents").insert({
        owner_id: userId,
        name: newDoc2Name,
        storage_path: activeDoc.storage_path,
        page_order: secondPartPages as any,
        notes: `Getrennt von ${activeDoc.name} (Teil 2)`,
        checked_out_by: userId,
        checked_out_at: new Date().toISOString(),
        detected_type_id: activeDoc.detected_type_id,
        matched_keywords: activeDoc.matched_keywords,
      }).select().single();
      
      if (err2) throw err2;
      
      await supabase.from("pdf_documents").delete().eq("id", activeDoc.id);
      
      toast.success(`Dokument getrennt: "${newDoc1Name}" und "${newDoc2Name}"`, { id: "split" });
      
      await loadDocs();
      setActiveDocId(newDoc1.id);
      setSplitInfo(null);
      
    } catch (error: any) {
      console.error("Split error:", error);
      toast.error(`Fehler beim Trennen: ${error.message}`, { id: "split" });
    }
  };

  // Manuelle Trennung an aktueller Seite
  const manualSplitAtCurrentPage = async () => {
    if (!activeDoc) {
      toast.error("Kein Dokument ausgewählt");
      return;
    }
    const split: SplitInfo = {
      pageIndex: activePageOrderIdx,
      match: "manuell",
      position: 0
    };
    await performSplit(split);
  };

  // Prüfe nach OCR, ob getrennt werden soll
  const checkAndSplit = async (pagesText: string[]) => {
    const split = findSplitPoint(pagesText);
    if (split) {
      setSplitInfo(split);
      const shouldSplit = window.confirm(`Trennpunkt gefunden: "${split.match}" auf Seite ${split.pageIndex + 1}. Möchten Sie das Dokument hier trennen?`);
      if (shouldSplit) {
        await performSplit(split);
      }
    }
  };

  /* ---------- LOAD PDF ---------- */
  useEffect(() => {
    const run = async () => {
      if (!activeDoc) { setPdfDoc(null); return; }
      setNotes(activeDoc.notes || "");
      setActivePageOrderIdx(0);
      setThumbs({});
      setOcrCache({});
      setSplitInfo(null);
      const { data, error } = await supabase.storage.from("pdfs").download(activeDoc.storage_path);
      if (error) { toast.error("Download fehlgeschlagen"); return; }
      const buf = await data.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(pdf);
    };
    run();
  }, [activeDoc?.id]);

  /* ---------- THUMBNAILS für aktives Dokument (Detailansicht rechts) ---------- */
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
          out[pm.idx] = c.toDataURL("image/jpeg", 0.5);
        } catch (e) { /* ignore */ }
      }
      if (!cancelled) setThumbs(out);
    };
    run();
    return () => { cancelled = true; };
  }, [pdfDoc, pageOrder.length]);

  /* ---------- SEITEN AKTIONEN ---------- */
  const rotateCurrentPage = () => {
    if (!activeDoc) return;
    const next = pageOrder.map((p, idx) => idx === activePageOrderIdx ? { ...p, rotation: (p.rotation + 90) % 360 } : p);
    persistOrder(next, activePageOrderIdx);
  };
  
  const deleteCurrentPage = async () => {
    if (!activeDoc || pageOrder.length <= 1) {
      toast.error("Mindestens 1 Seite erforderlich");
      return;
    }
    const next = pageOrder.filter((_, idx) => idx !== activePageOrderIdx);
    const newIdx = Math.min(activePageOrderIdx, next.length - 1);
    await persistOrder(next, newIdx);
  };
  
  const movePageUp = () => {
    if (activePageOrderIdx === 0) return;
    const j = activePageOrderIdx - 1;
    const next = [...pageOrder];
    [next[activePageOrderIdx], next[j]] = [next[j], next[activePageOrderIdx]];
    persistOrder(next, j);
  };
  
  const movePageDown = () => {
    if (activePageOrderIdx === pageOrder.length - 1) return;
    const j = activePageOrderIdx + 1;
    const next = [...pageOrder];
    [next[activePageOrderIdx], next[j]] = [next[j], next[activePageOrderIdx]];
    persistOrder(next, j);
  };

  const persistOrder = async (newOrder: PageMeta[], focusIdx?: number) => {
    if (!activeDoc) return;
    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, page_order: newOrder } : d));
    if (focusIdx !== undefined) setActivePageOrderIdx(Math.max(0, Math.min(focusIdx, newOrder.length - 1)));
    await supabase.from("pdf_documents").update({ page_order: newOrder as any }).eq("id", activeDoc.id);
    // Thumbnails neu laden
    setThumbs({});
  };

  /* ---------- NATIVE PDF.JS TEXTEXTRAKTION (EXAKTE WÖRTER) ---------- */
  const extractExactWordBlocks = async (page: any, viewport: any, canvasWidth: number, canvasHeight: number): Promise<WordBlock[]> => {
    try {
      const textContent = await page.getTextContent();
      const items = textContent.items;
      if (!items || !Array.isArray(items)) return [];
      
      const blocks: WordBlock[] = [];
      
      for (const item of items) {
        const str = item?.str;
        if (!str || !str.trim()) continue;
        
        if (!item.transform || item.transform.length < 6) continue;
        
        const [, , , , e, f] = item.transform;
        const w = typeof item.width === "number" ? item.width : 0;
        const h = typeof item.height === "number" ? item.height : 0;
        
        if (w <= 0 || h <= 0) continue;
        
        const words = str.split(/\s+/).filter((word: string) => word.length > 0);
        if (words.length === 0) continue;
        
        let accumulatedChars = 0;
        const totalChars = str.length;
        
        for (const word of words) {
          const wordStart = str.indexOf(word, accumulatedChars);
          if (wordStart === -1) {
            accumulatedChars += word.length + 1;
            continue;
          }
          
          const startRatio = wordStart / totalChars;
          const endRatio = (wordStart + word.length) / totalChars;
          
          const x1 = e + (startRatio * w);
          const x2 = e + (endRatio * w);
          
          const [x1v, y1v] = viewport.convertToViewportPoint(x1, f);
          const [x2v, y2v] = viewport.convertToViewportPoint(x2, f + h);
          
          const left = Math.min(x1v, x2v);
          const top = Math.min(y1v, y2v);
          const width = Math.abs(x2v - x1v);
          const height = Math.abs(y2v - y1v);
          
          if (width > 0.5 && height > 0.5) {
            blocks.push({
              text: word,
              x: left / canvasWidth,
              y: top / canvasHeight,
              w: width / canvasWidth,
              h: height / canvasHeight,
            });
          }
          
          accumulatedChars = wordStart + word.length;
        }
      }
      
      console.log(`Native Extraktion: ${blocks.length} Wörter mit exakten Positionen`);
      return blocks;
    } catch (err) {
      console.warn("Native Extraktion fehlgeschlagen", err);
      return [];
    }
  };

  /* ---------- SERVER OCR (FALLBACK für gescannte PDFs) ---------- */
  const runServerOCRForImage = async (imageDataUrl: string): Promise<WordBlock[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("pdf-ocr", { body: { imageDataUrl } });
      if (error) throw error;
      const arr = (data?.words ?? data?.blocks) as any[] | undefined;
      if (!arr || !Array.isArray(arr)) return [];
      const out: WordBlock[] = [];
      for (const b of arr) {
        const text = (b?.text ?? "").toString().trim();
        const bbox = b?.bbox;
        if (!text || !bbox) continue;
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          out.push({ text: words[0], x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h });
        } else {
          const total = words.join("").length || 1;
          let acc = 0;
          for (const w of words) {
            const sR = acc / total;
            const eR = (acc + w.length) / total;
            acc += w.length;
            out.push({ text: w, x: bbox.x + sR * bbox.w, y: bbox.y, w: (eR - sR) * bbox.w, h: bbox.h });
          }
        }
      }
      console.log(`Server-OCR Fallback: ${out.length} Wörter`);
      return out;
    } catch (err) {
      console.error("Server-OCR Fehler:", err);
      return null;
    }
  };

  /* ---------- OCR FÜR EINE SEITE (PRIORITÄT: NATIVE PDF.JS) ---------- */
  const performOCRForPage = async (pageIndex: number, canvasElement: HTMLCanvasElement): Promise<WordBlock[] | null> => {
    try {
      // 1. Zuerst native PDF.js Extraktion (exakte Positionen)
      if (pdfDoc) {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const pm = pageOrder.find(p => p.idx === pageIndex);
        const rotation = pm?.rotation || 0;
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation });
        const nativeWords = await extractExactWordBlocks(page, viewport, canvasElement.width, canvasElement.height);
        
        if (nativeWords && nativeWords.length > 0) {
          await supabase.from("pdf_pages").upsert({
            document_id: activeDoc!.id, page_index: pageIndex,
            ocr_text: nativeWords.map(w => w.text).join(" "), 
            ocr_blocks: nativeWords as any,
          }, { onConflict: "document_id,page_index" });
          return nativeWords;
        }
      }
      
      // 2. Fallback: Server-OCR (für gescannte PDFs)
      const imageDataUrl = canvasElement.toDataURL("image/jpeg", 0.85);
      const serverWords = await runServerOCRForImage(imageDataUrl);
      if (serverWords && serverWords.length > 0) {
        await supabase.from("pdf_pages").upsert({
          document_id: activeDoc!.id, page_index: pageIndex,
          ocr_text: serverWords.map(w => w.text).join(" "), 
          ocr_blocks: serverWords as any,
        }, { onConflict: "document_id,page_index" });
        return serverWords;
      }
      
      return [];
    } catch (err) {
      console.error(`OCR Fehler Seite ${pageIndex + 1}:`, err);
      return null;
    }
  };

  /* ---------- KEYWORD DETECTION ---------- */
  const detectTypeFromText = (fullText: string): { typeId: string | null; matched: string[] } => {
    if (!fullText) return { typeId: null, matched: [] };
    let bestType: string | null = null;
    let bestMatches: string[] = [];
    
    for (const t of docTypes) {
      const kws = keywords.filter(k => k.type_id === t.id).map(k => k.keyword);
      const found: string[] = [];
      
      for (const kw of kws) {
        try {
          const regex = new RegExp(kw, 'i');
          if (regex.test(fullText)) {
            found.push(kw);
          }
        } catch {
          if (fullText.toLowerCase().includes(kw.toLowerCase())) {
            found.push(kw);
          }
        }
      }
      
      if (found.length > bestMatches.length) {
        bestMatches = found;
        bestType = t.id;
      }
    }
    return { typeId: bestType, matched: bestMatches };
  };
  
  const persistDetection = async (typeId: string | null, matched: string[]) => {
    if (!activeDoc) return;
    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, detected_type_id: typeId, matched_keywords: matched } : d));
    await supabase.from("pdf_documents")
      .update({ detected_type_id: typeId, matched_keywords: matched as any })
      .eq("id", activeDoc.id);
    
    const detectedTypeObj = docTypes.find(t => t.id === typeId) || null;
    await updateDetectedInfoInNotes(detectedTypeObj, matched);
  };

  /* ---------- OCR FÜR ALLE SEITEN MIT FORTSCHRITT ---------- */
  const runOCRForAllPages = async () => {
    if (!pdfDoc || !activeDoc) { toast.error("Kein PDF geladen"); return; }
    if (pageOrder.length === 0) return;
    setOcrRunning(true);
    setOcrProgressPercent(0);
    setOcrProgress({ current: 0, total: pageOrder.length });
    const newCache: Record<number, WordBlock[]> = {};
    const pageTexts: string[] = [];
    
    for (let i = 0; i < pageOrder.length; i++) {
      const pm = pageOrder[i];
      const pageIdx = pm.idx;
      const currentPercent = Math.round(((i + 1) / pageOrder.length) * 100);
      setOcrProgressPercent(currentPercent);
      
      if (ocrCache[pageIdx]) {
        newCache[pageIdx] = ocrCache[pageIdx];
        pageTexts[i] = ocrCache[pageIdx].map(w => w.text).join(" ");
        setOcrProgress({ current: i + 1, total: pageOrder.length });
        continue;
      }
      const { data: existing } = await supabase
        .from("pdf_pages").select("ocr_blocks")
        .eq("document_id", activeDoc.id).eq("page_index", pageIdx).maybeSingle();
      if (existing && existing.ocr_blocks && (existing.ocr_blocks as any[]).length > 0) {
        const blocks = existing.ocr_blocks as WordBlock[];
        newCache[pageIdx] = blocks;
        pageTexts[i] = blocks.map(w => w.text).join(" ");
        setOcrCache(prev => ({ ...prev, [pageIdx]: blocks }));
        setOcrProgress({ current: i + 1, total: pageOrder.length });
        continue;
      }
      const page = await pdfDoc.getPage(pageIdx + 1);
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: pm.rotation });
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
      await page.render({ canvasContext: tempCanvas.getContext("2d")!, viewport }).promise;
      const words = await performOCRForPage(pageIdx, tempCanvas);
      newCache[pageIdx] = words || [];
      pageTexts[i] = words ? words.map(w => w.text).join(" ") : "";
      if (words) setOcrCache(prev => ({ ...prev, [pageIdx]: words }));
      setOcrProgress({ current: i + 1, total: pageOrder.length });
    }
    setOcrProgressPercent(100);
    setOcrRunning(false);
    setTimeout(() => setOcrProgressPercent(0), 1000);
    
    toast.success(`OCR für ${pageOrder.length} Seiten abgeschlossen`);
    if (activeMeta && newCache[activeMeta.idx]) {
      setWordBlocks(newCache[activeMeta.idx]);
      setPageOcrText(newCache[activeMeta.idx].map(w => w.text).join(" "));
    }
    const allText = Object.values(newCache).flat().map(w => w.text).join(" ");
    const det = detectTypeFromText(allText);
    await persistDetection(det.typeId, det.matched);
    await checkAndSplit(pageTexts);
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

      // 1. Aus Cache laden (wenn bereits in dieser Session geladen)
      if (ocrCache[activeMeta.idx] && ocrCache[activeMeta.idx].length > 0) {
        const cached = ocrCache[activeMeta.idx];
        setWordBlocks(cached);
        setPageOcrText(cached.map(w => w.text).join(" "));
        setOcrDebug({ response: null, error: null, source: "cache" });
        return;
      }
      
      // 2. Aus Datenbank laden (persistierte OCR-Ergebnisse)
      const { data: existing } = await supabase
        .from("pdf_pages")
        .select("ocr_blocks, ocr_text")
        .eq("document_id", activeDoc!.id)
        .eq("page_index", activeMeta.idx)
        .maybeSingle();
        
      if (existing && existing.ocr_blocks && (existing.ocr_blocks as any[]).length > 0) {
        const blocks = existing.ocr_blocks as WordBlock[];
        setWordBlocks(blocks);
        setPageOcrText(existing.ocr_text || blocks.map(w => w.text).join(" "));
        setOcrCache(prev => ({ ...prev, [activeMeta.idx]: blocks }));
        setOcrDebug({ response: null, error: null, source: "database" });
        return;
      }
      
      // 3. Keine OCR-Daten vorhanden
      setOcrDebug({ response: null, error: null, source: "none" });
    };
    run();
  }, [pdfDoc, activePageOrderIdx, activeMeta?.rotation, activeMeta?.idx, activeDoc?.id, ocrCache]);

  const runOCRCurrentPage = async () => {
    if (!pdfDoc || !activeMeta || !canvasRef.current) return;
    setOcrRunning(true);
    setOcrProgressPercent(0);
    try {
      const canvas = canvasRef.current;
      const words = await performOCRForPage(activeMeta.idx, canvas);
      setOcrProgressPercent(100);
      if (words && words.length > 0) {
        setWordBlocks(words);
        setPageOcrText(words.map(w => w.text).join(" "));
        const next = { ...ocrCache, [activeMeta.idx]: words };
        setOcrCache(next);
        toast.success(`${words.length} Wörter erkannt (Seite ${activePageOrderIdx + 1})`);
        
        const allPageTexts: string[] = [];
        for (let i = 0; i < pageOrder.length; i++) {
          const pm = pageOrder[i];
          if (next[pm.idx]) {
            allPageTexts[i] = next[pm.idx].map(w => w.text).join(" ");
          } else if (ocrCache[pm.idx]) {
            allPageTexts[i] = ocrCache[pm.idx].map(w => w.text).join(" ");
          } else {
            allPageTexts[i] = "";
          }
        }
        const allText = allPageTexts.join(" ");
        const det = detectTypeFromText(allText);
        await persistDetection(det.typeId, det.matched);
        await checkAndSplit(allPageTexts);
      } else toast.error("Keine Wörter erkannt");
    } catch (err: any) {
      toast.error("OCR Fehler: " + (err.message || "Unbekannt"));
    } finally {
      setTimeout(() => setOcrProgressPercent(0), 1000);
      setOcrRunning(false);
    }
  };

  /* ---------- UPLOAD / NOTES / EXPORT / INSERT ---------- */
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
        checked_out_by: userId, checked_out_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      toast.success("PDF hochgeladen");
      await loadDocs();
      setActiveDocId(data.id);
    } catch (e: any) {
      toast.error(e.message || "Upload fehlgeschlagen");
    } finally { setUploading(false); }
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

  /* ---------- PROPERTIES (Eigenschaften) MANAGER ---------- */
  const addType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    const { data, error } = await supabase.from("document_types").insert({ 
      name, 
      created_by: userId,
      split_enabled: newTypeSplitEnabled,
      split_regex: newTypeSplitRegex || null
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNewTypeName("");
    setNewTypeSplitRegex("");
    setNewTypeSplitEnabled(false);
    setDocTypes(p => [...p, data as DocType].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedTypeId(data.id);
  };
  
  const renameType = async (id: string, name: string) => {
    setDocTypes(p => p.map(t => t.id === id ? { ...t, name } : t));
    await supabase.from("document_types").update({ name }).eq("id", id);
  };
  
  const deleteType = async (id: string) => {
    if (!confirm("Eigenschaft inkl. Schlagwörter löschen?")) return;
    await supabase.from("document_types").delete().eq("id", id);
    setDocTypes(p => p.filter(t => t.id !== id));
    setKeywords(p => p.filter(k => k.type_id !== id));
    if (selectedTypeId === id) setSelectedTypeId(null);
  };
  
  const addKeyword = async (typeId: string) => {
    const kw = (newKeywordByType[typeId] || "").trim();
    if (!kw) return;
    const { data, error } = await supabase.from("document_type_keywords").insert({ type_id: typeId, keyword: kw }).select().single();
    if (error) { toast.error(error.message); return; }
    setKeywords(p => [...p, data as Keyword]);
    setNewKeywordByType(p => ({ ...p, [typeId]: "" }));
  };
  
  const updateKeyword = async (id: string, keyword: string) => {
    setKeywords(p => p.map(k => k.id === id ? { ...k, keyword } : k));
    await supabase.from("document_type_keywords").update({ keyword }).eq("id", id);
  };
  
  const deleteKeyword = async (id: string) => {
    await supabase.from("document_type_keywords").delete().eq("id", id);
    setKeywords(p => p.filter(k => k.id !== id));
  };

  /* ---------- RENDER ---------- */
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
        </div>

        <div className="flex justify-between items-center">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dokumente"><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
              <TabsTrigger value="eigenschaften"><Settings className="h-4 w-4 mr-1" />Eigenschaften</TabsTrigger>
            </TabsList>
          </Tabs>

          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm" className="h-9">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            PDF hochladen
          </Button>
        </div>

        {/* ===== DOKUMENTE ===== */}
        {tab === "dokumente" && (
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64 sm:w-80">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between w-full h-9 px-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">
                    {activeDoc ? activeDoc.name : "Historie / PDF wählen"}
                  </span>
                  <ChevronUp className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-auto">
                    {docs.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">Keine Dokumente</div>}
                    {myCheckedOutDocs.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/50 border-b">
                          Meine aktiven Dokumente
                        </div>
                        {myCheckedOutDocs.map(d => (
                          <div key={d.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer">
                            <span className="flex-1 text-sm truncate" onClick={() => { selectDocAndPage(d.id, 0); setIsDropdownOpen(false); }}>
                              {d.name}
                            </span>
                            <button onClick={(e) => releaseDoc(d.id, e)} className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Dokument zurücklegen">
                              <Undo2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                    {otherDocs.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/50 border-t border-b">
                          Andere Dokumente
                        </div>
                        {otherDocs.map(d => (
                          <div key={d.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer">
                            <span className="flex-1 text-sm truncate" onClick={() => { selectDocAndPage(d.id, 0); setIsDropdownOpen(false); }}>
                              {d.name}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {activeDoc && (
                <>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => releaseDoc(activeDoc.id)}>
                    <Undo2 className="h-4 w-4 mr-1" />Zurücklegen
                  </Button>
                  <Button variant="outline" onClick={exportEdited} size="sm" className="h-9">
                    <Download className="h-4 w-4 mr-1" />Export
                  </Button>
                  <Button variant="destructive" size="icon" onClick={deleteDoc} className="h-9 w-9">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Navigationsleiste oberhalb der Spalten */}
            {activeDoc && pageOrder.length > 0 && (
              <Card className="p-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-2">Seite {activePageOrderIdx + 1} / {pageOrder.length}</span>
                  <div className="h-4 w-px bg-border mx-1" />
                  <Button variant="ghost" size="sm" onClick={movePageUp} disabled={activePageOrderIdx === 0} className="h-7 px-2">
                    <MoveUp className="h-3.5 w-3.5 mr-1" /> Nach oben
                  </Button>
                  <Button variant="ghost" size="sm" onClick={movePageDown} disabled={activePageOrderIdx === pageOrder.length - 1} className="h-7 px-2">
                    <MoveDown className="h-3.5 w-3.5 mr-1" /> Nach unten
                  </Button>
                  <div className="h-4 w-px bg-border mx-1" />
                  <Button variant="ghost" size="sm" onClick={rotateCurrentPage} className="h-7 px-2">
                    <RotateCw className="h-3.5 w-3.5 mr-1" /> Drehen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deleteCurrentPage} className="h-7 px-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschen
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={manualSplitAtCurrentPage} className="h-7 px-2">
                    <Scissors className="h-3.5 w-3.5 mr-1" /> Hier trennen
                  </Button>
                  <Button variant="default" size="sm" onClick={runOCRForAllPages} disabled={ocrRunning} className="h-7 px-2">
                    {ocrRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    OCR alle Seiten
                  </Button>
                </div>
              </Card>
            )}

            {/* DREI SPALTEN */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[320px_1fr_1fr] gap-4">
              {/* Linke Spalte - Seiten (aktive Dokumente) */}
              <Card className="p-3 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="text-[10px] font-bold uppercase text-muted-foreground px-1 mb-1">Seiten (aktive Dokumente)</div>
                
                {/* Fortschrittsbalken während OCR */}
                {ocrRunning && ocrProgressPercent > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>OCR Fortschritt</span>
                      <span>{ocrProgressPercent}%</span>
                    </div>
                    <Progress value={ocrProgressPercent} className="h-1.5" />
                  </div>
                )}
                
                {splitInfo && activeDoc && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded text-xs">
                    <div className="font-medium">Trennpunkt gefunden!</div>
                    <div className="text-[10px] truncate">"{splitInfo.match}" auf Seite {splitInfo.pageIndex + 1}</div>
                    <Button size="sm" className="mt-1 h-6 text-[10px]" onClick={() => performSplit(splitInfo)}>
                      <Scissors className="h-3 w-3 mr-1" /> Jetzt trennen
                    </Button>
                  </div>
                )}
                
                {myCheckedOutDocs.length === 0 ? (
                  <div className="border rounded p-3 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Keine aktiven Dokumente</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="mt-2 h-7 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                ) : (
                  myCheckedOutDocs.map((doc) => {
                    const docThumbs = allPagesThumbs[doc.id] || {};
                    const isActive = activeDocId === doc.id;
                    
                    return (
                      <div key={doc.id} className="space-y-2">
                        <div className={`text-[10px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded flex items-center justify-between ${
                          isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted/30'
                        }`}>
                          <span>{doc.name}</span>
                          {doc.checked_out_by === userId && (
                            <button onClick={(e) => { e.stopPropagation(); releaseDoc(doc.id, e); }} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Dokument zurücklegen">
                              <Undo2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-1.5">
                          {doc.page_order.map((pm, pageIdx) => {
                            const thumb = docThumbs[pm.idx];
                            const isCurrentPage = isActive && activePageOrderIdx === pageIdx;
                            
                            return (
                              <div
                                key={`${doc.id}-${pageIdx}`}
                                onClick={() => selectDocAndPage(doc.id, pageIdx)}
                                className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-all ${
                                  isCurrentPage ? 'bg-primary/10 border border-primary' : 'hover:bg-muted/50 border border-transparent'
                                }`}
                              >
                                <div className="w-10 h-12 bg-muted rounded flex items-center justify-center overflow-hidden">
                                  {thumb ? (
                                    <img src={thumb} alt={`Seite ${pageIdx + 1}`} className="w-full h-full object-contain" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs font-medium">Seite {pageIdx + 1}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {pm.rotation !== 0 ? `Gedreht (${pm.rotation}°)` : 'Normal'}
                                  </div>
                                </div>
                                {isCurrentPage && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>

              {/* Mittlere Spalte - Editor */}
              <Card className="p-4 flex flex-col">
                <div className="mb-3 p-2 bg-muted/50 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Dokumenttyp</div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold">
                      {detectedType ? detectedType.name : (activeDoc ? "Nicht erkannt" : "Kein Dokument ausgewählt")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <Input 
                    value={activeDoc?.name || ""} 
                    className="h-7 text-sm font-bold border-0 px-1 flex-1" 
                    placeholder="Kein Dokument ausgewählt"
                    disabled={!activeDoc}
                    onChange={async e => {
                      if (!activeDoc) return;
                      setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, name: e.target.value } : d));
                      await supabase.from("pdf_documents").update({ name: e.target.value }).eq("id", activeDoc.id);
                    }} 
                  />
                </div>
                <Textarea 
                  ref={textareaRef} 
                  value={notes} 
                  onChange={e => saveNotes(e.target.value)} 
                  className="flex-1 min-h-[200px] font-mono text-sm" 
                  placeholder={activeDoc ? "Erkannter Text wird hier eingefügt..." : "Wählen Sie ein Dokument aus, um OCR durchzuführen..."}
                  disabled={!activeDoc}
                />
                <div className="text-[10px] text-muted-foreground mt-1">Klicke auf ein erkanntes Wort in der Vorschau, um es einzufügen.</div>
              </Card>

              {/* Rechte Spalte - Vorschau */}
              <Card className="p-2 overflow-auto bg-muted/30 relative flex items-center justify-center min-h-[300px]">
                {activeDoc ? (
                  <div className="relative inline-block max-w-full">
                    <canvas ref={canvasRef} className="block max-w-full h-auto shadow-md" />
                    {wordBlocks.map((word, i) => (
                      <button key={i} onClick={() => insertAtCursor(word.text)} title={word.text}
                        className="absolute border border-blue-400/60 bg-blue-500/10 hover:bg-blue-500/30 transition-colors cursor-pointer rounded-sm"
                        style={{ left: `${word.x * 100}%`, top: `${word.y * 100}%`, width: `${word.w * 100}%`, height: `${word.h * 100}%` }} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Keine Vorschau verfügbar</p>
                    <p className="text-xs mt-1">Wählen Sie ein Dokument aus der Liste aus</p>
                  </div>
                )}
                {(ocrDebug.response || ocrDebug.error || ocrDebug.source) && activeDoc && (
                  <div className="absolute bottom-2 left-2 right-2 mt-2 p-2 bg-muted rounded text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">🔍 OCR Debug</span>
                      <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="h-5 px-1">
                        {showDebug ? "Weniger" : "Mehr"} <Bug className="h-2.5 w-2.5 ml-0.5" />
                      </Button>
                    </div>
                    <div className="mt-0.5">Quelle: <span className="font-mono">{ocrDebug.source || "?"}</span></div>
                    {ocrDebug.error && <div className="text-destructive mt-0.5">❌ {ocrDebug.error}</div>}
                    {showDebug && ocrDebug.response && (
                      <pre className="mt-1 overflow-auto max-h-40 bg-foreground text-background p-1.5 rounded text-[9px]">{JSON.stringify(ocrDebug.response, null, 2)}</pre>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ===== EIGENSCHAFTEN ===== */}
        {tab === "eigenschaften" && (
          <div className="space-y-4 mt-4">
            <Card className="p-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input 
                    placeholder="Neuer Dokumenttyp (z.B. Rechnung) - Regex möglich" 
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addType()} 
                  />
                </div>
                <Button onClick={addType}><Plus className="h-4 w-4 mr-1" />Anlegen</Button>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Dokumenttypen</h3>
                {docTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Noch keine Dokumenttypen angelegt.</p>
                )}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {docTypes.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTypeId(t.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        selectedTypeId === t.id 
                          ? 'bg-primary/10 border border-primary' 
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <span className="font-medium">{t.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); renameType(t.id, prompt("Neuer Name:", t.name) || t.name); }}
                          className="p-1 rounded hover:bg-muted"
                          title="Umbenennen"
                        >
                          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteType(t.id); }}
                          className="p-1 rounded hover:bg-destructive/10"
                          title="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold">
                    {selectedType ? `Schlagwörter für "${selectedType.name}"` : "Schlagwörter"}
                  </h3>
                  {selectedType && (
                    <div className="text-[10px] text-muted-foreground">Regex wird automatisch erkannt</div>
                  )}
                </div>
                
                {!selectedType ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Wählen Sie links einen Dokumenttyp aus.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
                      {selectedKeywords.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine Schlagwörter vorhanden.</p>
                      ) : (
                        selectedKeywords.map(k => (
                          <div key={k.id} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                            <Input
                              value={k.keyword}
                              onChange={e => updateKeyword(k.id, e.target.value)}
                              className="flex-1 h-8 text-sm font-mono"
                              placeholder="Regex oder Text"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteKeyword(k.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Schlagwort / Regex hinzufügen"
                        value={newKeywordByType[selectedType.id] || ""}
                        onChange={e => setNewKeywordByType(p => ({ ...p, [selectedType.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addKeyword(selectedType.id)}
                        className="flex-1 h-8 text-sm font-mono"
                      />
                      <Button size="sm" onClick={() => addKeyword(selectedType.id)} className="h-8">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Hinzufügen
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* Bereich 2: Dokumententrennung */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Scissors className="h-4 w-4" /> Dokumententrennung
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="globalSplit" 
                    checked={globalSplitEnabled}
                    onCheckedChange={(checked) => setGlobalSplitEnabled(checked as boolean)}
                  />
                  <Label htmlFor="globalSplit">Dokumente automatisch trennen (global)</Label>
                </div>
                {globalSplitEnabled && (
                  <div className="ml-6">
                    <Label htmlFor="globalSplitRegex" className="text-xs">Trenn-Regex (global)</Label>
                    <Input
                      id="globalSplitRegex"
                      placeholder="z.B. ^--- Seite \d+ ---$ oder -----\\s*SEITE\\s*\\d+\\s*-----"
                      value={globalSplitRegex}
                      onChange={e => setGlobalSplitRegex(e.target.value)}
                      className="mt-1 font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Der Regex wird im gesamten Dokument gesucht. Bei einem Match wird das Dokument getrennt.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-3 border-t">
                <div className="text-xs font-medium mb-2">Typspezifische Trennung</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {docTypes.map(t => (
                    <div key={t.id} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                      <Checkbox 
                        id={`split-${t.id}`}
                        checked={t.split_enabled || false}
                        onCheckedChange={(checked) => saveTypeSplitSettings(t.id, checked as boolean, t.split_regex || "")}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`split-${t.id}`} className="text-sm font-medium">{t.name}</Label>
                        {t.split_enabled && (
                          <Input
                            placeholder="Trenn-Regex für diesen Typ"
                            value={t.split_regex || ""}
                            onChange={e => saveTypeSplitSettings(t.id, true, e.target.value)}
                            className="mt-1 h-7 font-mono text-xs"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AIPage;
