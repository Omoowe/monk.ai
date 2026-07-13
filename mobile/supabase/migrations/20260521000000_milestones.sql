ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS milestones_earned TEXT[] NOT NULL DEFAULT '{}';
