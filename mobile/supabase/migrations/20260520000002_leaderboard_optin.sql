-- Add opt-out column (default opted in)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT true;

-- Rebuild view to respect opt-out
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  name,
  dopamine_score,
  streak
FROM public.users
WHERE show_on_leaderboard = true
ORDER BY dopamine_score DESC
LIMIT 20;

GRANT SELECT ON public.leaderboard TO authenticated;
