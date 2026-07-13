import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireAuth(req: Request): Promise<string> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw { status: 401, message: 'Unauthorized' };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw { status: 401, message: 'Unauthorized' };

  return user.id;
}

export function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function badRequest(message: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function internalError(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'Internal error' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
