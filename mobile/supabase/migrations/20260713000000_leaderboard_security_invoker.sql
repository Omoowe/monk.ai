-- Fix: leaderboard view used SECURITY DEFINER (owner privileges bypass RLS).
-- Add a SELECT policy so authenticated users can read opt-in public rows,
-- then recreate the view with security_invoker = true so RLS is enforced
-- on the querying user instead of the view owner.

-- Allow authenticated users to read rows where the user opted into the leaderboard.
-- Users who set show_on_leaderboard = true have consented to public visibility.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_public_read'
  ) THEN
    CREATE POLICY "users_public_read" ON public.users
      FOR SELECT
      USING (show_on_leaderboard = true);
  END IF;
END $$;

-- Recreate leaderboard view with security_invoker = true.
-- RLS now runs as the querying user, not the view owner.
CREATE OR REPLACE VIEW public.leaderboard
  WITH (security_invoker = true)
AS
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
