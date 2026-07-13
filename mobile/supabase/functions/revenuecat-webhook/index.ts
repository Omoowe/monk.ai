import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // still do a dummy comparison to avoid length-based timing leak
    let _ = 0;
    for (let i = 0; i < ab.length; i++) _ |= ab[i];
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < ab.length; i++) mismatch |= ab[i] ^ bb[i];
  return mismatch === 0;
}

// RevenueCat event types that mean the user is/isn't Pro
const PRO_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
]);
const REVOKE_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
]);

serve(async (req: Request) => {
  // Verify RevenueCat webhook secret
  // Set RC_WEBHOOK_SECRET in Supabase Edge Function secrets
  // Set the same value in RevenueCat Dashboard → Project → Webhooks → Authorization header
  const secret = Deno.env.get('RC_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook secret not configured', { status: 500 });
  if (!timingSafeEqual(req.headers.get('authorization') ?? '', secret)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();
    const event = body?.event;
    if (!event) return new Response('No event', { status: 400 });

    const eventType: string = event.type;
    const appUserId: string = event.app_user_id; // We set this to Supabase user ID via Purchases.logIn()

    if (!appUserId) return new Response('No user ID', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (PRO_EVENTS.has(eventType)) {
      await supabase.from('users').update({ is_pro: true }).eq('id', appUserId);
    } else if (REVOKE_EVENTS.has(eventType)) {
      await supabase.from('users').update({ is_pro: false }).eq('id', appUserId);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
});
