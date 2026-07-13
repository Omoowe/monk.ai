import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { buildSystemPrompt } from '../_shared/prompts.ts';
import { requireAuth, unauthorized, badRequest, internalError } from '../_shared/auth.ts';
import { checkMessageLimit } from '../_shared/limits.ts';
import type { ChatRequest } from '../_shared/types.ts';

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
    const { message, personality, context, history } = await req.json() as ChatRequest;

    if (!message || typeof message !== 'string') return badRequest('Invalid message', corsHeaders);
    if (message.length > 2000) return badRequest('Message too long', corsHeaders);

    const systemPrompt = buildSystemPrompt(personality, context);
    const priorTurns = (history ?? []).slice(-10);
    const messages = [
      ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: message },
    ];

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
        messages,
      }),
    });

    if (!response.ok) throw new Error('Upstream error');
    const data = await response.json();
    const text = data.content?.[0]?.text ?? `${context.userName}. Keep going.`;

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return internalError(corsHeaders);
  }
});
