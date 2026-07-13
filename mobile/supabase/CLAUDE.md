# supabase/functions/ — Deno Edge Functions

## What these are

All AI proxy and background job logic lives here.
These run on Supabase infrastructure (Deno runtime), not Node.js.

## Runtime

- Deno (not Node.js) — use Deno-compatible imports
- No `package.json` / `node_modules` — deps via URL or `npm:` specifier
- Shared utilities in `_shared/` — imported by all functions

## Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `chat` | HTTP POST | Main AI coaching chat |
| `morning-brief` | HTTP POST | Morning check-in AI response |
| `evening-feedback` | HTTP POST | Evening debrief AI response |
| `goal-advice` | HTTP POST | AI advice on a specific goal |
| `pep-talk` | HTTP POST | Quick motivational message |
| `review` | HTTP POST | Weekly AI analysis |
| `transcribe` | HTTP POST | Whisper audio transcription |
| `update-coach-memory` | HTTP POST | Update persistent coach memory |
| `send-coach-nudges` | Cron | Scheduled push notifications |
| `send-goal-alerts` | Cron | Goal deadline alerts |
| `send-review-reminder` | Cron | Weekly review prompt |
| `revenuecat-webhook` | HTTP POST | RevenueCat purchase events |
| `delete-account` | HTTP POST | GDPR account deletion |

## Shared utilities

`_shared/cors.ts` — CORS headers (exports `corsHeaders`)
```ts
import { corsHeaders } from '../_shared/cors.ts';
// Every function must handle OPTIONS preflight:
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

## Pattern for every function

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // 1. Verify JWT (supabase auth)
  // 2. Read body
  // 3. Call Anthropic (via env secret ANTHROPIC_API_KEY)
  // 4. Return JSON
});
```

## Environment secrets

Set in Supabase dashboard (Secrets), not in `.env`:
- `ANTHROPIC_API_KEY` — Claude API key (NEVER in mobile bundle)
- `OPENAI_API_KEY` — Whisper transcription (if used)
- `REVENUECAT_WEBHOOK_SECRET` — webhook validation

## Deploy

```bash
# From mobile/ directory
supabase functions deploy <function-name>
supabase functions deploy --all              # deploy all

# Local dev
supabase functions serve                     # serves all functions locally
supabase functions serve <function-name>     # single function
```

## Lint / type check

Deno TypeScript errors shown by `mcp__ide__getDiagnostics` are expected in this directory — the workspace tsconfig does not include Deno types.

To type-check a function locally:
```bash
deno check functions/<name>/index.ts
```

Deno LSP: configure your editor to use the Deno extension for `supabase/functions/` path.

## Conventions

- Always handle CORS OPTIONS preflight first
- Validate JWT before touching any data
- Return `{ error: string }` with appropriate HTTP status on failure
- Use `Deno.env.get('KEY')` for secrets — never hardcode
- Streaming responses: use `ReadableStream` for long AI responses
