-- Public leaderboard view — exposes only name + score + streak, no PII
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  name,
  dopamine_score,
  streak
FROM public.users
ORDER BY dopamine_score DESC
LIMIT 20;

GRANT SELECT ON public.leaderboard TO authenticated;
