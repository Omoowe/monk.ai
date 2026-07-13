import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FREE_DAILY_LIMIT = 10;

/**
 * Check message limit for free users. Increments counter if allowed.
 * Uses service role key to bypass RLS for counter updates.
 * Returns a Response if blocked (caller should return it immediately),
 * or null if the request is allowed to proceed.
 */
export async function checkMessageLimit(
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: user } = await supabase
    .from('users')
    .select('is_pro, daily_messages, messages_reset_date')
    .eq('id', userId)
    .single();

  if (!user) return limitedResponse(corsHeaders);
  if (user.is_pro) return null; // pro = unlimited

  const today = new Date().toISOString().split('T')[0];

  if (user.messages_reset_date !== today) {
    // New day — reset counter atomically and allow
    await supabase
      .from('users')
      .update({ daily_messages: 1, messages_reset_date: today })
      .eq('id', userId)
      .eq('messages_reset_date', user.messages_reset_date); // guard against concurrent reset
    return null;
  }

  if (user.daily_messages >= FREE_DAILY_LIMIT) {
    return limitedResponse(corsHeaders);
  }

  // Atomic increment: only update if count hasn't changed since we read it
  const { count } = await supabase
    .from('users')
    .update({ daily_messages: user.daily_messages + 1 })
    .eq('id', userId)
    .eq('daily_messages', user.daily_messages) // optimistic-lock: retry if raced
    .select('id', { count: 'exact', head: true });

  if (!count) {
    // Race detected — re-read and check limit
    const { data: fresh } = await supabase
      .from('users').select('daily_messages').eq('id', userId).single();
    if ((fresh?.daily_messages ?? 0) >= FREE_DAILY_LIMIT) return limitedResponse(corsHeaders);
  }

  return null;
}

export async function checkProOnly(
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: user } = await supabase.from('users').select('is_pro').eq('id', userId).single();
  if (!user || !user.is_pro) {
    return new Response(
      JSON.stringify({ limitReached: true, reason: 'pro_required' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  return null;
}


function limitedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ limitReached: true, limit: FREE_DAILY_LIMIT }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
