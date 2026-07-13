import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { buildEveningFeedbackPrompt } from '../_shared/prompts.ts';
import { requireAuth, unauthorized, internalError } from '../_shared/auth.ts';
import { checkMessageLimit } from '../_shared/limits.ts';
import type { EveningFeedbackRequest } from '../_shared/types.ts';

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
    const { personality, context, mission, completed, reason, completedHabits, totalHabits } =
      await req.json() as EveningFeedbackRequest;
    const systemPrompt = buildEveningFeedbackPrompt(personality, context, mission, completed, reason, completedHabits, totalHabits);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Give me my evening debrief.' }],
      }),
    });

    if (!response.ok) throw new Error('Upstream error');
    const data = await response.json();
    const text = data.content?.[0]?.text ?? (
      completed
        ? `${context.userName}. "${mission}" — done. ${context.streak}-day streak holds.`
        : `${context.userName}. "${reason}" — your coach has heard that before.`
    );

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return internalError(corsHeaders);
  }
});
