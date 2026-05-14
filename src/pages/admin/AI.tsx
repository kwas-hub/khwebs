import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, RotateCw, Trash2, ChevronUp, ChevronDown, Sparkles, Download, FileText, Bug, Undo2, Plus, Settings, Scissors, MoveUp, MoveDown, Wand2, Tags, GitMerge, Search, MessageSquare, Scale, ListTree } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminFormRow,
  AdminFieldGroup,
  AdminDivider,
} from "@/components/admin";
import { AIChatSidebar } from "@/components/admin/AIChatSidebar";
import { AIConfigTab } from "@/components/admin/AIConfigTab";
import { invokeAiTenant } from "@/lib/aiTenantEdge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// PDF.js Worker Konfiguration
const pdfWorkerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
);
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl.toString();

type Doc = {
  id: string; name: string; storage_path: string; page_order: PageMeta[]; notes: string;
  created_at: string; checked_out_by: string | null;
  detected_type_id: string | null; matched_keywords: string[];
  tenant_id?: string;
};
type PageMeta = { idx: number; rotation: number };
type WordBlock = { text: string; x: number; y: number; w: number; h: number };
type DocType = { id: string; name: string; split_enabled?: boolean; split_regex?: string; tenant_id?: string };
type Keyword = { id: string; type_id: string; keyword: string; tenant_id?: string };
type SplitInfo = { pageIndex: number; match: string; position: number };

const RENDER_SCALE = 1.4;
const PAGE_THUMB_SCALE = 0.15;

const AIPage = () => {
  const { userId } = useAuth();
  const { currentTenant, isTenantAdmin, loading: tenantLoading } = useTenant();
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
  const [ocrStatusText, setOcrStatusText] = useState("");
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

  const [aiEnabled, setAiEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [nerOpen, setNerOpen] = useState(false);
  const [nerData, setNerData] = useState<Record<string, unknown> | null>(null);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarRows, setSimilarRows] = useState<{ document_id: string; document_name: string; score: number }[]>([]);
  const [discOpen, setDiscOpen] = useState(false);
  const [discExpected, setDiscExpected] = useState('{\n  "Betrag": "100.00",\n  "Lieferant": "Beispiel GmbH"\n}');

  // Refs für Cleanup
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pdfDocRef = useRef<any>(null);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeDoc = docs.find(d => d.id === activeDocId) || null;
  const pageOrder: PageMeta[] = activeDoc?.page_order || [];
  const activeMeta = pageOrder[activePageOrderIdx];
  const detectedType = useMemo(() => docTypes.find(t => t.id === activeDoc?.detected_type_id) || null, [docTypes, activeDoc?.detected_type_id]);
  const selectedType = useMemo(() => docTypes.find(t => t.id === selectedTypeId) || null, [docTypes, selectedTypeId]);
  const selectedKeywords = useMemo(() => keywords.filter(k => k.type_id === selectedTypeId), [keywords, selectedTypeId]);

  // Meine ausgecheckten Dokumente (nur Current Tenant)
  const myCheckedOutDocs = useMemo(() => docs.filter(d => d.checked_out_by === userId && d.tenant_id === currentTenant?.id), [docs, userId, currentTenant?.id]);
  // Andere Dokumente (nicht vom aktuellen User ausgecheckt, gleicher Tenant)
  const otherDocs = useMemo(() => docs.filter(d => d.checked_out_by !== userId && d.tenant_id === currentTenant?.id), [docs, userId, currentTenant?.id]);

  // PDF Doc ref aktualisieren
  useEffect(() => {
    pdfDocRef.current = pdfDoc;
  }, [pdfDoc]);

  /* ---------- LOAD ---------- */
  const loadDocs = useCallback(async () => {
    if (!userId || !currentTenant?.id) {
      setDocs([]);
      return;
    }
    
    const { data, error } = await supabase
      .from("pdf_documents")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Dokumente konnten nicht geladen werden");
      return;
    }
    
    setDocs(((data ?? []) as any[]).map(d => ({ ...d, matched_keywords: d.matched_keywords ?? [] })) as Doc[]);
  }, [userId, currentTenant?.id]);
  
  const loadTypes = useCallback(async () => {
    if (!currentTenant?.id) {
      setDocTypes([]);
      setKeywords([]);
      return;
    }
    
    const [t, k] = await Promise.all([
      supabase.from("document_types").select("*").eq("tenant_id", currentTenant.id).order("name"),
      supabase.from("document_type_keywords").select("*").eq("tenant_id", currentTenant.id).order("keyword")
    ]);
    
    setDocTypes((t.data ?? []) as DocType[]);
    setKeywords((k.data ?? []) as Keyword[]);
  }, [currentTenant?.id]);

  const loadAiStatus = useCallback(async () => {
    if (!currentTenant?.id) {
      setAiEnabled(false);
      return;
    }
    try {
      const res = await invokeAiTenant<{ active?: boolean }>({
        action: "ai-status",
        tenant_id: currentTenant.id,
      });
      setAiEnabled(!!res.active);
    } catch {
      setAiEnabled(false);
    }
  }, [currentTenant?.id]);

  const reindexDocument = useCallback(
    async (documentId: string) => {
      if (!currentTenant?.id) return;
      try {
        await invokeAiTenant({
          action: "reindex-document",
          tenant_id: currentTenant.id,
          document_id: documentId,
        });
      } catch (e) {
        console.warn("Embedding-Indexierung:", e);
      }
    },
    [currentTenant?.id],
  );
  
  useEffect(() => { 
    if (currentTenant?.id) {
      loadDocs(); 
      loadTypes();
      loadAiStatus();
    }
  }, [loadDocs, loadTypes, loadAiStatus, currentTenant?.id]);

  // Thumbnails für alle Seiten aller aktiven Dokumente laden
  useEffect(() => {
    const loadAllPageThumbnails = async () => {
      if (!userId || !currentTenant?.id) return;
      const newThumbs: Record<string, Record<number, string>> = {};
      
      for (const doc of myCheckedOutDocs) {
        try {
          const { data, error } = await supabase.storage.from("pdfs").download(doc.storage_path);
          if (error || !data) continue;
          const buf = await data.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          const out: Record<number, string> = {};
          const order: PageMeta[] = doc.page_order;
          for (let i = 0; i < order.length; i++) {
            const pm = order[i];
            try {
              const page = await pdf.getPage(pm.idx + 1);
              const vp = page.getViewport({ scale: PAGE_THUMB_SCALE, rotation: pm.rotation });
              const canvas = document.createElement("canvas");
              canvas.width = vp.width;
              canvas.height = vp.height;
              await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp } as any).promise;
              out[pm.idx] = canvas.toDataURL("image/jpeg", 0.5);
              canvas.remove();
            } catch (e) { /* ignore */ }
          }
          newThumbs[doc.id] = out;
        } catch (err) {
          console.warn(`Fehler beim Laden von Thumbnails für ${doc.name}:`, err);
        }
      }
      setAllPagesThumbs(newThumbs);
    };
    
    loadAllPageThumbnails();
  }, [myCheckedOutDocs, userId, currentTenant?.id]);

  // Funktion zum Auswählen eines Dokuments und einer bestimmten Seite
  const selectDocAndPage = async (docId: string, pageIdx: number) => {
    if (!currentTenant?.id) {
      toast.error("Kein Mandant ausgewählt");
      return;
    }
    
    setActiveDocId(docId);
    setActivePageOrderIdx(pageIdx);
    if (!userId) return;
    const d = docs.find(x => x.id === docId);
    if (!d) return;
    
    if (d.tenant_id !== currentTenant.id) {
      toast.error("Sie haben keinen Zugriff auf dieses Dokument");
      return;
    }
    
    if (d.checked_out_by !== userId) {
      await supabase.from("pdf_documents")
        .update({ checked_out_by: userId, checked_out_at: new Date().toISOString() })
        .eq("id", docId)
        .eq("tenant_id", currentTenant.id);
      setDocs(p => p.map(x => x.id === docId ? { ...x, checked_out_by: userId } : x));
    }
    setNotes(d.notes || "");
    setSplitInfo(null);
  };
  
  const releaseDoc = async (docId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (!currentTenant?.id) return;
    
    await supabase.from("pdf_documents")
      .update({ checked_out_by: null, checked_out_at: null })
      .eq("id", docId)
      .eq("tenant_id", currentTenant.id);
    toast.success("Dokument zurückgelegt");
    if (activeDocId === docId) {
      setActiveDocId(null);
      setPdfDoc(null);
    }
    loadDocs();
  };

  const saveTypeSplitSettings = async (typeId: string, splitEnabled: boolean, splitRegex: string) => {
    if (!currentTenant?.id) return;
    
    setDocTypes(p => p.map(t => t.id === typeId ? { ...t, split_enabled: splitEnabled, split_regex: splitRegex } : t));
    await supabase.from("document_types").update({ 
      split_enabled: splitEnabled, 
      split_regex: splitRegex 
    }).eq("id", typeId)
      .eq("tenant_id", currentTenant.id);
  };

  const updateDetectedInfoInNotes = async (type: DocType | null, matchedKw: string[]) => {
    if (!activeDoc || !currentTenant?.id) return;
    const header = `=== Dokumenttyp: ${type?.name || "Kein Typ erkannt"} ===\n`;
    const keywordsLine = `Erkannte Schlagwörter: ${matchedKw.join(", ") || "Keine"}\n`;
    const separator = "=".repeat(40) + "\n\n";
    
    const newContent = header + keywordsLine + separator + (activeDoc.notes || "");
    setNotes(newContent);
    await supabase.from("pdf_documents").update({ notes: newContent }).eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);
  };

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

  const performSplit = async (split: SplitInfo) => {
    if (!activeDoc || !pdfDoc || !currentTenant?.id || !userId) return;
    
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
      
      const payload = {
        owner_id: userId,
        name: "",
        storage_path: activeDoc.storage_path,
        page_order: [] as any,
        notes: "",
        checked_out_by: userId,
        checked_out_at: new Date().toISOString(),
        detected_type_id: activeDoc.detected_type_id,
        matched_keywords: activeDoc.matched_keywords,
        tenant_id: currentTenant.id,
      };
      
      const { data: newDoc1, error: err1 } = await supabase.from("pdf_documents").insert(payload).select().single();
      if (err1) throw err1;
      
      const { error: updateErr1 } = await supabase.from("pdf_documents")
        .update({ name: newDoc1Name, page_order: firstPartPages, notes: `Getrennt von ${activeDoc.name} (Teil 1)` })
        .eq("id", newDoc1.id);
      if (updateErr1) throw updateErr1;
      
      const { data: newDoc2, error: err2 } = await supabase.from("pdf_documents").insert(payload).select().single();
      if (err2) throw err2;
      
      const { error: updateErr2 } = await supabase.from("pdf_documents")
        .update({ name: newDoc2Name, page_order: secondPartPages, notes: `Getrennt von ${activeDoc.name} (Teil 2)` })
        .eq("id", newDoc2.id);
      if (updateErr2) throw updateErr2;
      
      await supabase.from("pdf_documents").delete().eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);
      
      toast.success(`Dokument getrennt: "${newDoc1Name}" und "${newDoc2Name}"`, { id: "split" });
      
      await loadDocs();
      setActiveDocId(newDoc1.id);
      setSplitInfo(null);
      
    } catch (error: any) {
      console.error("Split error:", error);
      toast.error(`Fehler beim Trennen: ${error.message}`, { id: "split" });
    }
  };

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
      if (!activeDoc || !currentTenant?.id) { 
        setPdfDoc(null); 
        return; 
      }
      
      setNotes(activeDoc.notes || "");
      setActivePageOrderIdx(0);
      setThumbs({});
      setOcrCache({});
      setSplitInfo(null);
      
      const { data, error } = await supabase.storage.from("pdfs").download(activeDoc.storage_path);
      if (error || !data) { 
        toast.error("Download fehlgeschlagen"); 
        return; 
      }
      
      const buf = await data.arrayBuffer();
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        setPdfDoc(pdf);
      } catch (err) {
        console.error("PDF Laden fehlgeschlagen:", err);
        toast.error("PDF konnte nicht geladen werden");
      }
    };
    run();
  }, [activeDoc?.id, currentTenant?.id]);

  /* ---------- THUMBNAILS ---------- */
  useEffect(() => {
    if (!pdfDoc || pageOrder.length === 0 || !canvasRef.current) return;
    let cancelled = false;
    
    const run = async () => {
      const out: Record<number, string> = {};
      for (const pm of pageOrder) {
        if (cancelled) return;
        if (out[pm.idx] !== undefined) continue;
        try {
          const page = await pdfDoc.getPage(pm.idx + 1);
          const vp = page.getViewport({ scale: 0.25, rotation: pm.rotation });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          out[pm.idx] = canvas.toDataURL("image/jpeg", 0.5);
          canvas.remove();
        } catch (e) { /* ignore */ }
      }
      if (!cancelled) setThumbs(out);
    };
    run();
    return () => { cancelled = true; };
  }, [pdfDoc, pageOrder]);

  /* ---------- SEITEN AKTIONEN ---------- */
  const rotateCurrentPage = () => {
    if (!activeDoc || !currentTenant?.id) return;
    const next = pageOrder.map((p, idx) => idx === activePageOrderIdx ? { ...p, rotation: (p.rotation + 90) % 360 } : p);
    persistOrder(next, activePageOrderIdx);
  };
  
  const deleteCurrentPage = async () => {
    if (!activeDoc || pageOrder.length <= 1 || !currentTenant?.id) {
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
    if (!activeDoc || !currentTenant?.id) return;
    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, page_order: newOrder } : d));
    if (focusIdx !== undefined) setActivePageOrderIdx(Math.max(0, Math.min(focusIdx, newOrder.length - 1)));
    await supabase.from("pdf_documents").update({ page_order: newOrder as any }).eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);
    setThumbs({});
  };

  const convertServerOCRToWordBlocks = (ocrResult: any, canvasWidth: number, canvasHeight: number): WordBlock[] => {
    const arr = (ocrResult?.words ?? ocrResult?.blocks) as any[] | undefined;
    if (!arr || !Array.isArray(arr)) return [];
    
    const out: WordBlock[] = [];
    for (const b of arr) {
      const text = (b?.text ?? "").toString().trim();
      const bbox = b?.bbox;
      if (!text || !bbox) continue;
      
      out.push({
        text: text,
        x: bbox.x,
        y: bbox.y,
        w: bbox.w,
        h: bbox.h,
      });
    }
    return out;
  };

  const performOCRForPage = async (pageIndex: number, canvasElement: HTMLCanvasElement): Promise<WordBlock[] | null> => {
    if (!activeDoc || !currentTenant?.id) return null;
    
    try {
      const imageDataUrl = canvasElement.toDataURL("image/jpeg", 0.85);
      const { data, error } = await supabase.functions.invoke("pdf-ocr", { body: { imageDataUrl } });
      if (error) throw error;
      
      const words = convertServerOCRToWordBlocks(data, canvasElement.width, canvasElement.height);
      if (words && words.length > 0) {
        await supabase
          .from("pdf_pages")
          .delete()
          .eq("document_id", activeDoc.id)
          .eq("page_index", pageIndex);
        
        const insertPayload: any = {
          document_id: activeDoc.id, 
          page_index: pageIndex,
          ocr_text: words.map(w => w.text).join(" "), 
          ocr_blocks: words as any,
          tenant_id: currentTenant.id,
        };
        
        await supabase.from("pdf_pages").insert(insertPayload);
        return words;
      }
      return [];
    } catch (err) {
      console.error(`OCR Fehler Seite ${pageIndex + 1}:`, err);
      return null;
    }
  };

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
    if (!activeDoc || !currentTenant?.id) return;
    setDocs(p => p.map(d => d.id === activeDoc.id ? { ...d, detected_type_id: typeId, matched_keywords: matched } : d));
    await supabase.from("pdf_documents")
      .update({ detected_type_id: typeId, matched_keywords: matched as any })
      .eq("id", activeDoc.id)
      .eq("tenant_id", currentTenant.id);
    
    const detectedTypeObj = docTypes.find(t => t.id === typeId) || null;
    await updateDetectedInfoInNotes(detectedTypeObj, matched);
  };

  const runOCRForDocument = async (document: Doc, pdfDocument: any) => {
    if (!currentTenant?.id) return;
    
    const order: PageMeta[] = document.page_order;
    if (order.length === 0) return;
    
    setOcrRunning(true);
    setOcrProgressPercent(0);
    setOcrStatusText(`Starte OCR für ${document.name}...`);
    
    const newCache: Record<number, WordBlock[]> = {};
    const pageTexts: string[] = [];
    
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
    }
    ocrAbortControllerRef.current = new AbortController();
    
    let simulatedProgress = 0;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      if (simulatedProgress < 90) {
        simulatedProgress += Math.random() * 5;
        setOcrProgressPercent(Math.min(90, Math.floor(simulatedProgress)));
      }
    }, 500);
    
    for (let i = 0; i < order.length; i++) {
      if (ocrAbortControllerRef.current?.signal.aborted) break;
      
      const pm = order[i];
      const pageIdx = pm.idx;
      setOcrStatusText(`OCR Seite ${i + 1} von ${order.length}...`);
      
      let tempCanvas: HTMLCanvasElement | null = null;
      try {
        const page = await pdfDocument.getPage(pageIdx + 1);
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: pm.rotation });
        tempCanvas = document.createElement("canvas");
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        await page.render({ canvas: tempCanvas, canvasContext: tempCanvas.getContext("2d")!, viewport } as any).promise;
        
        const imageDataUrl = tempCanvas.toDataURL("image/jpeg", 0.85);
        const { data, error } = await supabase.functions.invoke("pdf-ocr", { body: { imageDataUrl } });
        
        if (error) throw error;
        
        const words = convertServerOCRToWordBlocks(data, viewport.width, viewport.height);
        if (words && words.length > 0) {
          newCache[pageIdx] = words;
          pageTexts[i] = words.map(w => w.text).join(" ");
          
          await supabase.from("pdf_pages").delete().eq("document_id", document.id).eq("page_index", pageIdx);
          
          const insertPayload: any = {
            document_id: document.id, page_index: pageIdx,
            ocr_text: words.map(w => w.text).join(" "), 
            ocr_blocks: words as any,
            tenant_id: currentTenant.id,
          };
          
          await supabase.from("pdf_pages").insert(insertPayload);
        }
      } catch (err) {
        console.error(`Fehler bei Seite ${pageIdx + 1}:`, err);
      } finally {
        if (tempCanvas) tempCanvas.remove();
      }
    }
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    setOcrProgressPercent(100);
    setOcrStatusText("OCR abgeschlossen!");
    setOcrRunning(false);
    
    const allText = Object.values(newCache).flat().map(w => w.text).join(" ");
    const det = detectTypeFromText(allText);
    
    setDocs(prev => prev.map(d => d.id === document.id ? { ...d, detected_type_id: det.typeId, matched_keywords: det.matched } : d));
    await supabase.from("pdf_documents")
      .update({ detected_type_id: det.typeId, matched_keywords: det.matched as any })
      .eq("id", document.id)
      .eq("tenant_id", currentTenant.id);
    
    toast.success(`OCR für ${document.name} abgeschlossen`);
    await reindexDocument(document.id);
  };

  const runOCRForAllPages = async () => {
    if (!pdfDoc || !activeDoc || !currentTenant?.id) { 
      toast.error("Kein PDF geladen"); 
      return; 
    }
    await runOCRForDocument(activeDoc, pdfDoc);
  };

  useEffect(() => {
    const run = async () => {
      if (!pdfDoc || !activeMeta || !canvasRef.current || !activeDoc || !currentTenant?.id) return;
      setWordBlocks([]);
      setPageOcrText("");
      
      try {
        const page = await pdfDoc.getPage(activeMeta.idx + 1);
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: activeMeta.rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setRenderedSize({ w: viewport.width, h: viewport.height });
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (ocrCache[activeMeta.idx] && ocrCache[activeMeta.idx].length > 0) {
          const cached = ocrCache[activeMeta.idx];
          setWordBlocks(cached);
          setPageOcrText(cached.map(w => w.text).join(" "));
          return;
        }
        
        const { data: existing } = await supabase
          .from("pdf_pages")
          .select("ocr_blocks, ocr_text")
          .eq("document_id", activeDoc.id)
          .eq("page_index", activeMeta.idx)
          .eq("tenant_id", currentTenant.id)
          .maybeSingle();
          
        if (existing && existing.ocr_blocks && (existing.ocr_blocks as any[]).length > 0) {
          const blocks = existing.ocr_blocks as WordBlock[];
          setWordBlocks(blocks);
          setPageOcrText(existing.ocr_text || blocks.map(w => w.text).join(" "));
          setOcrCache(prev => ({ ...prev, [activeMeta.idx]: blocks }));
        }
      } catch (err) {
        console.error("Fehler beim Rendern der Seite:", err);
      }
    };
    run();
  }, [pdfDoc, activePageOrderIdx, activeMeta?.rotation, activeMeta?.idx, activeDoc?.id, ocrCache, currentTenant?.id]);

  const handleUpload = async (file: File) => {
    if (!userId || !currentTenant?.id) {
      toast.error("Kein Mandant ausgewählt");
      return;
    }
    if (file.type !== "application/pdf") { toast.error("Nur PDF-Dateien"); return; }
    setUploading(true);
    try {
      const path = `${currentTenant.id}/${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file);
      if (upErr) throw upErr;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const order: PageMeta[] = Array.from({ length: pdf.numPages }, (_, i) => ({ idx: i, rotation: 0 }));
      
      const insertPayload: any = {
        owner_id: userId,
        name: file.name,
        storage_path: path,
        page_order: order as any,
        notes: "",
        checked_out_by: userId,
        checked_out_at: new Date().toISOString(),
        tenant_id: currentTenant.id,
      };
      
      const { data, error } = await supabase.from("pdf_documents").insert(insertPayload).select().single();
      if (error) throw error;
      toast.success("PDF hochgeladen");
      await loadDocs();
      setActiveDocId(data.id);
      
      setTimeout(async () => {
        const newDoc = data as unknown as Doc;
        const { data: storageData } = await supabase.storage.from("pdfs").download(path);
        if (storageData) {
          const newBuf = await storageData.arrayBuffer();
          const pdfDocForOCR = await pdfjsLib.getDocument({ data: newBuf }).promise;
          await runOCRForDocument(newDoc, pdfDocForOCR);
        }
      }, 500);
      
    } catch (e: any) {
      toast.error(e.message || "Upload fehlgeschlagen");
    } finally { setUploading(false); }
  };

  const saveNotes = async (v: string) => {
    setNotes(v);
    if (!activeDoc || !currentTenant?.id) return;
    await supabase.from("pdf_documents").update({ notes: v }).eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);
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
  };
  
  const deleteDoc = async () => {
    if (!activeDoc || !currentTenant?.id || !confirm("Dokument wirklich löschen?")) return;
    await supabase.storage.from("pdfs").remove([activeDoc.storage_path]);
    await supabase.from("pdf_documents").delete().eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);
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
        c.remove();
      }
      pdf.save(`${activeDoc.name.replace(/\.pdf$/i, "")}-bearbeitet.pdf`);
      toast.success("Export fertig", { id: "exp" });
    } catch (e: any) {
      toast.error("Fehler: " + e.message, { id: "exp" });
    }
  };

  const addType = async () => {
    if (!userId || !currentTenant?.id) {
      toast.error("Kein Mandant ausgewählt");
      return;
    }
    const name = newTypeName.trim();
    if (!name) return;
    const { data, error } = await supabase.from("document_types").insert({ 
      name, created_by: userId, split_enabled: newTypeSplitEnabled,
      split_regex: newTypeSplitRegex || null, tenant_id: currentTenant.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNewTypeName(""); setNewTypeSplitRegex(""); setNewTypeSplitEnabled(false);
    setDocTypes(p => [...p, data as DocType].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedTypeId(data.id);
  };
  
  const renameType = async (id: string, name: string) => {
    if (!currentTenant?.id) return;
    setDocTypes(p => p.map(t => t.id === id ? { ...t, name } : t));
    await supabase.from("document_types").update({ name }).eq("id", id).eq("tenant_id", currentTenant.id);
  };
  
  const deleteType = async (id: string) => {
    if (!currentTenant?.id || !confirm("Eigenschaft inkl. Schlagwörter löschen?")) return;
    await supabase.from("document_types").delete().eq("id", id).eq("tenant_id", currentTenant.id);
    setDocTypes(p => p.filter(t => t.id !== id));
    setKeywords(p => p.filter(k => k.type_id !== id));
    if (selectedTypeId === id) setSelectedTypeId(null);
  };
  
  const addKeyword = async (typeId: string) => {
    if (!currentTenant?.id) return;
    const kw = (newKeywordByType[typeId] || "").trim();
    if (!kw) return;
    const { data, error } = await supabase.from("document_type_keywords").insert({ 
      type_id: typeId, keyword: kw, tenant_id: currentTenant.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setKeywords(p => [...p, data as Keyword]);
    setNewKeywordByType(p => ({ ...p, [typeId]: "" }));
  };
  
  const updateKeyword = async (id: string, keyword: string) => {
    if (!currentTenant?.id) return;
    setKeywords(p => p.map(k => k.id === id ? { ...k, keyword } : k));
    await supabase.from("document_type_keywords").update({ keyword }).eq("id", id).eq("tenant_id", currentTenant.id);
  };
  
  const deleteKeyword = async (id: string) => {
    if (!currentTenant?.id) return;
    await supabase.from("document_type_keywords").delete().eq("id", id).eq("tenant_id", currentTenant.id);
    setKeywords(p => p.filter(k => k.id !== id));
  };

  const runDocumentAnalyze = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) {
      toast.error("KI nicht verfügbar oder kein Dokument");
      return;
    }
    setAiBusy("analyze");
    try {
      const cls = await invokeAiTenant<{ result?: { type_id?: string | null; keywords?: string[] } }>({
        action: "classify-document",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      const r = cls.result;
      const typeId = r?.type_id && docTypes.some(t => t.id === r.type_id) ? r.type_id : null;
      const kws = Array.isArray(r?.keywords) ? r.keywords : [];
      await persistDetection(typeId, kws);

      const sum = await invokeAiTenant<{ summary?: string }>({
        action: "summarize",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      const block = `\n\n=== KI-Zusammenfassung ===\n${(sum.summary ?? "").trim()}\n`;
      const nextNotes = ((activeDoc.notes || notes) + block).trim();
      setNotes(nextNotes);
      await supabase.from("pdf_documents").update({ notes: nextNotes }).eq("id", activeDoc.id).eq("tenant_id", currentTenant.id);

      toast.success("Dokument analysiert (Typ, Schlagwörter, Zusammenfassung)");
      await loadAiStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runExtractEntities = async (persist: boolean) => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    setAiBusy("ner");
    try {
      const res = await invokeAiTenant<{ entities?: Record<string, unknown> }>({
        action: "extract-entities",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
        persist,
      });
      setNerData(res.entities ?? {});
      setNerOpen(true);
      toast.success(persist ? "Stammdaten extrahiert und gespeichert" : "Stammdaten extrahiert");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Extraktion fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runOcrCorrect = async (scope: "page" | "document") => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    if (scope === "page" && !activeMeta) return;
    setAiBusy("ocr");
    try {
      const res = await invokeAiTenant<{ pages?: { page_index: number; corrected: string }[] }>({
        action: "correct-ocr",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
        scope,
        page_index: activeMeta.idx,
        update_db: true,
      });
      const list = res.pages ?? [];
      if (scope === "page" && list[0]) {
        setPageOcrText(list[0].corrected);
        setWordBlocks([]);
        setOcrCache(prev => {
          const next = { ...prev };
          delete next[activeMeta.idx];
          return next;
        });
      }
      toast.success("OCR-Korrektur angewendet");
      await reindexDocument(activeDoc.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "OCR-Korrektur fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runAiSplitSuggest = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    setAiBusy("split");
    try {
      const res = await invokeAiTenant<{ splits?: number[] }>({
        action: "suggest-split",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      const splits = res.splits ?? [];
      if (!splits.length) {
        toast.message("Keine Splittpunkte erkannt");
        return;
      }
      const orderIdx = splits[0];
      if (orderIdx < 0 || orderIdx >= pageOrder.length) {
        toast.error("Ungültiger Splittvorschlag");
        return;
      }
      setSplitInfo({ pageIndex: orderIdx, match: "KI-Vorschlag", position: 0 });
      toast.message(`Trennung nach Band-Seite ${orderIdx + 1} vorgeschlagen`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Split-Vorschlag fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runSuggestTags = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    setAiBusy("tags");
    try {
      const res = await invokeAiTenant<{ tags?: string[] }>({
        action: "suggest-tags",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      const tags = (res.tags ?? []).join(", ");
      insertAtCursor(`\n=== KI-Tags ===\n${tags}\n`);
      toast.success("Tags in Notizen eingefügt");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Tags fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runFindSimilar = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    setAiBusy("sim");
    try {
      const res = await invokeAiTenant<{ similar?: { document_id: string; document_name: string; score: number }[] }>({
        action: "find-similar",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      setSimilarRows(res.similar ?? []);
      setSimilarOpen(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ähnlichkeitssuche fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runValidateDiscrepancy = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    let expected: Record<string, unknown>;
    try {
      expected = JSON.parse(discExpected) as Record<string, unknown>;
    } catch {
      toast.error("Soll-Daten: kein gültiges JSON");
      return;
    }
    setAiBusy("disc");
    try {
      const res = await invokeAiTenant<{ report?: unknown }>({
        action: "validate-discrepancy",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
        expected,
      });
      insertAtCursor(`\n=== Soll/Ist-Prüfung (KI) ===\n${JSON.stringify(res.report, null, 2)}\n`);
      toast.success("Abweichungsprüfung in Notizen eingefügt");
      setDiscOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Prüfung fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  const runSuggestActions = async () => {
    if (!activeDoc || !currentTenant?.id || !aiEnabled) return;
    setAiBusy("act");
    try {
      const res = await invokeAiTenant<{ actions?: unknown[] }>({
        action: "suggest-actions",
        tenant_id: currentTenant.id,
        document_id: activeDoc.id,
      });
      insertAtCursor(`\n=== KI-Folgeaktionen ===\n${JSON.stringify(res.actions ?? [], null, 2)}\n`);
      toast.success("Folgeaktionen in Notizen eingefügt");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Aktionen fehlgeschlagen");
    } finally {
      setAiBusy(null);
    }
  };

  // Cleanup bei unmount
  useEffect(() => {
    return () => {
      if (ocrAbortControllerRef.current) {
        ocrAbortControllerRef.current.abort();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  if (tenantLoading) {
    return (
      <AdminLayout>
        <AdminContentWrapper>
          <AdminCard className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Lade Mandant...</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper>
          <AdminPageHeader icon={Sparkles} title="Dokumente AI / OCR" description="Dokumente intelligent verwalten." />
          <AdminCard className="p-12 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="full">
        <AdminPageHeader 
          icon={Sparkles} 
          title="AI / OCR" 
          description={`PDFs hochladen, Seiten bearbeiten und Texte extrahieren – Mandant: ${currentTenant.name}`}
          badge={`${docs.length} Dokument(e)`}
          actions={
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                PDF hochladen
              </Button>
            </div>
          }
        />

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="dokumente">
              <FileText className="h-4 w-4 mr-2" />
              Dokumente
            </TabsTrigger>
            <TabsTrigger value="eigenschaften">
              <Settings className="h-4 w-4 mr-2" />
              Eigenschaften
            </TabsTrigger>
            {isTenantAdmin && (
              <TabsTrigger value="ki-konfiguration">
                <ListTree className="h-4 w-4 mr-2" />
                KI-Konfiguration
              </TabsTrigger>
            )}
          </TabsList>

          {/* DOKUMENTE TAB */}
          <TabsContent value="dokumente" className="space-y-6">
            {/* Dokumentenauswahl */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-80">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between w-full h-10 px-4 py-2 text-sm bg-card border border-input rounded-lg shadow-sm hover:bg-accent transition-colors"
                >
                  <span className="truncate font-medium">
                    {activeDoc ? activeDoc.name : "Dokument wählen..."}
                  </span>
                  <ChevronUp className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-popover border border-border rounded-lg shadow-xl max-h-80 overflow-auto animate-in fade-in zoom-in-95 duration-100">
                    {docs.length === 0 && <div className="p-4 text-xs text-muted-foreground text-center">Keine Dokumente vorhanden</div>}
                    {myCheckedOutDocs.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 border-b">📄 Meine Dokumente</div>
                        {myCheckedOutDocs.map(d => (
                          <div key={d.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent cursor-pointer group">
                            <span className="flex-1 text-sm truncate" onClick={() => { selectDocAndPage(d.id, 0); setIsDropdownOpen(false); }}>{d.name}</span>
                            <button onClick={(e) => releaseDoc(d.id, e)} className="ml-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                              <Undo2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                    {otherDocs.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 border-t border-b">📁 Andere Dokumente</div>
                        {otherDocs.map(d => (
                          <div key={d.id} className="px-4 py-2.5 hover:bg-accent cursor-pointer" onClick={() => { selectDocAndPage(d.id, 0); setIsDropdownOpen(false); }}>
                            <span className="text-sm truncate block">{d.name}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {activeDoc && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => releaseDoc(activeDoc.id)}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Zurücklegen
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportEdited}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="destructive" size="icon" onClick={deleteDoc} className="h-9 w-9">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Drei-Spalten-Layout */}
            {activeDoc && (
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_1fr] gap-6">
                {/* Linke Spalte: Seitenübersicht */}
                <AdminCard title="Seiten" padding="sm" className="h-[calc(100vh-280px)] flex flex-col"
                  actions={
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={runOCRForAllPages} disabled={ocrRunning}>
                        <Sparkles className="h-3 w-3 mr-1" /> OCR starten
                      </Button>
                    </div>
                  }
                  >
                    
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {/* OCR-Fortschritt */}
                    {ocrRunning && (
                      <div className="mb-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                          <span className="text-primary">{ocrStatusText}</span>
                          <span>{ocrProgressPercent}%</span>
                        </div>
                        <Progress value={ocrProgressPercent} className="h-1.5" />
                      </div>
                    )}
                    
                    {/* Trennpunkt-Hinweis */}
                    {splitInfo && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl mb-4">
                        <div className="text-xs font-bold text-yellow-600 uppercase mb-1">✂️ Trennpunkt gefunden</div>
                        <div className="text-[10px] text-muted-foreground mb-2">"{splitInfo.match}" auf Seite {splitInfo.pageIndex + 1}</div>
                        <Button size="sm" className="w-full h-8 text-[10px] font-bold uppercase" onClick={() => performSplit(splitInfo)}>
                          <Scissors className="h-3 w-3 mr-2" /> Jetzt trennen
                        </Button>
                      </div>
                    )}

                    {/* Seitenliste */}
                    <div className="space-y-2">
                      {pageOrder.map((pm, idx) => {
                        const isActive = activePageOrderIdx === idx;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setActivePageOrderIdx(idx)}
                            className={`relative group p-2 rounded-xl border transition-all cursor-pointer ${
                              isActive ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card hover:bg-muted/50 border-border/50'
                            }`}
                          >
                            <div className="flex gap-3 items-center">
                              <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden border border-border/50">
                                {thumbs[pm.idx] ? (
                                  <img src={thumbs[pm.idx]} className="w-full h-full object-cover" alt={`Seite ${idx + 1}`} />
                                ) : (
                                  <FileText className="h-5 w-5 text-muted-foreground/30" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold">Seite {idx + 1}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                  Index: {pm.idx} {pm.rotation !== 0 && `· ${pm.rotation}°`}
                                </div>
                              </div>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Seitenaktionen */}
                  <div className="p-3 border-t bg-muted/20 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={movePageUp} disabled={activePageOrderIdx === 0}>
                      <MoveUp className="h-3 w-3 mr-1" /> Hoch
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={movePageDown} disabled={activePageOrderIdx === pageOrder.length - 1}>
                      <MoveDown className="h-3 w-3 mr-1" /> Runter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={rotateCurrentPage}>
                      <RotateCw className="h-3 w-3 mr-1" /> Drehen
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={manualSplitAtCurrentPage}>
                        <Scissors className="h-3 w-3 mr-1" /> Trennen
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase text-destructive hover:text-destructive" onClick={deleteCurrentPage}>
                      <Trash2 className="h-3 w-3 mr-1" /> Löschen
                    </Button>
                  </div>
                </AdminCard>

                {/* Mittlere Spalte: Editor */}
                <AdminCard 
                  title="Editor" 
                  padding="sm"
                  className="h-[calc(100vh-280px)] flex flex-col"
                >
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/50">
                      {!aiEnabled && (
                        <p className="text-[10px] text-muted-foreground w-full">
                          KI-Funktionen sind deaktiviert, solange kein Mandanten-Admin eine aktive KI-Konfiguration hinterlegt hat.
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runDocumentAnalyze()}
                      >
                        <Wand2 className="h-3 w-3 mr-1" /> Analysieren
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runOcrCorrect("page")}
                      >
                        OCR Seite
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runOcrCorrect("document")}
                      >
                        OCR ganz
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runAiSplitSuggest()}
                      >
                        <GitMerge className="h-3 w-3 mr-1" /> Split
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runFindSimilar()}
                      >
                        <Search className="h-3 w-3 mr-1" /> Ähnlich
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runSuggestTags()}
                      >
                        <Tags className="h-3 w-3 mr-1" /> Tags
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runSuggestActions()}
                      >
                        Folgeaktionen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => setDiscOpen(true)}
                      >
                        <Scale className="h-3 w-3 mr-1" /> Soll/Ist
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runExtractEntities(false)}
                      >
                        Stammdaten
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !!aiBusy || !activeDoc}
                        onClick={() => void runExtractEntities(true)}
                      >
                        Stammdaten speichern
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        disabled={!aiEnabled || !activeDoc}
                        onClick={() => setChatOpen(true)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" /> Chat
                      </Button>
                    </div>
                    {/* Erkannter Typ */}
                    <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">📌 Erkannter Dokumenttyp</div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{detectedType?.name || "Nicht erkannt"}</span>
                        {activeDoc.matched_keywords.length > 0 && (
                          <Badge variant="secondary" className="text-[9px]">
                            {activeDoc.matched_keywords.length} Schlagwort(e)
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Notizen / OCR-Text */}
                    <div className="flex-1 flex flex-col">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">📝 Notizen / OCR-Text</div>
                      <Textarea 
                        ref={textareaRef}
                        value={notes} 
                        onChange={e => saveNotes(e.target.value)}
                        className="flex-1 font-mono text-xs resize-none bg-muted/10 border-border/50 p-4 leading-relaxed min-h-[200px]"
                        placeholder="Erkannter Text wird hier eingefügt oder Notizen können manuell hinzugefügt werden..."
                      />
                    </div>
                    
                    <p className="text-[10px] text-muted-foreground italic text-center">
                      💡 Klicke auf Wörter in der Vorschau, um sie einzufügen
                    </p>
                  </div>
                </AdminCard>

                {/* Rechte Spalte: Vorschau */}
                <AdminCard title="Vorschau" padding="sm" className="h-[calc(100vh-280px)] overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-auto bg-zinc-900/5 rounded-lg relative flex items-center justify-center p-4">
                    <div className="relative inline-block shadow-2xl">
                      <canvas ref={canvasRef} className="block max-w-full h-auto rounded-sm" />
                      {wordBlocks.map((word, i) => (
                        <button 
                          key={i} 
                          onClick={() => insertAtCursor(word.text)} 
                          title={word.text}
                          className="absolute border border-primary/40 bg-primary/5 hover:bg-primary/20 transition-all cursor-pointer rounded-sm"
                          style={{ 
                            left: `${word.x * 100}%`, 
                            top: `${word.y * 100}%`, 
                            width: `${word.w * 100}%`, 
                            height: `${word.h * 100}%` 
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                </AdminCard>
              </div>
            )}
          </TabsContent>

          {/* EIGENSCHAFTEN TAB */}
          <TabsContent value="eigenschaften" className="space-y-6">
            {/* Neuer Dokumenttyp */}
            <AdminCard title="Neuen Dokumenttyp anlegen" icon={Plus}>
              <div className="flex gap-3">
                <Input 
                  placeholder="z.B. Rechnung, Lieferschein, Vertrag..."
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addType()}
                  className="flex-1"
                />
                <Button onClick={addType}>
                  <Plus className="h-4 w-4 mr-2" />
                  Anlegen
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Dokumenttypen helfen bei der automatischen Klassifizierung Ihrer PDFs.
              </p>
            </AdminCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dokumenttypen Liste */}
              <AdminCard 
                title="Dokumenttypen" 
                subtitle="Wähle einen Typ, um Schlagwörter zu verwalten"
                icon={FileText}
              >
                <div className="space-y-2">
                  {docTypes.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTypeId(t.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedTypeId === t.id 
                          ? 'bg-primary/5 border-primary shadow-sm' 
                          : 'bg-card hover:bg-muted/50 border-border/50'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-sm">{t.name}</span>
                        {t.split_enabled && (
                          <Badge variant="outline" className="ml-2 text-[9px]">✂️ Trennung aktiv</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const newName = prompt("Neuer Name:", t.name);
                            if (newName) renameType(t.id, newName);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
                          onClick={(e) => { e.stopPropagation(); deleteType(t.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {docTypes.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Keine Dokumenttypen definiert
                    </div>
                  )}
                </div>
              </AdminCard>

              {/* Schlagwörter */}
              <AdminCard 
                title={selectedType ? `Schlagwörter: ${selectedType.name}` : "Schlagwörter"}
                subtitle="Texte oder Regex, die diesen Typ identifizieren"
                icon={Settings}
              >
                {!selectedType ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Wähle links einen Typ aus
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Neues Schlagwort oder Regex..." 
                        value={newKeywordByType[selectedType.id] || ""}
                        onChange={e => setNewKeywordByType(p => ({ ...p, [selectedType.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addKeyword(selectedType.id)}
                        className="font-mono text-xs flex-1"
                      />
                      <Button size="sm" onClick={() => addKeyword(selectedType.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {selectedKeywords.map(k => (
                        <div key={k.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/50">
                          <Input 
                            value={k.keyword} 
                            onChange={e => updateKeyword(k.id, e.target.value)}
                            className="h-8 font-mono text-xs bg-transparent border-none focus-visible:ring-0 flex-1"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteKeyword(k.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {selectedKeywords.length === 0 && (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                          Keine Schlagwörter für diesen Typ
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </AdminCard>
            </div>

            {/* Dokumententrennung */}
            <AdminCard title="Dokumententrennung" icon={Scissors}>
              <AdminSection spacing="sm">
                {/* Globale Trennung */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <Checkbox id="globalSplit" checked={globalSplitEnabled} onCheckedChange={v => setGlobalSplitEnabled(v as boolean)} />
                  <Label htmlFor="globalSplit" className="font-bold text-sm cursor-pointer">🌍 Globale Trennung aktivieren</Label>
                </div>
                
                {globalSplitEnabled && (
                  <AdminFieldGroup 
                    label="Globaler Trenn-Regex" 
                    description="Wird auf alle Dokumente angewendet (Groß-/Kleinschreibung wird ignoriert)"
                  >
                    <Input 
                      value={globalSplitRegex} 
                      onChange={e => setGlobalSplitRegex(e.target.value)} 
                      className="font-mono text-xs" 
                      placeholder="z.B. ^--- SEITE \d+ ---$ oder -----\\s*ANHANG\\s*-----"
                    />
                  </AdminFieldGroup>
                )}
                
                <AdminDivider spacing="md" />
                
                {/* Typspezifische Trennung */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                    <Scissors className="h-3.5 w-3.5" />
                    Typspezifische Trennung
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {docTypes.map(t => (
                      <div key={t.id} className="p-4 bg-card border border-border/50 rounded-xl space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id={`split-${t.id}`} 
                            checked={t.split_enabled || false} 
                            onCheckedChange={v => saveTypeSplitSettings(t.id, v as boolean, t.split_regex || "")} 
                          />
                          <Label htmlFor={`split-${t.id}`} className="font-bold text-sm cursor-pointer">
                            {t.name}
                          </Label>
                        </div>
                        {t.split_enabled && (
                          <Input 
                            value={t.split_regex || ""} 
                            onChange={e => saveTypeSplitSettings(t.id, true, e.target.value)}
                            className="h-8 font-mono text-[10px]"
                            placeholder="Regex für diesen Typ..."
                          />
                        )}
                      </div>
                    ))}
                    {docTypes.length === 0 && (
                      <div className="col-span-2 text-center py-6 text-xs text-muted-foreground">
                        Keine Dokumenttypen vorhanden – erstelle zuerst einen Typ
                      </div>
                    )}
                  </div>
                </div>
              </AdminSection>
            </AdminCard>
          </TabsContent>

          {isTenantAdmin && currentTenant && (
            <TabsContent value="ki-konfiguration" className="space-y-6">
              <AIConfigTab tenantId={currentTenant.id} onSaved={() => void loadAiStatus()} />
            </TabsContent>
          )}
        </Tabs>

        <AIChatSidebar
          open={chatOpen}
          onOpenChange={setChatOpen}
          tenantId={currentTenant?.id ?? ""}
          documentId={activeDocId}
          aiEnabled={aiEnabled}
        />

        <Dialog open={nerOpen} onOpenChange={setNerOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Extrahierte Stammdaten</DialogTitle>
            </DialogHeader>
            {nerData && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feld</TableHead>
                    <TableHead>Wert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(nerData).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-xs">{k}</TableCell>
                      <TableCell className="text-xs break-all">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNerOpen(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={similarOpen} onOpenChange={setSimilarOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ähnliche Dokumente</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {similarRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs text-muted-foreground">
                      Keine Treffer oder noch keine Embeddings (nach OCR indexieren).
                    </TableCell>
                  </TableRow>
                )}
                {similarRows.map((r) => (
                  <TableRow key={r.document_id}>
                    <TableCell className="text-sm">{r.document_name}</TableCell>
                    <TableCell className="text-right text-xs">{r.score?.toFixed?.(3) ?? r.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        <Dialog open={discOpen} onOpenChange={setDiscOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Soll-Daten (JSON)</DialogTitle>
            </DialogHeader>
            <Textarea
              value={discExpected}
              onChange={(e) => setDiscExpected(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDiscOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={() => void runValidateDiscrepancy()} disabled={!!aiBusy}>
                Prüfen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default AIPage;
