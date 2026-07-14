import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/exponent-push-notifications/v2/push/send';

// ── Personality voices tuned for "you went dark" energy ──────
const PERSONALITY_VOICE: Record<string, string> = {
  drill_sergeant: 'drill sergeant who is furious the recruit has gone AWOL — aggressive, military, zero tolerance',
  stoic_mentor:   'stoic mentor making a cold observation that absence is a deliberate choice with consequences',
  anime_sensei:   'anime sensei in shock and disappointment that their student vanished mid training arc',
  goggins:        'David Goggins with zero mercy for someone who chose comfort over discipline for 2+ days',
  ceo_coach:      'elite CEO coach treating each missed day as lost revenue and compounding ROI gap',
  calm_therapist: 'warm therapist doing a genuine welfare check — concerned, no shame, but firm redirect',
};

const FALLBACK: Record<string, string> = {
  drill_sergeant: "AWOL 2 days. That's not rest. That's quitting. Get back in formation.",
  stoic_mentor:   "Two days of silence. The person you want to be doesn't disappear when it gets hard.",
  anime_sensei:   "Sensei has been waiting... your training arc does not pause itself!",
  goggins:        "2 days gone. The weak mind found an excuse. You know what to do.",
  ceo_coach:      "48 hours of no data = 48 hours of negative compounding. Open the app.",
  calm_therapist: "Hey. Haven't heard from you in a couple of days. How are you doing?",
};

interface UserRow {
  id: string;
  name: string;
  personality: string;
  expo_push_token: string;
  streak: number;
  identity_statement: string | null;
  coach_memory: string | null;
}

interface HabitRow { name: string; streak_days: number; }
interface BattleContext { opponentName: string; myDone: number; oppDone: number; daysLeft: number; }

async function generateDarkNudge(
  apiKey: string,
  user: UserRow,
  darkDays: number,
  habits: HabitRow[],
  battle: BattleContext | null,
): Promise<string> {
  const personality = user.personality || 'stoic_mentor';
  const voice = PERSONALITY_VOICE[personality] ?? PERSONALITY_VOICE['stoic_mentor'];
  const fallback = FALLBACK[personality] ?? FALLBACK['stoic_mentor'];

  const habitLine = habits.length > 0
    ? `Unlogged habits (${darkDays}d gap): ${habits.slice(0, 3).map(h => `"${h.name}" (${h.streak_days}d streak)`).join(', ')}.`
    : '';

  const battleLine = battle
    ? `BATTLE: ${battle.myDone < battle.oppDone
        ? `losing ${battle.myDone}–${battle.oppDone}`
        : `winning ${battle.myDone}–${battle.oppDone}`} habits vs ${battle.opponentName} — ${battle.daysLeft}d left.`
    : '';

  const streakLine = user.streak > 0
    ? `${user.streak}-day streak breaks if they don't act today.`
    : '';

  const identityLine = user.identity_statement
    ? `Identity: "I am the type of person who ${user.identity_statement}".`
    : '';

  const memoryLine = user.coach_memory
    ? `Coach knows: ${user.coach_memory.slice(0, 180)}`
    : '';

  const prompt = `Write a "where have you been?" push notification from a ${voice}.

${user.name || 'User'} has been SILENT for ${darkDays} days. No check-ins. No habit logs.
${streakLine}
${habitLine}
${battleLine}
${identityLine}
${memoryLine}

RULES (strict):
- Max 28 words. Plain text only. No markdown, no asterisks, no emoji, no quotes.
- MUST reference at least ONE specific detail: a habit name, the battle opponent name, or their streak number.
- Make them FEEL the cost of disappearing.
- Banned phrases: "keep going", "you've got this", "consistency is key", "don't forget", "check in".
- Output ONLY the notification text — nothing else.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text: string = data.content?.[0]?.text?.trim() ?? '';
    return text.length >= 10 && text.length <= 220 ? text : fallback;
  } catch {
    return fallback;
  }
}

async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= tasks.length) break;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const today      = new Date().toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0];
  const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().split('T')[0];

  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, personality, expo_push_token, streak, identity_statement, coach_memory')
    .not('expo_push_token', 'is', null)
    .eq('notify_coach_nudges', true);

  if (error || !users?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_users' }), { status: 200 });
  }

  const userIds = (users as UserRow[]).map(u => u.id);

  // Was active 2–6 days ago, AND has NOT checked in the last 2 days
  const [{ data: recentActive }, { data: recentCheckins }] = await Promise.all([
    supabase.from('check_ins').select('user_id')
      .gte('date', sixDaysAgo).lte('date', twoDaysAgo).in('user_id', userIds),
    supabase.from('check_ins').select('user_id')
      .gte('date', twoDaysAgo).lte('date', today).in('user_id', userIds),
  ]);

  const wasActiveIds    = new Set((recentActive  ?? []).map((r: any) => r.user_id));
  const recentlyActiveIds = new Set((recentCheckins ?? []).map((r: any) => r.user_id));
  const darkUsers = (users as UserRow[]).filter(
    u => wasActiveIds.has(u.id) && !recentlyActiveIds.has(u.id),
  );

  if (!darkUsers.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_dark_users' }), { status: 200 });
  }

  const darkUserIds = darkUsers.map(u => u.id);

  // Fetch habits for dark users
  const { data: habits } = await supabase
    .from('habits').select('user_id, name, streak_days').in('user_id', darkUserIds);

  const habitMap: Record<string, HabitRow[]> = {};
  (habits ?? []).forEach((h: any) => {
    if (!habitMap[h.user_id]) habitMap[h.user_id] = [];
    habitMap[h.user_id].push({ name: h.name, streak_days: h.streak_days ?? 0 });
  });

  // Fetch active battles
  const { data: battles } = await supabase
    .from('challenges').select('challenger_id, challenged_id, duration_days, end_date, challenger_habits_done, challenged_habits_done')
    .eq('status', 'active').gte('end_date', today)
    .or(darkUserIds.map(id => `challenger_id.eq.${id},challenged_id.eq.${id}`).join(','));

  const battleList = (battles ?? []) as any[];
  const opponentIds = [...new Set(battleList.map(b =>
    darkUserIds.includes(b.challenger_id) ? b.challenged_id : b.challenger_id,
  ))];

  const opponentNames: Record<string, string> = {};
  if (opponentIds.length > 0) {
    const { data: opp } = await supabase
      .from('user_public_profiles').select('id, name').in('id', opponentIds);
    (opp ?? []).forEach((p: any) => { opponentNames[p.id] = p.name; });
  }

  const battleMap: Record<string, BattleContext> = {};
  battleList.forEach(b => {
    const isChallenger = darkUserIds.includes(b.challenger_id);
    const userId    = isChallenger ? b.challenger_id : b.challenged_id;
    const opponentId = isChallenger ? b.challenged_id : b.challenger_id;
    if (battleMap[userId]) return;
    battleMap[userId] = {
      opponentName: opponentNames[opponentId] ?? 'your opponent',
      myDone:  isChallenger ? b.challenger_habits_done : b.challenged_habits_done,
      oppDone: isChallenger ? b.challenged_habits_done : b.challenger_habits_done,
      daysLeft: Math.max(0, Math.ceil((new Date(b.end_date).getTime() - Date.now()) / 86_400_000)),
    };
  });

  // Last check-in date per dark user to calculate darkness depth
  const { data: lastCheckins } = await supabase
    .from('check_ins').select('user_id, date')
    .gte('date', sixDaysAgo).in('user_id', darkUserIds)
    .order('date', { ascending: false });

  const lastCheckinMap: Record<string, string> = {};
  (lastCheckins ?? []).forEach((c: any) => {
    if (!lastCheckinMap[c.user_id]) lastCheckinMap[c.user_id] = c.date;
  });

  function getDarkDays(userId: string): number {
    const last = lastCheckinMap[userId];
    if (!last) return 3;
    return Math.max(2, Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86_400_000));
  }

  // Generate personalized nudges — max 6 concurrent Claude calls
  const tasks = darkUsers.map(u => () =>
    generateDarkNudge(apiKey, u, getDarkDays(u.id), habitMap[u.id] ?? [], battleMap[u.id] ?? null)
      .then(body => ({
        to: u.expo_push_token,
        title: 'Your coach is looking for you.',
        body,
        data: { type: 'dark_nudge', url: 'monkai://checkin' },
        sound: 'default',
        priority: 'high',
      }))
  );

  const messages = await pLimit(tasks, 6);

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
  }

  return new Response(JSON.stringify({ sent, dark_users: darkUsers.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
