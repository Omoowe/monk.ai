-- ============================================================
-- Security fixes for Supabase advisor warnings
-- 1. Mutable search_path on 3 functions → add SET search_path = ''
-- 2. Trigger functions callable via RPC → REVOKE EXECUTE
-- 3. RPC functions callable by anon → REVOKE from anon only
-- ============================================================

-- ── Fix 1: search_path + security on update_habit_streak ────
CREATE OR REPLACE FUNCTION public.update_habit_streak(p_habit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_streak INT := 0;
  v_check_date DATE;
BEGIN
  v_check_date := CURRENT_DATE;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.habit_completions
      WHERE habit_id = p_habit_id
        AND date = v_check_date::TEXT
    );
    v_streak := v_streak + 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  END LOOP;

  UPDATE public.habits SET streak_days = v_streak WHERE id = p_habit_id;
END;
$$;

-- ── Fix 1: search_path + security on recalculate_user_stats ─
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_habits    INT;
  v_week_completed  INT;
  v_week_possible   INT;
  v_new_score       INT;
  v_max_streak      INT;
  v_week_start      TEXT;
BEGIN
  v_week_start := (CURRENT_DATE - INTERVAL '6 days')::TEXT;

  SELECT COUNT(*) INTO v_total_habits
  FROM public.habits WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_week_completed
  FROM public.habit_completions hc
  JOIN public.habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id AND hc.date >= v_week_start;

  v_week_possible := v_total_habits * 7;

  IF v_week_possible > 0 THEN
    v_new_score := LEAST(100, ROUND((v_week_completed::NUMERIC / v_week_possible) * 100));
  ELSE
    v_new_score := 50;
  END IF;

  SELECT COALESCE(MAX(streak_days), 0) INTO v_max_streak
  FROM public.habits WHERE user_id = p_user_id;

  UPDATE public.users
  SET dopamine_score = v_new_score,
      streak = v_max_streak
  WHERE id = p_user_id;
END;
$$;

-- ── Fix 1: search_path + security on on_habit_completion_change ─
CREATE OR REPLACE FUNCTION public.on_habit_completion_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_habit_id UUID;
  v_user_id  UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_habit_id := OLD.habit_id;
    v_user_id  := OLD.user_id;
  ELSE
    v_habit_id := NEW.habit_id;
    v_user_id  := NEW.user_id;
  END IF;

  PERFORM public.update_habit_streak(v_habit_id);
  PERFORM public.recalculate_user_stats(v_user_id);

  RETURN NULL;
END;
$$;

-- ── Fix 2: trigger-only functions — revoke public RPC access ─
-- handle_new_user and on_habit_completion_change fire via DB trigger only,
-- never via /rest/v1/rpc. Remove execute from anon + authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_habit_completion_change() FROM anon, authenticated;

-- ── Fix 3: RPC functions — revoke anon, keep authenticated ──
-- App calls these via supabase.rpc() when signed in; anon has no business calling them.
REVOKE EXECUTE ON FUNCTION public.update_habit_streak(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_user_stats(UUID) FROM anon;

-- ── Fix 4: rls_auto_enable — Supabase-internal utility ───────
-- Revoke from anon + authenticated if it exists (Supabase may own it).
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN
  NULL; -- function doesn't exist in this schema, skip
END;
$$;
