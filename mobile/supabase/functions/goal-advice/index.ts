import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { buildSystemPrompt } from '../_shared/prompts.ts';
import { requireAuth, unauthorized, internalError } from '../_shared/auth.ts';
import { checkMessageLimit } from '../_shared/limits.ts';

import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch {
    return unauthorized(corsHeaders);
  }

  const limited = await checkMessageLimit(userId, corsHeaders);
  if (limited) return limited;

  try {
    const { personality, context, goalName, goalProgress, goalTarget, goalDeadline, milestone } = await req.json();

    const systemPrompt = buildSystemPrompt(personality, context);

    let daysInfo = '';
    if (goalDeadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(goalDeadline + 'T00:00:00');
      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
      daysInfo = daysLeft > 0 ? `${daysLeft} days remaining (deadline: ${goalDeadline})` : `${Math.abs(daysLeft)} days overdue`;
    }

    const userMessage = milestone
      ? `React to this progress milestone in character: goal "${goalName}", just hit ${milestone}% — ${milestone === 100 ? 'COMPLETE!' : `${milestone}% milestone reached`}. Target: ${goalTarget ?? 'not set'}. Give a punchy ${milestone === 100 ? 'celebration' : 'encouragement'} — under 80 words, stay in your coaching voice.`
      : `Give me specific, actionable advice for this goal: "${goalName}". Progress: ${goalProgress}%. Target: ${goalTarget ?? 'not set'}. ${daysInfo ? `Time left: ${daysInfo}.` : ''} Keep it under 120 words — direct, no fluff.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) throw new Error('Upstream error');
    const data = await response.json();
    const text = data.content?.[0]?.text ?? `${goalProgress}% on "${goalName}". Keep pushing.`;

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return internalError(corsHeaders);
  }
});
