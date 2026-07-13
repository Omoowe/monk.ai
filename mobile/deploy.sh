#!/usr/bin/env bash
# Monk.ai — Supabase deploy script
# Run from mobile/ directory: bash deploy.sh
set -e

echo "==> Pushing database migrations..."
supabase db push

echo "==> Deploying edge functions..."
supabase functions deploy chat
supabase functions deploy morning-brief
supabase functions deploy evening-feedback
supabase functions deploy goal-advice
supabase functions deploy pep-talk
supabase functions deploy review
supabase functions deploy transcribe
supabase functions deploy update-coach-memory
supabase functions deploy delete-account
supabase functions deploy revenuecat-webhook
supabase functions deploy send-coach-nudges
supabase functions deploy send-goal-alerts
supabase functions deploy send-review-reminder

echo ""
echo "==> All functions deployed."
echo ""
echo "Manual step — schedule these crons in the Supabase dashboard:"
echo "  send-coach-nudges    : 0 8,20 * * *   (8 AM + 8 PM daily)"
echo "  send-review-reminder : 0 9 * * 0       (9 AM every Sunday)"
echo "  send-goal-alerts     : 0 9 * * *       (9 AM daily)"
