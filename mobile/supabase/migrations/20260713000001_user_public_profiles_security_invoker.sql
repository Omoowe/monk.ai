-- Fix SECURITY DEFINER on user_public_profiles view (Supabase security advisor)
CREATE OR REPLACE VIEW public.user_public_profiles
  WITH (security_invoker = true)
AS
SELECT id, name, username, streak, dopamine_score
FROM public.users
WHERE username IS NOT NULL;

GRANT SELECT ON public.user_public_profiles TO authenticated;
