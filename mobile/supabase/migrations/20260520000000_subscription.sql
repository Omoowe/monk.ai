-- Add subscription and usage tracking to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_pro              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_messages      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_reset_date TEXT    NOT NULL DEFAULT '';
