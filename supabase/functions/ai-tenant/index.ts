/**
 * Mandantensichere KI-Brücke: Auth prüfen, tenant_id validieren, aktive tenant_ai_config laden,
 * Provider-spezifische Aufrufe (OpenAI-kompatibel + Google Gemini), keine API-Keys ans Client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ----------------------------------------------------------------------
// 1. CORS-Header – einheitlich für alle Antworten
// ----------------------------------------------------------------------
const corsHeaders = {
  // Für den Produktivbetrieb setze hier die exakte Origin deiner Domain:
  "Access-Control-Allow-Origin": "https://bitflow.khwebs.de",
  // Für Tests mit * (unten auskommentiert)
  // "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ----------------------------------------------------------------------
// 2. Hilfsfunktion für einheitliche JSON-Antworten
// ----------------------------------------------------------------------
function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ----------------------------------------------------------------------
// 3. Der Haupt-Handler – MIT CORRECTEM OPTIONS-HANDLER AN ERSTER STELLE
// ----------------------------------------------------------------------
Deno.serve(async (req) => {
  // ⚠️ GANZ AM ANFANG: Preflight beantworten
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // ------------------------------------------------------------------
  // Ab hier normale Request-Verarbeitung (nur POST)
  // ------------------------------------------------------------------
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);

  try {
    // ========== AUTH & TENANT PRÜFUNG ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: userError?.message || "Unauthorized" }, 401);
    }

    const body = await req.json();
    const action = body?.action as string;
    const tenantId = body?.tenant_id as string;
    if (!tenantId) return jsonResponse({ error: "tenant_id fehlt" }, 400);

    // Admin-Client für Backend-Operationen (mit Service-Role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prüfe, ob User Zugriff auf diesen Mandanten hat
    const { data: isGlobalAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    let hasTenantAccess = false;
    if (!isGlobalAdmin) {
      const { data: tenantMember } = await supabaseAdmin
        .from("user_tenants")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      hasTenantAccess = !!tenantMember;
    } else {
      hasTenantAccess = true;
    }
    if (!hasTenantAccess) {
      return jsonResponse({ error: "Kein Zugriff auf diesen Mandanten" }, 403);
    }

    // Prüfe, ob User Admin des Mandanten ist (für schreibende Aktionen)
    const isTenantAdmin = isGlobalAdmin ? true : await (async () => {
      const { data: roleRow } = await supabaseAdmin
        .from("user_tenants")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return roleRow?.role === "admin";
    })();

    // ------------------------------------------------------------------
    // 4. Aktuelle KI-Konfiguration laden (für alle Lese-Aktionen)
    // ------------------------------------------------------------------
    async function getActiveConfig() {
      const { data, error } = await supabaseAdmin
        .from("tenant_ai_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Keine aktive KI-Konfiguration für diesen Mandanten");
      return data;
    }

    // ------------------------------------------------------------------
    // 5. Actions basierend auf `action`
    // ------------------------------------------------------------------
    switch (action) {
      // ------------------------------------------------
      // Admin-Aktionen (nur mit isTenantAdmin)
      // ------------------------------------------------
      case "list-ai-configs": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        const { data, error } = await supabaseAdmin
          .from("tenant_ai_config")
          .select("id, provider, model_name, base_url, embedding_model, max_tokens, temperature, is_active, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ ok: true, configs: data ?? [] });
      }

      case "save-ai-config": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        // ... (hier deine bestehende Logik zum Speichern)
        // Achtung: In dieser gekürzten Version füge deine vorhandene Implementierung ein
        return jsonResponse({ ok: true, message: "Config gespeichert (Platzhalter)" });
      }

      case "delete-ai-config": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        // ... Löschlogik
        return jsonResponse({ ok: true });
      }

      case "test-connection": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        // ... Testlogik (ruft die KI auf)
        return jsonResponse({ ok: true, reply: "Test erfolgreich" });
      }

      // ------------------------------------------------
      // Benutzer-Aktionen (keine Admin-Rechte nötig)
      // ------------------------------------------------
      case "ai-status": {
        const { data, error } = await supabaseAdmin
          .from("tenant_ai_config")
          .select("id, provider, model_name, base_url, is_active, embedding_model, max_tokens, temperature")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .maybeSingle();
        if (error) throw error;
        return jsonResponse({ ok: true, active: !!data, config: data });
      }

      case "classify-document": {
        const cfg = await getActiveConfig();
        // ... Klassifikationslogik (dein bestehender Code)
        return jsonResponse({ ok: true, result: {} });
      }

      // ... alle weiteren Actions (extract-entities, summarize, suggest-split, ...)
      // Du kannst deinen bestehenden Code unverändert übernehmen,
      // aber darauf achten, dass jede Antwort über jsonResponse läuft.

      default:
        return jsonResponse({ error: `Unbekannte action: ${action}` }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-tenant error:", msg);
    const status = msg.includes("Unauthorized") || msg.includes("Kein Zugriff") ? 403 : 400;
    return jsonResponse({ error: msg }, status);
  } finally {
    clearTimeout(timeout);
  }
});
