import { supabase } from "@/integrations/supabase/client";

export async function invokeAiTenant<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-tenant", { body });
  if (error) {
    const ctx = (error as { context?: Response })?.context;
    let detail = "";
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        detail = typeof j?.error === "string" ? j.error : JSON.stringify(j);
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || error.message || "KI-Dienst nicht erreichbar");
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}
