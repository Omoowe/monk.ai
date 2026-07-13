// Centralised CORS headers for all Edge Functions.
// For a Bearer-token-authenticated native mobile API, * is acceptable (no cookie/CSRF
// risk). Update ALLOWED_ORIGIN env var to restrict if a web client is ever added.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin':  Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
