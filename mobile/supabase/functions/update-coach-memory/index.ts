import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth, unauthorized, internalError } from '../_shared/auth.ts';

import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch {
    return unauthorized(corsHeaders);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch existing memory + recent messages (last 30)
    const [{ data: userData }, { data: messages }] = await Promise.all([
      supabase.from('users').select('coach_memory, name').eq('id', userId).single(),
      supabase
        .from('chat_messages')
        .select('role, text, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (!messages?.length) {
      return new Response(JSON.stringify({ updated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingMemory = userData?.coach_memory ?? '';
    const userName = userData?.name ?? 'the user';
    const chronological = [...messages].reverse();
    const transcript = chronological
      .map((m: any) => `${m.role === 'user' ? userName : 'Coach'}: ${m.text}`)
      .join('\n');

    const memoryPrompt = `You are distilling a coaching relationship into a persistent memory note.

${existingMemory ? `CURRENT MEMORY:\n${existingMemory}\n\n` : ''}RECENT CONVERSATION:\n${transcript}

Write a 120-word coaching memory note in third person. Capture:
- Specific recurring excuses or sabotage patterns (name them verbatim if possible)
- Emotional triggers or avoidance behaviors observed
- Commitments made to the coach and whether followed through
- What's working — habits, routines, or reframes that landed
- What keeps failing — specific patterns, not generic struggles
- Relationship depth cues — how they respond to pressure, praise, confrontation

Be precise and forensic. No generic observations. This note is injected into future coaching sessions so the coach remembers who this person really is.

Output ONLY the memory note. No preamble, no labels.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // cheaper for background memory compression
        max_tokens: 300,
        messages: [{ role: 'user', content: memoryPrompt }],
      }),
    });

    if (!aiRes.ok) throw new Error('Upstream error');
    const aiData = await aiRes.json();
    const newMemory = aiData.content?.[0]?.text?.trim() ?? existingMemory;

    await supabase.from('users').update({ coach_memory: newMemory }).eq('id', userId);

    return new Response(JSON.stringify({ updated: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return internalError(corsHeaders);
  }
});
