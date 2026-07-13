import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { buildWeeklyReviewPrompt } from '../_shared/prompts.ts';
import { requireAuth, unauthorized, internalError } from '../_shared/auth.ts';
import { checkProOnly } from '../_shared/limits.ts';
import type { ReviewRequest } from '../_shared/types.ts';

import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch {
    return unauthorized(corsHeaders);
  }

  const proBlock = await checkProOnly(userId, corsHeaders);
  if (proBlock) return proBlock;

  try {
    const { personality, context, weekTotal, weekMax, failedMissions, failureReasons } =
      await req.json() as ReviewRequest;
    const systemPrompt = buildWeeklyReviewPrompt(personality, context, weekTotal, weekMax, failedMissions, failureReasons);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Give me my weekly review.' }],
      }),
    });

    if (!response.ok) throw new Error('Upstream error');
    const data = await response.json();
    const pct = weekMax > 0 ? Math.round((weekTotal / weekMax) * 100) : 0;
    const text = data.content?.[0]?.text ?? `${context.userName}: ${pct}% this week. The gap is the gap. Close it next week.`;

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return internalError(corsHeaders);
  }
});
