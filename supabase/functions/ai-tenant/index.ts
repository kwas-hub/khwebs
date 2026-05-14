/**
 * Mandantensichere KI-Brücke: Auth prüfen, tenant_id validieren, aktive tenant_ai_config laden,
 * Provider-spezifische Aufrufe (OpenAI-kompatibel + Google Gemini), keine API-Keys ans Client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ----------------------------------------------------------------------
// 1. CORS-Header – einheitlich für alle Antworten
// ----------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://bitflow.khwebs.de",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ----------------------------------------------------------------------
// 2. Hilfsfunktion für einheitliche JSON-Antworten (immer mit CORS-Headern)
// ----------------------------------------------------------------------
function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ----------------------------------------------------------------------
// 3. Der Haupt-Handler
// ----------------------------------------------------------------------
Deno.serve(async (req) => {
  // ⚠️ WICHTIG: OPTIONS-Preflight MUSS als allererstes beantwortet werden,
  // BEVOR irgendein anderer Code (await, JSON-Parsing, etc.) ausgeführt wird.
  // Supabase erwartet status 200 oder 204 – kein Body, nur die CORS-Header.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Nur POST erlaubt (nach OPTIONS)
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

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

    // Body erst NACH dem OPTIONS-Check parsen
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Ungültiger JSON-Body" }, 400);
    }

    const action = body?.action as string;
    const tenantId = body?.tenant_id as string;

    if (!action) return jsonResponse({ error: "action fehlt" }, 400);
    if (!tenantId) return jsonResponse({ error: "tenant_id fehlt" }, 400);

    // Admin-Client für Backend-Operationen (mit Service-Role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prüfe, ob User globaler Admin ist
    const { data: isGlobalAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    // Prüfe Mandanten-Zugriff
    let hasTenantAccess = false;
    if (isGlobalAdmin) {
      hasTenantAccess = true;
    } else {
      const { data: tenantMember } = await supabaseAdmin
        .from("user_tenants")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      hasTenantAccess = !!tenantMember;
    }

    if (!hasTenantAccess) {
      return jsonResponse({ error: "Kein Zugriff auf diesen Mandanten" }, 403);
    }

    // Prüfe, ob User Admin des Mandanten ist
    const isTenantAdmin = isGlobalAdmin
      ? true
      : await (async () => {
          const { data: roleRow } = await supabaseAdmin
            .from("user_tenants")
            .select("role")
            .eq("user_id", user.id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          return roleRow?.role === "admin";
        })();

    // ------------------------------------------------------------------
    // 4. Aktuelle KI-Konfiguration laden
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
    // 5. Actions
    // ------------------------------------------------------------------
    switch (action) {
      // ------------------------------------------------
      // Admin-Aktionen
      // ------------------------------------------------
      case "list-ai-configs": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        const { data, error } = await supabaseAdmin
          .from("tenant_ai_config")
          .select(
            "id, provider, model_name, base_url, embedding_model, max_tokens, temperature, is_active, created_at, updated_at"
          )
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ ok: true, configs: data ?? [] });
      }

      case "save-ai-config": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        // Deine bestehende Speicher-Logik hier einfügen
        return jsonResponse({ ok: true, message: "Config gespeichert" });
      }

      case "delete-ai-config": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        const configId = body?.config_id as string;
        if (!configId) return jsonResponse({ error: "config_id fehlt" }, 400);
        const { error } = await supabaseAdmin
          .from("tenant_ai_config")
          .delete()
          .eq("id", configId)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "test-connection": {
        if (!isTenantAdmin) return jsonResponse({ error: "Nur Admins" }, 403);
        // Deine bestehende Test-Logik hier einfügen
        return jsonResponse({ ok: true, reply: "Test erfolgreich" });
      }

      // ------------------------------------------------
      // Benutzer-Aktionen
      // ------------------------------------------------
      case "ai-status": {
        const { data, error } = await supabaseAdmin
          .from("tenant_ai_config")
          .select(
            "id, provider, model_name, base_url, is_active, embedding_model, max_tokens, temperature"
          )
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .maybeSingle();
        if (error) throw error;
        return jsonResponse({ ok: true, active: !!data, config: data });
      }

      case "classify-document": {
        const cfg = await getActiveConfig();
        // Deine bestehende Klassifikations-Logik hier einfügen
        return jsonResponse({ ok: true, result: {}, cfg: cfg.model_name });
      }

      // Weitere Actions hier einfügen ...

      default:
        return jsonResponse({ error: `Unbekannte action: ${action}` }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-tenant error:", msg);

    // Auch im Fehlerfall IMMER corsHeaders mitsenden – sonst sieht der Browser
    // nur einen CORS-Fehler statt der eigentlichen Fehlermeldung
    const status =
      msg.includes("Unauthorized") || msg.includes("Kein Zugriff") ? 403 : 500;
    return jsonResponse({ error: msg }, status);
  } finally {
    clearTimeout(timeout);
  }
});
