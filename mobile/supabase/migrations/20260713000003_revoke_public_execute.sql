-- ============================================================
-- Root fix: PostgreSQL grants EXECUTE to PUBLIC by default.
-- Previous migration revoked from named roles only — not enough.
-- This migration:
--   1. REVOKEs EXECUTE FROM PUBLIC on all 5 flagged functions
--   2. Switches update_habit_streak + recalculate_user_stats to
--      SECURITY INVOKER (RLS policies cover them; removes the
--      authenticated_security_definer warning entirely)
--   3. GRANTs EXECUTE back to authenticated for the two RPC functions
-- ============================================================

-- ── Step 1: revoke from PUBLIC ────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_habit_completion_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_habit_streak(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_user_stats(UUID) FROM PUBLIC;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

-- ── Step 2: switch RPC functions to SECURITY INVOKER ─────────
-- users_own policy is FOR ALL USING (auth.uid() = id), so authenticated
-- users can read/write their own habits, completions, and user row.
-- SECURITY INVOKER is actually safer: prevents one user from updating
-- another user's streak by passing a foreign habit_id.

CREATE OR REPLACE FUNCTION public.update_habit_streak(p_habit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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

CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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

-- ── Step 3: grant back to authenticated for RPC calls ─────────
GRANT EXECUTE ON FUNCTION public.update_habit_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_user_stats(UUID) TO authenticated;
