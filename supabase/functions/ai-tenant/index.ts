/**
 * Mandantensichere KI-Brücke: Auth prüfen, tenant_id validieren, aktive tenant_ai_config laden,
 * Provider-spezifische Aufrufe (OpenAI-kompatibel + Google Gemini), keine API-Keys ans Client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const EMBED_DIM = 768;

type Provider = "ollama" | "groq" | "openai" | "google" | "mistral" | "deepseek" | "custom";

type TenantAiConfig = {
  id: string;
  tenant_id: string;
  provider: Provider;
  base_url: string;
  api_key_encrypted: string | null;
  model_name: string;
  embedding_model: string | null;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
};

const encoder = new TextEncoder();

async function sha256Bytes(secret: string): Promise<ArrayBuffer> {
  return await crypto.subtle.digest("SHA-256", encoder.encode(secret));
}

async function getAesKey(): Promise<CryptoKey> {
  const env = Deno.env.get("TENANT_AI_CRYPTO_KEY");
  if (!env || env.length < 8) {
    throw new Error("TENANT_AI_CRYPTO_KEY ist nicht gesetzt (Server-Secret für API-Key-Verschlüsselung)");
  }
  const raw = await sha256Bytes(env);
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plain),
  );
  const pack = new Uint8Array(iv.length + ct.byteLength);
  pack.set(iv, 0);
  pack.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...pack));
}

async function decryptApiKey(enc: string | null): Promise<string> {
  if (!enc) return "";
  const key = await getAesKey();
  const bin = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const data = bin.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(pt);
}

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null as null | { id: string }, error: "Unauthorized" };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { user: null, error: error?.message ?? "Unauthorized" };
  return { user, error: null as string | null };
}

async function assertTenantAccess(admin: ReturnType<typeof createClient>, userId: string, tenantId: string) {
  const { data: isGlobal } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isGlobal) return;
  const { data: row } = await admin.from("user_tenants").select("user_id").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle();
  if (!row) throw new Error("Kein Zugriff auf diesen Mandanten");
}

async function assertTenantAdmin(admin: ReturnType<typeof createClient>, userId: string, tenantId: string) {
  const { data: isGlobal } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isGlobal) return;
  const { data: row } = await admin.from("user_tenants").select("role").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle();
  if (!row || row.role !== "admin") throw new Error("Nur Mandanten-Admins dürfen diese Aktion ausführen");
}

async function assertPdfRead(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  docId: string,
) {
  const { data: doc, error } = await admin.from("pdf_documents")
    .select("owner_id, checked_out_by, tenant_id")
    .eq("id", docId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !doc) throw new Error("Dokument nicht gefunden");
  const { data: isGlobal } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isGlobal) return doc;
  const { data: canEdit } = await admin.rpc("can_edit", { _user_id: userId });
  const ok = doc.owner_id === userId ||
    (!!canEdit && (doc.checked_out_by === null || doc.checked_out_by === userId));
  if (!ok) throw new Error("Kein Lesezugriff auf dieses Dokument");
  return doc;
}

async function loadActiveAiConfig(admin: ReturnType<typeof createClient>, tenantId: string): Promise<TenantAiConfig> {
  const { data, error } = await admin.from("tenant_ai_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Keine aktive KI-Konfiguration für diesen Mandanten");
  return data as TenantAiConfig;
}

function defaultEmbeddingModel(provider: Provider, configured: string | null): string {
  if (configured?.trim()) return configured.trim();
  switch (provider) {
    case "openai":
    case "groq":
    case "mistral":
    case "deepseek":
    case "custom":
      return "text-embedding-3-small";
    case "ollama":
      return "nomic-embed-text";
    case "google":
      return "text-embedding-004";
    default:
      return "text-embedding-3-small";
  }
}

async function openaiCompatibleChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number,
  signal: AbortSignal,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`KI-HTTP ${res.status}: ${txt.slice(0, 500)}`);
  const data = JSON.parse(txt);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Unerwartete KI-Antwort");
  return content;
}

async function googleChat(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const m = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Google KI ${res.status}: ${txt.slice(0, 500)}`);
  const data = JSON.parse(txt);
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("Unerwartete Google-Antwort");
  return parts.map((p: { text?: string }) => p.text ?? "").join("");
}

async function runChat(
  cfg: TenantAiConfig,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const apiKey = await decryptApiKey(cfg.api_key_encrypted);
  if (cfg.provider === "google") {
    if (!apiKey) throw new Error("API-Key fehlt");
    return await googleChat(apiKey, cfg.model_name || "gemini-2.0-flash", system, user, signal);
  }
  const base = cfg.base_url || "https://api.openai.com/v1";
  return await openaiCompatibleChat(
    base,
    apiKey,
    cfg.model_name,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    cfg.max_tokens,
    cfg.temperature,
    signal,
  );
}

async function fetchEmbeddings768(
  cfg: TenantAiConfig,
  inputs: string[],
  signal: AbortSignal,
): Promise<number[][]> {
  const apiKey = await decryptApiKey(cfg.api_key_encrypted);
  const embedModel = defaultEmbeddingModel(cfg.provider, cfg.embedding_model);

  if (cfg.provider === "google") {
    if (!apiKey) throw new Error("API-Key fehlt");
    const out: number[][] = [];
    for (const text of inputs) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`Google Embedding ${res.status}: ${txt.slice(0, 400)}`);
      const data = JSON.parse(txt);
      const vals = data?.embedding?.values;
      if (!Array.isArray(vals)) throw new Error("Google Embedding ungültig");
      out.push(normalize768(vals));
    }
    return out;
  }

  const base = cfg.base_url || "https://api.openai.com/v1";
  const url = `${base.replace(/\/$/, "")}/embeddings`;
  const body: Record<string, unknown> = {
    model: embedModel,
    input: inputs.length === 1 ? inputs[0] : inputs,
  };
  if (cfg.provider === "openai" || cfg.provider === "custom" || cfg.provider === "mistral" || cfg.provider === "deepseek") {
    (body as { dimensions?: number }).dimensions = EMBED_DIM;
  }

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Embedding HTTP ${res.status}: ${txt.slice(0, 500)}`);
  const data = JSON.parse(txt);
  const list = data?.data as { embedding: number[] }[] | undefined;
  if (!Array.isArray(list)) throw new Error("Embedding-Antwort ungültig");
  return list.map((d) => normalize768(d.embedding));
}

function normalize768(vec: number[]): number[] {
  if (vec.length === EMBED_DIM) return vec;
  if (vec.length > EMBED_DIM) return vec.slice(0, EMBED_DIM);
  const padded = [...vec];
  while (padded.length < EMBED_DIM) padded.push(0);
  return padded;
}

function vecSql(vec: number[]): string {
  return `[${vec.map((n) => Number(n.toFixed(6))).join(",")}]`;
}

function chunkText(text: string, maxLen = 1200, overlap = 150): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + maxLen);
    chunks.push(t.slice(i, end));
    if (end >= t.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}

function stripJsonFence(s: string): string {
  let x = s.trim();
  if (x.startsWith("```")) {
    x = x.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return x;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);

  try {
    const { user, error: authErr } = await getUserFromRequest(req);
    if (!user) return jsonResponse({ error: authErr ?? "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body?.action as string;
    const tenantId = body?.tenant_id as string;
    if (!tenantId) return jsonResponse({ error: "tenant_id fehlt" }, 400);

    await assertTenantAccess(admin, user.id, tenantId);

    if (action === "ai-status") {
      const { data, error } = await admin.from("tenant_ai_config")
        .select("id, provider, model_name, base_url, is_active, embedding_model, max_tokens, temperature")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ ok: true, active: !!data, config: data });
    }

    if (action === "list-ai-configs") {
      await assertTenantAdmin(admin, user.id, tenantId);
      const { data, error } = await admin.from("tenant_ai_config")
        .select("id, provider, model_name, base_url, embedding_model, max_tokens, temperature, is_active, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ ok: true, configs: data ?? [] });
    }

    // --- Konfiguration speichern / testen (Admin) ---
    if (action === "save-ai-config") {
      await assertTenantAdmin(admin, user.id, tenantId);
      const {
        id,
        provider,
        base_url,
        model_name,
        max_tokens,
        temperature,
        is_active,
        api_key,
        embedding_model,
      } = body;

      let enc: string | null = null;
      if (typeof api_key === "string" && api_key.length > 0) {
        enc = await encryptApiKey(api_key);
      }

      if (is_active === true) {
        await admin.from("tenant_ai_config").update({ is_active: false }).eq("tenant_id", tenantId);
      }

      const row = {
        tenant_id: tenantId,
        provider,
        base_url: base_url ?? "",
        model_name: model_name ?? "",
        embedding_model: embedding_model ?? null,
        max_tokens: Number(max_tokens) || 4096,
        temperature: Number(temperature) ?? 0.7,
        is_active: !!is_active,
        ...(enc ? { api_key_encrypted: enc } : {}),
      };

      if (id) {
        const upd = { ...row };
        if (!enc) delete (upd as { api_key_encrypted?: string }).api_key_encrypted;
        const { data, error } = await admin.from("tenant_ai_config").update(upd).eq("id", id).eq("tenant_id", tenantId).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, config: sanitizeConfig(data) });
      }
      const { data, error } = await admin.from("tenant_ai_config").insert(row).select().single();
      if (error) throw error;
      return jsonResponse({ ok: true, config: sanitizeConfig(data) });
    }

    if (action === "delete-ai-config") {
      await assertTenantAdmin(admin, user.id, tenantId);
      const id = body?.id as string;
      if (!id) return jsonResponse({ error: "id fehlt" }, 400);
      const { error } = await admin.from("tenant_ai_config").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "test-connection") {
      await assertTenantAdmin(admin, user.id, tenantId);
      const cfg = body?.config as Partial<TenantAiConfig> & { api_key?: string; id?: string };
      if (!cfg?.provider) return jsonResponse({ error: "config fehlt" }, 400);
      let apiKeyEnc = cfg.api_key_encrypted ?? null;
      if (typeof cfg.api_key === "string" && cfg.api_key.length > 0) {
        apiKeyEnc = await encryptApiKey(cfg.api_key);
      } else if (cfg.id) {
        const { data: existing } = await admin.from("tenant_ai_config")
          .select("api_key_encrypted")
          .eq("id", cfg.id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        apiKeyEnc = existing?.api_key_encrypted ?? null;
      }
      const tmp: TenantAiConfig = {
        id: "tmp",
        tenant_id: tenantId,
        provider: cfg.provider as Provider,
        base_url: cfg.base_url ?? "",
        api_key_encrypted: apiKeyEnc,
        model_name: cfg.model_name ?? "gpt-4o-mini",
        embedding_model: cfg.embedding_model ?? null,
        max_tokens: Math.min(Number(cfg.max_tokens) || 256, 512),
        temperature: Number(cfg.temperature) ?? 0.3,
        is_active: false,
      };
      const reply = await runChat(
        tmp,
        "Du bist ein Verbindungstest. Antworte genau mit: OK",
        "Ping",
        controller.signal,
      );
      return jsonResponse({ ok: true, reply: reply.slice(0, 2000) });
    }

    const cfg = await loadActiveAiConfig(admin, tenantId);

    if (action === "reindex-document") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);

      const { data: pages, error: pErr } = await admin.from("pdf_pages")
        .select("id, page_index, ocr_text")
        .eq("document_id", documentId)
        .eq("tenant_id", tenantId)
        .order("page_index", { ascending: true });
      if (pErr) throw pErr;

      await admin.from("document_chunks").delete().eq("document_id", documentId).eq("tenant_id", tenantId);

      const texts: { pageId: string; chunkIndex: number; text: string }[] = [];
      for (const p of pages ?? []) {
        const parts = chunkText((p as { ocr_text?: string }).ocr_text ?? "");
        let idx = 0;
        for (const c of parts) {
          texts.push({ pageId: (p as { id: string }).id, chunkIndex: idx++, text: c });
        }
      }
      if (texts.length === 0) return jsonResponse({ ok: true, indexed: 0 });

      const batchSize = 16;
      for (let i = 0; i < texts.length; i += batchSize) {
        const slice = texts.slice(i, i + batchSize);
        const embs = await fetchEmbeddings768(cfg, slice.map((s) => s.text), controller.signal);
        const rows = slice.map((s, j) => ({
          tenant_id: tenantId,
          document_id: documentId,
          page_id: s.pageId,
          chunk_index: s.chunkIndex,
          chunk_text: s.text,
          embedding: vecSql(embs[j]) as unknown as string,
        }));
        const { error: insErr } = await admin.from("document_chunks").insert(rows as any);
        if (insErr) throw insErr;
      }
      return jsonResponse({ ok: true, indexed: texts.length });
    }

    if (action === "classify-document") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);

      const { data: pages } = await admin.from("pdf_pages").select("ocr_text, page_index").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n\n").slice(0, 48_000);

      const { data: types } = await admin.from("document_types").select("id, name").eq("tenant_id", tenantId);
      const { data: kws } = await admin.from("document_type_keywords").select("type_id, keyword").eq("tenant_id", tenantId);
      const sys =
        `Du klassifizierst Geschäftsdokumente. Antworte NUR mit gültigem JSON: {"type_id":"<uuid oder null>","type_name":"<string>","keywords":["..."]}\n` +
        `Erlaubte Typen (id:name): ${JSON.stringify(types ?? [])}\n` +
        `Schlagwörter je Typ: ${JSON.stringify(kws ?? [])}\n` +
        `Wähle genau einen Typ oder null.`;

      const raw = await runChat(cfg, sys, `OCR-Text:\n${ocr}`, controller.signal);
      let parsed: { type_id?: string | null; type_name?: string; keywords?: string[] };
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      return jsonResponse({ ok: true, result: parsed });
    }

    if (action === "extract-entities") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text, page_index").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n\n").slice(0, 48_000);
      const sys =
        `Extrahiere Stammdaten aus dem Text. Antworte NUR mit JSON: {"invoice_number":null,"date":null,"amount":null,"currency":null,"supplier":null,"customer_number":null,"iban":null,"vat_id":null,"extra":{}}`;
      const raw = await runChat(cfg, sys, ocr, controller.signal);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      if (body?.persist === true) {
        await admin.from("extracted_fields").delete().eq("document_id", documentId).eq("tenant_id", tenantId);
        await admin.from("extracted_fields").insert({
          tenant_id: tenantId,
          document_id: documentId,
          fields: parsed as any,
        });
      }
      return jsonResponse({ ok: true, entities: parsed });
    }

    if (action === "summarize") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n\n").slice(0, 48_000);
      const sys = "Fasse das Dokument in 3–5 klaren Sätzen auf Deutsch zusammen. Keine Einleitung.";
      const summary = await runChat(cfg, sys, ocr, controller.signal);
      return jsonResponse({ ok: true, summary });
    }

    if (action === "suggest-split") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("page_index, ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const perPage = (pages ?? []) as { page_index: number; ocr_text: string }[];
      const numbered = perPage
        .map((p, ord) => `=== Dokument-Seite ${ord + 1} (page_index=${p.page_index}) ===\n${(p.ocr_text ?? "").slice(0, 4000)}`)
        .join("\n\n")
        .slice(0, 48_000);
      const sys =
        `Du erkennst logische Dokumenttrennungen (neuer Anhang, neues Formular). Antworte NUR mit JSON: {"split_after_order_indexes":[number]} – 0-basierte Position NACH dieser Seite in der aktuellen Reihenfolge (erste Seite = 0). Leeres Array wenn unklar.`;
      const raw = await runChat(cfg, sys, numbered, controller.signal);
      let parsed: { split_after_order_indexes?: number[] };
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      return jsonResponse({ ok: true, splits: parsed.split_after_order_indexes ?? [] });
    }

    if (action === "correct-ocr") {
      const documentId = body?.document_id as string;
      const pageIndex = body?.page_index as number | undefined;
      const scope = (body?.scope as string) ?? "page";
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);

      if (scope === "page" && pageIndex === undefined) {
        return jsonResponse({ error: "page_index fehlt für scope=page" }, 400);
      }

      let targetPages: { id: string; page_index: number; ocr_text: string }[] = [];
      if (scope === "document") {
        const { data } = await admin.from("pdf_pages").select("id, page_index, ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
        targetPages = (data ?? []) as typeof targetPages;
      } else {
        const { data } = await admin.from("pdf_pages").select("id, page_index, ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).eq("page_index", pageIndex!).maybeSingle();
        if (data) targetPages = [data as typeof targetPages[0]];
      }

      const out: { page_index: number; corrected: string }[] = [];
      for (const p of targetPages) {
        const sys =
          "Korrigiere OCR-Fehler (Zeichenverwechslungen, fehlende Leerzeichen). Gib nur den bereinigten Volltext zurück, ohne Kommentar.";
        const corrected = (await runChat(cfg, sys, p.ocr_text ?? "", controller.signal)).trim();
        out.push({ page_index: p.page_index, corrected });
        if (body?.update_db === true) {
          await admin.from("pdf_pages").update({ ocr_text: corrected, ocr_blocks: [] as unknown }).eq("id", p.id).eq("tenant_id", tenantId);
        }
      }
      return jsonResponse({ ok: true, pages: out });
    }

    if (action === "suggest-tags") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n").slice(0, 24_000);
      const sys = 'Antworte NUR mit JSON: {"tags":["max 10 kurze Stichwörter"]}';
      const raw = await runChat(cfg, sys, ocr, controller.signal);
      let parsed: { tags?: string[] };
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      return jsonResponse({ ok: true, tags: (parsed.tags ?? []).slice(0, 10) });
    }

    if (action === "suggest-actions") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n").slice(0, 24_000);
      const sys =
        'Antworte NUR mit JSON: {"actions":[{"title":"","rationale":"","priority":"low|medium|high"}]} – max 6 Einträge.';
      const raw = await runChat(cfg, sys, ocr, controller.signal);
      let parsed: { actions?: unknown[] };
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      return jsonResponse({ ok: true, actions: parsed.actions ?? [] });
    }

    if (action === "validate-discrepancy") {
      const documentId = body?.document_id as string;
      const expected = body?.expected as Record<string, unknown> | undefined;
      if (!documentId || !expected) return jsonResponse({ error: "document_id und expected benötigt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n").slice(0, 32_000);
      const sys =
        "Vergleiche OCR mit den Soll-Daten. Antworte NUR mit JSON: {\"matches\":[],\"mismatches\":[{\"field\":\"\",\"expected\":\"\",\"actual\":\"\",\"severity\":\"info|warning|error\"}]}";
      const raw = await runChat(
        cfg,
        sys,
        `Soll:\n${JSON.stringify(expected)}\n\nIst (OCR):\n${ocr}`,
        controller.signal,
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        return jsonResponse({ error: "KI lieferte kein gültiges JSON", raw: raw.slice(0, 800) }, 422);
      }
      return jsonResponse({ ok: true, report: parsed });
    }

    if (action === "find-similar") {
      const documentId = body?.document_id as string;
      if (!documentId) return jsonResponse({ error: "document_id fehlt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);
      const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
      const ocr = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n").slice(0, 12_000);
      const [emb] = await fetchEmbeddings768(cfg, [ocr], controller.signal);
      const q = vecSql(emb);

      const { data: hits, error: rpcErr } = await admin.rpc("match_document_chunks", {
        query_embedding: q,
        match_tenant: tenantId,
        exclude_document: documentId,
        match_count: 12,
      });
      if (rpcErr) throw rpcErr;

      return jsonResponse({ ok: true, similar: hits ?? [] });
    }

    if (action === "chat") {
      const documentId = body?.document_id as string;
      const question = body?.question as string;
      if (!documentId || !question) return jsonResponse({ error: "document_id und question benötigt" }, 400);
      await assertPdfRead(admin, user.id, tenantId, documentId);

      const [qEmb] = await fetchEmbeddings768(cfg, [question], controller.signal);
      const q = vecSql(qEmb);

      const { data: ragChunks, error: chErr } = await admin.rpc("match_chunks_for_rag", {
        query_embedding: q,
        match_tenant: tenantId,
        filter_document: documentId,
        match_count: 8,
      });

      let context = "";
      let usedRag = false;
      if (!chErr && Array.isArray(ragChunks) && ragChunks.length) {
        usedRag = true;
        context = (ragChunks as { chunk_text?: string }[]).map((c) => c.chunk_text ?? "").join("\n---\n").slice(0, 12_000);
      } else {
        const { data: pages } = await admin.from("pdf_pages").select("ocr_text").eq("document_id", documentId).eq("tenant_id", tenantId).order("page_index");
        context = (pages ?? []).map((p: { ocr_text: string }) => p.ocr_text).join("\n").slice(0, 12_000);
      }

      const sys =
        "Du beantwortest Fragen nur anhand des mitgelieferten Kontexts. Wenn der Kontext nicht reicht, sage das ehrlich.";
      const answer = await runChat(
        cfg,
        sys,
        `Kontext:\n${context}\n\nFrage:\n${question}`,
        controller.signal,
      );
      return jsonResponse({ ok: true, answer, used_rag: usedRag });
    }

    return jsonResponse({ error: `Unbekannte action: ${action}` }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-tenant", msg);
    const status = msg.includes("Unauthorized") || msg.includes("Kein Zugriff") ? 403 : 400;
    return jsonResponse({ error: msg }, status === 403 ? 403 : 400);
  } finally {
    clearTimeout(timeout);
  }
});

function sanitizeConfig(row: Record<string, unknown>) {
  const { api_key_encrypted: _a, ...rest } = row;
  return rest;
}
