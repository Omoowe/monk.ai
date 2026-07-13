ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;
