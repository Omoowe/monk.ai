ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT NULL;

-- Rebuild leaderboard view with avatar
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  name,
  dopamine_score,
  streak,
  avatar
FROM public.users
WHERE show_on_leaderboard = true
ORDER BY dopamine_score DESC
LIMIT 20;

GRANT SELECT ON public.leaderboard TO authenticated;
