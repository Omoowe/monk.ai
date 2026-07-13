import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/exponent-push-notifications/v2/push/send';

const DEADLINE_MESSAGES: Record<string, (days: number, goalName: string) => string> = {
  drill_sergeant: (d, g) => d === 1
    ? `LAST CHANCE. "${g}" deadline tomorrow. Execute or fail.`
    : `7 DAYS. "${g}" — tick tock. No extensions.`,
  stoic_mentor: (d, g) => d === 1
    ? `Tomorrow is the reckoning for "${g}". What you do now defines the result.`
    : `One week remains for "${g}". Use it with intention.`,
  anime_sensei: (d, g) => d === 1
    ? `The final battle approaches! "${g}" — TOMORROW! Give everything!`
    : `7 days remain in your arc! "${g}" is waiting for your final push!`,
  goggins: (d, g) => d === 1
    ? `"${g}" — tomorrow. Who's gonna carry the boats? You, or no one.`
    : `7 days left on "${g}". Most would quit now. You're not most.`,
  ceo_coach: (d, g) => d === 1
    ? `"${g}" closes tomorrow. Final sprint — ROI on the line.`
    : `"${g}" — 7-day warning. Lock in execution mode now.`,
  calm_therapist: (d, g) => d === 1
    ? `"${g}" is due tomorrow. Whatever happens, you've grown through this.`
    : `7 days left on "${g}". You've got this — steady focus.`,
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

  const today = new Date();
  const in1Day = new Date(today); in1Day.setDate(today.getDate() + 1);
  const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // Goals due in exactly 1 or 7 days, progress < 100, user has push token
  const { data: goals } = await supabase
    .from('goals')
    .select('id, name, deadline, user_id')
    .in('deadline', [fmt(in1Day), fmt(in7Days)])
    .lt('progress', 100);

  if (!goals?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const userIds = [...new Set(goals.map((g: any) => g.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, personality, expo_push_token, notify_coach_nudges')
    .in('id', userIds)
    .not('expo_push_token', 'is', null)
    .eq('notify_coach_nudges', true);

  if (!users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const userMap = new Map(users.map((u: any) => [u.id, u]));
  const messages = [];

  for (const goal of goals) {
    const user = userMap.get(goal.user_id);
    if (!user) continue;
    const daysLeft = goal.deadline === fmt(in1Day) ? 1 : 7;
    const fn = DEADLINE_MESSAGES[user.personality as string] ?? DEADLINE_MESSAGES['stoic_mentor'];
    messages.push({
      to: user.expo_push_token,
      title: daysLeft === 1 ? '⏰ Goal Deadline Tomorrow' : '📅 Goal Deadline in 7 Days',
      body: fn(daysLeft, goal.name),
      data: { url: 'monkai://goals' },
      sound: 'default',
    });
  }

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
