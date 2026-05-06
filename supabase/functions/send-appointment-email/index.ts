// @ts-nocheck
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, firstName, lastName, salutation, date, time, status, customMessage } = await req.json();
    if (!to || !status) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = Deno.env.get("STRATO_EMAIL");
    const pass = Deno.env.get("STRATO_PASSWORD");
    if (!user || !pass) {
      return new Response(JSON.stringify({ error: "Mail-Server nicht konfiguriert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.strato.de",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const niceDate = date ? new Date(date).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";
    const niceTime = (time || "").slice(0, 5);
    const greet = `${salutation || ""} ${firstName || ""} ${lastName || ""}`.trim();

    let subject = "";
    let bodyHtml = "";

    if (status === "confirmed") {
      subject = "Ihr Termin wurde bestätigt";
      bodyHtml = `
        <h2>Termin bestätigt</h2>
        <p>Sehr geehrte/r ${greet},</p>
        <p>wir freuen uns, Ihnen Ihren Termin bestätigen zu können:</p>
        <p><strong>${niceDate} um ${niceTime} Uhr</strong></p>
        ${customMessage ? `<p>${customMessage.replace(/\n/g, "<br>")}</p>` : ""}
        <p>Bei Fragen oder Änderungen melden Sie sich gerne.</p>
        <p>Mit freundlichen Grüßen<br>KH Webs</p>
      `;
    } else if (status === "cancelled") {
      subject = "Ihre Terminanfrage wurde abgelehnt";
      bodyHtml = `
        <h2>Termin abgelehnt</h2>
        <p>Sehr geehrte/r ${greet},</p>
        <p>leider können wir Ihre Terminanfrage für <strong>${niceDate} um ${niceTime} Uhr</strong> nicht bestätigen.</p>
        ${customMessage ? `<p>${customMessage.replace(/\n/g, "<br>")}</p>` : "<p>Gerne können Sie eine neue Anfrage zu einem anderen Zeitpunkt stellen.</p>"}
        <p>Mit freundlichen Grüßen<br>KH Webs</p>
      `;
    } else {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await transporter.sendMail({
      from: user,
      to,
      subject,
      html: bodyHtml,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-appointment-email error", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
