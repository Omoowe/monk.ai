-- ============================================================
-- Habit streak function: recalculates streak_days for one habit
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_habit_streak(p_habit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================
-- User stats function: recalculates dopamine_score + streak
-- Called after any habit_completion change for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================
-- Trigger function: fires after habit_completion INSERT/DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_habit_completion_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_habit_id UUID;
  v_user_id  UUID;
BEGIN
  -- Use NEW on insert, OLD on delete
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

-- ============================================================
-- Attach trigger to habit_completions
-- ============================================================
DROP TRIGGER IF EXISTS habit_completion_stats_trigger ON public.habit_completions;
CREATE TRIGGER habit_completion_stats_trigger
  AFTER INSERT OR DELETE ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.on_habit_completion_change();
