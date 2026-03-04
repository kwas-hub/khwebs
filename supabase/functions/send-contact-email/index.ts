import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, subject, message } = await req.json();

    const cleanFirstName = String(firstName ?? "").trim();
    const cleanLastName = String(lastName ?? "").trim();
    const cleanSubject = String(subject ?? "").trim();
    const cleanMessage = String(message ?? "").trim();

    if (!cleanFirstName || !cleanLastName || !cleanSubject || !cleanMessage) {
      return new Response(JSON.stringify({ error: "Alle Felder sind erforderlich." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL") ?? "hello@khwebs.de";

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "E-Mail-Service nicht konfiguriert." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Kontaktformular <${RESEND_FROM_EMAIL}>`,
        to: [CONTACT_TO_EMAIL],
        subject: `Kontaktanfrage: ${escapeHtml(cleanSubject)}`,
        html: `
          <h2>Kontaktanfrage</h2>
          <p><strong>Vorname:</strong> ${escapeHtml(cleanFirstName)}</p>
          <p><strong>Nachname:</strong> ${escapeHtml(cleanLastName)}</p>
          <p><strong>Thema:</strong> ${escapeHtml(cleanSubject)}</p>
          <hr />
          <p><strong>Nachricht:</strong></p>
          <p>${escapeHtml(cleanMessage).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);

      let parsedMessage = "";
      try {
        parsedMessage = JSON.parse(errorText)?.message ?? "";
      } catch {
        // ignore JSON parse failures
      }

      if (parsedMessage.includes("API key is invalid")) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY ist ungültig." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        parsedMessage.includes(
          "You can only send testing emails to your own email address"
        )
      ) {
        return new Response(
          JSON.stringify({
            error:
              "Resend-Testmodus aktiv: Bitte Domain verifizieren und RESEND_FROM_EMAIL auf deine Domain setzen oder CONTACT_TO_EMAIL auf deine Resend-Account-E-Mail ändern.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ error: "E-Mail konnte nicht gesendet werden." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await emailResponse.json();
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Ein Fehler ist aufgetreten." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
