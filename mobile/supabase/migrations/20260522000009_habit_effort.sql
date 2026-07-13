-- Effort level on habit completions (1=low, 2=med, 3=high, default 2)
ALTER TABLE public.habit_completions
  ADD COLUMN IF NOT EXISTS effort_level INTEGER NOT NULL DEFAULT 2
  CONSTRAINT effort_level_range CHECK (effort_level BETWEEN 1 AND 3);
