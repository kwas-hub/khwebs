// @ts-nocheck
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const renderTemplate = (str: string, vars: Record<string, string>) => {
  return (str || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
};

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, triggerKey, vars = {} } = await req.json();
    if (!to || !triggerKey) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tpl, error: tplErr } = await supabase
      .from("email_templates")
      .select("subject, body, is_html")
      .eq("trigger_key", triggerKey)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) {
      return new Response(JSON.stringify({ error: `Keine Vorlage für '${triggerKey}'` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = Deno.env.get("STRATO_EMAIL");
    const pass = Deno.env.get("STRATO_PASSWORD");
    if (!user || !pass) {
      return new Response(JSON.stringify({ error: "Mail-Server nicht konfiguriert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = renderTemplate(tpl.subject, vars);
    const rawBody = renderTemplate(tpl.body, vars);
    const html = tpl.is_html
      ? rawBody
      : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#333">${escapeHtml(rawBody).replace(/\n/g, "<br>")}</div>`;

    const transporter = nodemailer.createTransport({
      host: "smtp.strato.de", port: 465, secure: true, auth: { user, pass },
    });

    await transporter.sendMail({ from: user, to, subject, html });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-template-email error", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
