import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer";

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
      return new Response(JSON.stringify({ error: "Alle Felder erforderlich" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const smtpUser = Deno.env.get("STRATO_EMAIL") || "hello@khwebs.de";
    const smtpPass = Deno.env.get("STRATO_PASSWORD");

    if (!smtpPass) {
      console.error("STRATO_PASSWORD missing");
      return new Response(JSON.stringify({ error: "Strato nicht konfiguriert" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ✅ ECHTER STRATO SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.strato.de",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass }
    });

    console.log("SMTP connecting...");

    await transporter.sendMail({
      from: smtpUser,
      to: "hello@khwebs.de",
      subject: `Kontaktanfrage: ${subject}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Vorname:</strong> ${firstName}</p>
        <p><strong>Nachname:</strong> ${lastName}</p>
        <p><strong>Thema:</strong> ${subject}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br>")}</p>
      `
    });

    console.log("✅ Email sent via Strato!");
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("SMTP Error:", error);
    return new Response(JSON.stringify({ error: "E-Mail Fehler" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});