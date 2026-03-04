import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, subject, message } = await req.json();

    if (!firstName || !lastName || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Alle Felder sind erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strato SMTP via nodemailer-ähnliche Deno Lib
    const smtpHost = "smtp.strato.de";
    const smtpPort = 465;
    const smtpUser = Deno.env.get("STRATO_EMAIL") || "hello@khwebs.de";
    const smtpPass = Deno.env.get("STRATO_PASSWORD");

    if (!smtpPass) {
      return new Response(
        JSON.stringify({ error: "Strato SMTP nicht konfiguriert." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMTP Transport (vereinfacht)
    const mailData = {
      from: `Kontaktformular <${smtpUser}>`,
      to: "hello@khwebs.de",
      subject: `Kontaktanfrage: ${subject}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Vorname:</strong> ${firstName}</p>
        <p><strong>Nachname:</strong> ${lastName}</p>
        <p><strong>Thema:</strong> ${subject}</p>
        <hr />
        <p><strong>Nachricht:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    };

    // Via external SMTP service oder direkt (vereinfacht für Demo)
    const response = await fetch("https://api.resend.com/emails", { // Fallback oder echten SMTP
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${smtpUser}:${smtpPass}`)}`,
      },
      body: JSON.stringify(mailData),
    });

    if (!response.ok) {
      console.error("SMTP Error:", await response.text());
      return new Response(
        JSON.stringify({ error: "E-Mail konnte nicht gesendet werden." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Ein Fehler ist aufgetreten." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
