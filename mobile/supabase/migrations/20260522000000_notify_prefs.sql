ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_coach_nudges BOOLEAN DEFAULT true;
