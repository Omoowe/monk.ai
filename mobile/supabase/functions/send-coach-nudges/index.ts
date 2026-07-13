import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/exponent-push-notifications/v2/push/send';

const PERSONALITY_VOICE: Record<string, string> = {
  drill_sergeant: 'drill sergeant: blunt, aggressive care, military directness, zero fluff, bark their name',
  stoic_mentor:   'stoic philosopher-mentor: calm, principle-based, speaks in observations not commands',
  anime_sensei:   'anime sensei: dramatic absolute belief, "training arc" energy, high conviction',
  goggins:        'David Goggins-style: zero sympathy for excuses, raw, respect for effort, calls the mind weak',
  ceo_coach:      'elite executive coach: ROI language, data-driven, treats life like a high-growth startup',
  calm_therapist: 'warm therapist: acknowledge the feeling first, then redirect hard — never shame',
};

const FALLBACK_MORNING: Record<string, string> = {
  drill_sergeant: 'MORNING MISSION. Set your one thing. No excuses.',
  stoic_mentor:   'A day unintentioned is a day surrendered. Set your mission.',
  anime_sensei:   'Your arc begins NOW! Set your morning mission, warrior!',
  goggins:        "Sun's up. No check-in yet. Who's gonna carry the boats today?",
  ceo_coach:      'No morning mission = no ROI on your day. Fix that now.',
  calm_therapist: 'Good morning. 30 seconds to set your intention.',
};

const FALLBACK_EVENING: Record<string, string> = {
  drill_sergeant: 'DEBRIEF. Did you execute? Log it before midnight.',
  stoic_mentor:   'Evening reflection is where growth lives. Five minutes. Do it.',
  anime_sensei:   "The day's training is complete! Reflect on your power gained!",
  goggins:        "Day's done. Account for every rep. Did you stay hard?",
  ceo_coach:      "No debrief = no data. You can't optimize what you don't review.",
  calm_therapist: 'Before you rest — how did today go? Be honest with yourself.',
};

interface UserRow {
  id: string;
  name: string;
  personality: string;
  expo_push_token: string;
  streak: number;
  identity_statement: string;
  coach_memory: string;
}

async function generateNudge(
  apiKey: string,
  user: UserRow,
  type: 'morning' | 'evening',
  missionContext: string | null,
): Promise<string> {
  const personality = user.personality || 'stoic_mentor';
  const voice = PERSONALITY_VOICE[personality] ?? PERSONALITY_VOICE['stoic_mentor'];
  const fallbackMap = type === 'morning' ? FALLBACK_MORNING : FALLBACK_EVENING;
  const fallback = fallbackMap[personality] ?? fallbackMap['stoic_mentor'];

  const missionLine = missionContext
    ? type === 'morning'
      ? `Yesterday they planned: "${missionContext}" — did they close it?`
      : `This morning they committed to: "${missionContext}" — time to account for it.`
    : '';

  const identityLine = user.identity_statement
    ? `Their identity statement: "I am the type of person who ${user.identity_statement}".`
    : '';

  const memoryLine = user.coach_memory
    ? `What you know about them: ${user.coach_memory.slice(0, 150)}`
    : '';

  const prompt = `Write a personalized push notification from a ${voice}.

Name: ${user.name || 'Monk'} | Streak: ${user.streak ?? 0} days | Nudge type: ${type === 'morning' ? 'morning check-in reminder' : 'evening debrief reminder'}
${identityLine}
${missionLine}
${memoryLine}

Rules (non-negotiable):
- Max 28 words. Plain text only. No markdown, no asterisks, no quotes around the output.
- Use their name (${user.name || 'Monk'}) OR start with a direct statement about something specific.
- Reference ONE specific detail: their mission, identity statement, or streak number.
- Banned phrases: "keep going", "you've got this", "consistency is key", "great job", "don't forget".
- Sound exactly like the ${personality.replace('_', ' ')} voice.
- Output only the notification text — nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!response.ok) return fallback;
    const data = await response.json();
    const text: string = data.content?.[0]?.text?.trim() ?? '';
    // Sanity: must be meaningful and fit a push notification
    if (text.length >= 10 && text.length <= 220) return text;
    return fallback;
  } catch {
    return fallback;
  }
}

// Concurrency limiter — idx++ is safe in single-threaded JS event loop
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
  // Only accept cron invocations
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 });
  }

  const urlParams = new URL(req.url);
  const type = (urlParams.searchParams.get('type') ?? 'morning') as 'morning' | 'evening';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  // Fetch users with push tokens + personalization fields
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, personality, expo_push_token, streak, identity_statement, coach_memory')
    .not('expo_push_token', 'is', null)
    .eq('notify_coach_nudges', true);

  if (error || !users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const userIds = users.map((u: UserRow) => u.id);

  // Filter users who already completed today's check-in of this type
  const { data: doneCheckins } = await supabase
    .from('check_ins')
    .select('user_id')
    .eq('date', today)
    .eq('type', type)
    .in('user_id', userIds);

  const doneSet = new Set((doneCheckins ?? []).map((c: any) => c.user_id));
  const needNudge = (users as UserRow[]).filter((u) => !doneSet.has(u.id));

  if (!needNudge.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Fetch context mission for personalization:
  // morning nudge → yesterday's morning mission (what they planned yesterday)
  // evening nudge → today's morning mission (what they committed to this morning)
  const missionDate = type === 'morning' ? yesterday : today;
  const { data: missionCheckins } = await supabase
    .from('check_ins')
    .select('user_id, mission')
    .eq('date', missionDate)
    .eq('type', 'morning')
    .in('user_id', needNudge.map((u) => u.id));

  const missionMap = new Map<string, string>(
    (missionCheckins ?? [])
      .filter((c: any) => c.mission)
      .map((c: any) => [c.user_id, c.mission as string]),
  );

  const title = type === 'morning' ? 'Morning Mission' : 'Evening Debrief';

  // Generate personalized notifications — max 8 concurrent Claude calls
  const tasks = needNudge.map((u) => () =>
    generateNudge(apiKey, u, type, missionMap.get(u.id) ?? null).then((body) => ({
      to: u.expo_push_token,
      title,
      body,
      data: { type, url: 'monkai://checkin' },
      sound: 'default',
    }))
  );

  const messages = await pLimit(tasks, 8);

  // Expo accepts up to 100 messages per request
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

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
