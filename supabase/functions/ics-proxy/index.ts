// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const u = new URL(req.url);
    const target = u.searchParams.get("url");
    if (!target) return new Response("Missing url", { status: 400, headers: corsHeaders });
    let fixed = target.replace(/^webcal:\/\//i, "https://");
    const res = await fetch(fixed, { headers: { Accept: "text/calendar,*/*" } });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500, headers: corsHeaders });
  }
});
