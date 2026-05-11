import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const sys = `You are a precise OCR engine. Extract EVERY individual WORD from the image as its own item.
For EACH word return a tight bounding box that snugly encloses ONLY that word's glyphs (no surrounding whitespace, no neighbouring words).
Coordinates MUST be RELATIVE 0..1 of the image dimensions (x=left, y=top, w=width, h=height).
Do NOT group words into lines or paragraphs. Return up to 600 word entries.
Use the tool 'ocr_result'. 'full_text' should reconstruct the page text with line breaks preserved.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: [
            { type: "text", text: "OCR this page. Return one item per WORD with a tight bbox via the tool." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ]},
        ],
        tools: [{
          type: "function",
          function: {
            name: "ocr_result",
            description: "Return per-word OCR results.",
            parameters: {
              type: "object",
              properties: {
                full_text: { type: "string" },
                words: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      bbox: {
                        type: "object",
                        properties: {
                          x: { type: "number" }, y: { type: "number" },
                          w: { type: "number" }, h: { type: "number" },
                        },
                        required: ["x","y","w","h"], additionalProperties: false,
                      },
                    },
                    required: ["text","bbox"], additionalProperties: false,
                  },
                },
              },
              required: ["full_text","words"], additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "ocr_result" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit – bitte später erneut versuchen" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Lovable AI Guthaben aufgebraucht" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI Gateway Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { full_text: "", words: [] };

    // Backwards-compat: also expose as `blocks`
    return new Response(JSON.stringify({ ...args, blocks: args.words ?? [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("pdf-ocr error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
