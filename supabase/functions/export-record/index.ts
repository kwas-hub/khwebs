// Edge Function: export-record
// Generic exporter that pushes a record (document, appointment, news, form submission)
// to an external API endpoint configured per-tenant in api_endpoints.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Body = {
  endpointId?: string;
  queueId?: string;
  resource?: string;
  recordId?: string;
  test?: boolean;
};

async function buildPayload(admin: any, resource: string, recordId: string | null) {
  if (!recordId) {
    return { test: true, ts: new Date().toISOString(), resource };
  }
  const tableMap: Record<string, string> = {
    documents: 'pdf_documents',
    termine: 'appointments',
    news: 'content_blocks',
    formulare: 'form_submissions',
  };
  const table = tableMap[resource];
  if (!table) throw new Error(`Unbekannte Ressource: ${resource}`);
  const { data, error } = await admin.from(table).select('*').eq('id', recordId).maybeSingle();
  if (error) throw error;
  return { resource, record: data };
}

async function send(endpoint: any, payload: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint.auth_type === 'bearer' && endpoint.api_key) {
    headers['Authorization'] = `Bearer ${endpoint.api_key}`;
  } else if (endpoint.auth_type === 'basic' && endpoint.auth_username) {
    const tok = btoa(`${endpoint.auth_username}:${endpoint.auth_password ?? ''}`);
    headers['Authorization'] = `Basic ${tok}`;
  }
  const res = await fetch(endpoint.target_url, { method: 'POST', headers, body: JSON.stringify(payload) });
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  return { status: res.status, ok: res.ok, body: body.slice(0, 2000) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as Body;

    // Retry path: re-process an existing queue item
    if (body.queueId) {
      const { data: q } = await admin.from('export_queue').select('*').eq('id', body.queueId).maybeSingle();
      if (!q) throw new Error('Queue-Eintrag nicht gefunden');
      const { data: ep } = await admin.from('api_endpoints').select('*').eq('id', q.endpoint_id).maybeSingle();
      if (!ep) throw new Error('Endpunkt nicht gefunden');
      const result = await send(ep, q.payload);
      await admin.from('export_queue').update({
        status: result.ok ? 'success' : 'failed',
        response_status: result.status,
        last_error: result.ok ? null : result.body,
        retry_count: (q.retry_count ?? 0) + 1,
        processed_at: new Date().toISOString(),
      }).eq('id', body.queueId);
      return new Response(JSON.stringify({ ok: result.ok, status: result.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.endpointId) throw new Error('endpointId fehlt');
    const { data: ep } = await admin.from('api_endpoints').select('*').eq('id', body.endpointId).maybeSingle();
    if (!ep) throw new Error('Endpunkt nicht gefunden');
    if (!ep.enabled && !body.test) throw new Error('Endpunkt deaktiviert');

    const resource = body.resource ?? ep.resource;
    const payload = await buildPayload(admin, resource, body.recordId ?? null);

    const result = await send(ep, payload);

    // Persist to queue (skip pure tests with no record)
    if (body.recordId) {
      await admin.from('export_queue').insert({
        tenant_id: ep.tenant_id,
        resource,
        record_id: body.recordId,
        endpoint_id: ep.id,
        payload,
        status: result.ok ? 'success' : 'failed',
        response_status: result.status,
        last_error: result.ok ? null : result.body,
        retry_count: 1,
        processed_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: result.ok, status: result.status, body: result.body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('export-record error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
