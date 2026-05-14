
import { supabase } from "@/integrations/supabase/client";

export async function invokeAiTenant<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(
    "https://xqzryrfizmdjfvnhnsrr.supabase.co/functions/v1/ai-tenant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  console.log("ai-tenant RAW:", res.status, text); // <-- zeigt den echten Fehler

  if (!res.ok) throw new Error(text || "KI-Dienst nicht erreichbar");
  return JSON.parse(text) as T;
}
