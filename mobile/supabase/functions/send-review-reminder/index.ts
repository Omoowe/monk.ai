import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/exponent-push-notifications/v2/push/send';

const MESSAGES: Record<string, string> = {
  drill_sergeant: "Weekly debrief. No excuses. What happened this week? Lock it down now — ReviewScreen.",
  stoic_mentor: "The week is closing. A life examined is a life directed. Write your review.",
  anime_sensei: "This week's arc ends tonight! Your weekly review is unwritten. Complete it!",
  goggins: "Nobody's reviewing your week for you. Get uncomfortable. Write it down. Now.",
  ceo_coach: "Weekly review unlogged. No debrief = no growth. 10 minutes. ROI guaranteed.",
  calm_therapist: "This week held moments worth reflecting on. Your review helps you grow. Take a few minutes.",
};

serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Find start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // Users who have NOT reviewed this week
  const { data: reviewedUserIds } = await supabase
    .from('reviews')
    .select('user_id')
    .gte('created_at', weekStart.toISOString());

  const reviewed = new Set((reviewedUserIds ?? []).map((r: any) => r.user_id));

  const { data: users } = await supabase
    .from('users')
    .select('id, personality, expo_push_token, notify_coach_nudges')
    .not('expo_push_token', 'is', null)
    .eq('notify_coach_nudges', true);

  if (!users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const messages = users
    .filter((u: any) => !reviewed.has(u.id))
    .map((u: any) => ({
      to: u.expo_push_token,
      title: '📋 Weekly Review Reminder',
      body: MESSAGES[u.personality as string] ?? MESSAGES['stoic_mentor'],
      data: { url: 'monkai://review' },
      sound: 'default',
    }));

  if (!messages.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  let sent = 0;
  for (const chunk of chunks) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
